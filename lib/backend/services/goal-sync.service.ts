import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import {
  VAULTS,
  CONTRACTS,
  GOAL_MANAGER_ABI,
  type VaultMap,
  type ContractsConfig,
} from "../constants";
import { createProvider, formatAmountForDisplay } from "../utils";
import { getMetaGoalsCollection } from "../database";
import type { VaultAsset, MetaGoal } from "../types";
import type { Collection } from "mongodb";
import type { ChainKey } from "../types";
import { resolveChainKey, setGoalForChain } from "../metaGoalMapping";

export class GoalSyncService {
  private provider: ethers.Provider;
  private goalManager: ethers.Contract;
  private vaults: VaultMap;
  private chainKey: ChainKey | null;
  private collection: Collection<MetaGoal> | null = null;

  constructor(
    provider?: ethers.Provider,
    contracts: ContractsConfig = CONTRACTS,
    vaults: VaultMap = VAULTS
  ) {
    this.provider = provider || createProvider({ contractAddress: contracts.GOAL_MANAGER });
    this.vaults = vaults;
    this.goalManager = new ethers.Contract(
      contracts.GOAL_MANAGER,
      GOAL_MANAGER_ABI,
      this.provider
    );
    this.chainKey = resolveChainKey({ contractAddress: contracts.GOAL_MANAGER });
  }

  private async getCollection() {
    if (!this.collection) {
      this.collection = await getMetaGoalsCollection();
    }
    return this.collection;
  }

  async syncGoalFromChain(goalId: string): Promise<MetaGoal | null> {
    try {
      const onChainGoal = await this.goalManager.goals(goalId);
      
      if (onChainGoal.id.toString() === "0") {
        return null;
      }

      const vaultAddress = onChainGoal.vault.toLowerCase();
      let asset: VaultAsset | null = null;
      
      for (const [key, config] of Object.entries(this.vaults)) {
        if (config.address.toLowerCase() === vaultAddress) {
          asset = key as VaultAsset;
          break;
        }
      }

      if (!asset) return null;

      const vaultConfig = this.vaults[asset];
      const formattedAmount = formatAmountForDisplay(onChainGoal.targetAmount.toString(), vaultConfig.decimals);
      const targetAmountToken = parseFloat(formattedAmount);
      
      if (!Number.isFinite(targetAmountToken) || targetAmountToken < 0) {
        console.error(`Invalid targetAmountToken for goal ${goalId}: ${formattedAmount}`);
        return null;
      }

      const collection = await this.getCollection();
      const existing = await collection.findOne(
        this.chainKey
          ? {
              $or: [
                {
                  [`onChainGoalsByChain.${this.chainKey}.${asset}`]:
                    goalId,
                },
                { [`onChainGoals.${asset}`]: goalId },
              ],
            }
          : { [`onChainGoals.${asset}`]: goalId }
      );

      if (existing) {
        return existing;
      }

      const metaGoalId = uuidv4();
      let metaGoal: MetaGoal = {
        metaGoalId,
        name: onChainGoal.metadataURI || `Goal ${goalId}`,
        targetAmountToken,
        targetDate: new Date(Number(onChainGoal.targetDate) * 1000).toISOString(),
        creatorAddress: onChainGoal.creator.toLowerCase(),
        onChainGoals: { [asset]: goalId },
        createdAt: new Date(Number(onChainGoal.createdAt) * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      };
      metaGoal = setGoalForChain(metaGoal, this.chainKey, asset, goalId);

      try {
        await collection.insertOne(metaGoal);
        console.log(`✅ Synced goal ${goalId} from chain to DB as meta-goal ${metaGoalId}`);
        return metaGoal;
      } catch (error) {
        if (error instanceof Error && "code" in error && (error as { code: number }).code === 11000) {
          const retry = await collection.findOne(
            this.chainKey
              ? {
                  $or: [
                    {
                      [`onChainGoalsByChain.${this.chainKey}.${asset}`]:
                        goalId,
                    },
                    { [`onChainGoals.${asset}`]: goalId },
                  ],
                }
              : { [`onChainGoals.${asset}`]: goalId }
          );
          return retry;
        }
        throw error;
      }
    } catch (error) {
      console.error(`Failed to sync goal ${goalId}:`, error);
      return null;
    }
  }

  async discoverUserGoalsFromEvents(userAddress: string, fromBlock: number = -5000): Promise<string[]> {
    const discoveredGoalIds: string[] = [];
    
    try {
      let startBlock: number;
      if (fromBlock < 0) {
        const latestBlock = await this.provider.getBlockNumber();
        startBlock = Math.max(0, latestBlock + fromBlock);
      } else {
        startBlock = Math.floor(fromBlock);
      }
      
      console.log(`🔍 Discovering goals for ${userAddress} from block ${startBlock}`);
      const filter = this.goalManager.filters.GoalCreated(null, userAddress, null);
      const events = await this.goalManager.queryFilter(filter, startBlock, "latest");
      
      console.log(`📊 Found ${events.length} GoalCreated events`);
      
      for (const event of events) {
        if ("args" in event && event.args?.goalId) {
          const goalId = event.args.goalId.toString();
          console.log(`  - Goal ID: ${goalId}`);
          discoveredGoalIds.push(goalId);
          await this.syncGoalFromChain(goalId);
        }
      }
    } catch (error) {
      console.error(`Error discovering goals for ${userAddress}:`, error);
    }
    
    return discoveredGoalIds;
  }

  async syncUserGoals(userAddress: string): Promise<void> {
    const collection = await this.getCollection();
    const syncedGoals: Record<VaultAsset, string> = {} as Record<VaultAsset, string>;
    let hasGoals = false;

    // Discover goals from recent events
    await this.discoverUserGoalsFromEvents(userAddress);

    for (const [asset, vaultConfig] of Object.entries(this.vaults)) {
      try {
        const goalId = await this.goalManager.getQuicksaveGoal(vaultConfig.address, userAddress);
        
        if (goalId > BigInt(0)) {
          hasGoals = true;
          const goal = await this.goalManager.goals(goalId);
          
          if (goal.creator.toLowerCase() === userAddress.toLowerCase()) {
            syncedGoals[asset as VaultAsset] = goalId.toString();
          }
        }
      } catch (error) {
        console.error(`Error syncing ${asset} goal for ${userAddress}:`, error);
      }
    }

    if (hasGoals) {
      const normalizedAddress = userAddress.toLowerCase();
      const now = new Date().toISOString();
      
      await collection.updateOne(
        {
          creatorAddress: normalizedAddress,
          targetAmountToken: 0,
          name: "quicksave"
        },
        {
          $set: { 
            onChainGoals: syncedGoals,
            ...(this.chainKey
              ? { [`onChainGoalsByChain.${this.chainKey}`]: syncedGoals }
              : {}),
            updatedAt: now 
          },
          $setOnInsert: {
            metaGoalId: uuidv4(),
            name: "quicksave",
            targetAmountToken: 0,
            targetDate: "",
            creatorAddress: normalizedAddress,
            createdAt: now,
          }
        },
        { upsert: true }
      );
    }
  }

  async getGoalWithFallback(goalId: string): Promise<{ metaGoal: MetaGoal | null; fromChain: boolean }> {
    const collection = await this.getCollection();
    
    const searchPromises = Object.keys(this.vaults).map((asset) =>
      collection.findOne(
        this.chainKey
          ? {
              $or: [
                { [`onChainGoalsByChain.${this.chainKey}.${asset}`]: goalId },
                { [`onChainGoals.${asset}`]: goalId },
              ],
            }
          : { [`onChainGoals.${asset}`]: goalId }
      )
    );
    
    const results = await Promise.all(searchPromises);
    const existing = results.find(result => result !== null);
    
    if (existing) {
      return { metaGoal: existing, fromChain: false };
    }

    const synced = await this.syncGoalFromChain(goalId);
    return { metaGoal: synced, fromChain: synced !== null };
  }
}
