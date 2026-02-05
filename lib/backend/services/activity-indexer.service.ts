import { ethers } from "ethers";
import { CHAINS, ALL_CHAINS } from "../constants";
import { createProvider } from "../utils";
import { getDatabase } from "../database";

interface IndexedActivity {
  userAddress: string;
  chain: string;
  type: string;
  txHash: string;
  blockNumber: number;
  timestamp: string;
  data: Record<string, any>;
  indexed: boolean;
}

export class ActivityIndexer {
  private static COLLECTION = "indexed_activities";
  private static BATCH_SIZE = 10000; // Index 10k blocks at a time

  static async indexUserActivities(userAddress: string, chain: string): Promise<void> {
    const db = await getDatabase();
    const collection = db.collection<IndexedActivity>(this.COLLECTION);
    
    // Check last indexed block for this user/chain
    const lastIndexed = await collection
      .find({ userAddress: userAddress.toLowerCase(), chain })
      .sort({ blockNumber: -1 })
      .limit(1)
      .toArray();

    const chainConfig = CHAINS[chain as keyof typeof CHAINS];
    const provider = createProvider(chainConfig.rpcUrl);
    const currentBlock = await provider.getBlockNumber();
    
    const startBlock = lastIndexed[0]?.blockNumber 
      ? lastIndexed[0].blockNumber + 1 
      : Math.max(0, currentBlock - 50000); // Start from 50k blocks back on first index

    console.log(`[${chain}] Indexing ${userAddress}: blocks ${startBlock} to ${currentBlock}`);

    if (startBlock >= currentBlock) {
      console.log(`[${chain}] Already up to date`);
      return;
    }

    const goalManager = new ethers.Contract(
      chainConfig.contracts.GOAL_MANAGER,
      [
        "event GoalCreated(uint256 indexed goalId, address indexed creator, address indexed vault, uint256 targetAmount, uint256 targetDate, string metadataURI)",
        "event DepositAttached(uint256 indexed goalId, address indexed owner, uint256 indexed depositId, uint256 attachedAt)",
      ],
      provider
    );

    // Fetch events in batches
    for (let from = startBlock; from < currentBlock; from += this.BATCH_SIZE) {
      const to = Math.min(from + this.BATCH_SIZE - 1, currentBlock);
      
      const [goalEvents, depositEvents] = await Promise.all([
        goalManager.queryFilter(
          goalManager.filters.GoalCreated(null, userAddress, null),
          from,
          to
        ),
        goalManager.queryFilter(
          goalManager.filters.DepositAttached(null, userAddress, null),
          from,
          to
        ),
      ]);

      const activities: IndexedActivity[] = [];

      for (const event of [...goalEvents, ...depositEvents]) {
        if (!event.blockNumber || !event.transactionHash) continue;
        
        const block = await provider.getBlock(event.blockNumber);
        const args = (event as any).args;

        activities.push({
          userAddress: userAddress.toLowerCase(),
          chain,
          type: (event as any).eventName === "GoalCreated" ? "goal_created" : "deposit_attached",
          txHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: new Date((block?.timestamp || 0) * 1000).toISOString(),
          data: {
            goalId: args?.goalId?.toString(),
            depositId: args?.depositId?.toString(),
            vault: args?.vault,
          },
          indexed: true,
        });
      }

      if (activities.length > 0) {
        await collection.insertMany(activities);
        console.log(`[${chain}] Indexed ${activities.length} activities in blocks ${from}-${to}`);
      }
    }
    console.log(`[${chain}] Indexing complete for ${userAddress}`);
  }

  static async getActivities(
    userAddress: string,
    limit: number = 20
  ): Promise<any[]> {
    const db = await getDatabase();
    const collection = db.collection<IndexedActivity>(this.COLLECTION);

    // Trigger background indexing for all chains (non-blocking)
    Promise.all(
      ALL_CHAINS.map((chain) =>
        this.indexUserActivities(userAddress, chain).catch((err) =>
          console.warn(`Failed to index ${chain}:`, err)
        )
      )
    );

    // Return already indexed activities
    const activities = await collection
      .find({ userAddress: userAddress.toLowerCase() })
      .sort({ blockNumber: -1, timestamp: -1 })
      .limit(limit)
      .toArray();

    return activities.map((a) => ({
      id: `${a.chain}:${a.txHash}`,
      type: a.type,
      txHash: a.txHash,
      blockNumber: a.blockNumber,
      timestamp: a.timestamp,
      chain: a.chain,
      ...a.data,
    }));
  }
}
