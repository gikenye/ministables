import {
  getContract,
  readContract,
  prepareEvent,
  getContractEvents,
} from "thirdweb";
import { client } from "@/lib/thirdweb/client";
import { Chain } from "thirdweb/chains";
import {
  getVaultAddress,
  VAULT_CONTRACTS,
  hasVaultContracts,
} from "@/config/chainConfig";
import { GoalService } from "./goalService";
import { getCollection } from "../mongodb";

// Event interfaces based on SupplierVault.sol
interface DepositedEvent {
  user: string;
  depositId: bigint;
  amount: bigint;
  shares: bigint;
  lockTier: bigint;
}

interface WithdrawnEvent {
  user: string;
  depositId: bigint;
  amount: bigint;
  yield: bigint;
  sharesBurned: bigint;
}

interface YieldDistributedEvent {
  amount: bigint;
  newInterestIndex: bigint;
}

interface OnrampDepositEvent {
  user: string;
  depositId: bigint;
  amount: bigint;
  shares: bigint;
  txHash: string;
}

/**
 * Service to monitor vault contract events and update goal progress
 * This service runs in the background to sync smart contract state with goal backend
 */
export const VaultMonitoringService = {
  /**
   * Monitor deposit events for a specific vault and update goal progress
   */
  async monitorVaultDeposits(
    chain: Chain,
    tokenSymbol: string,
    fromBlock?: bigint
  ): Promise<void> {
    try {
      const vaultAddress = getVaultAddress(chain.id, tokenSymbol);

      const vault = getContract({
        client,
        chain,
        address: vaultAddress,
      });

      // Prepare the Deposited event
      const depositEvent = prepareEvent({
        signature:
          "event Deposited(address indexed user, uint256 indexed depositId, uint256 amount, uint256 shares, uint256 lockTier)",
      });

      // Get recent deposit events
      const events = await getContractEvents({
        contract: vault,
        events: [depositEvent],
        fromBlock: fromBlock || BigInt(0),
        toBlock: "latest",
      });

      console.log(
        `Found ${events.length} deposit events for ${tokenSymbol} on chain ${chain.id}`
      );

      for (const event of events) {
        await this.processDepositEvent(
          chain.id,
          tokenSymbol,
          vaultAddress,
          event
        );
      }
    } catch (error) {
      console.error(
        `Error monitoring vault deposits for ${tokenSymbol}:`,
        error
      );
    }
  },

  /**
   * Monitor withdrawal events for a specific vault
   */
  async monitorVaultWithdrawals(
    chain: Chain,
    tokenSymbol: string,
    fromBlock?: bigint
  ): Promise<void> {
    try {
      const vaultAddress = getVaultAddress(chain.id, tokenSymbol);

      const vault = getContract({
        client,
        chain,
        address: vaultAddress,
      });

      // Prepare the Withdrawn event
      const withdrawEvent = prepareEvent({
        signature:
          "event Withdrawn(address indexed user, uint256 indexed depositId, uint256 amount, uint256 yield, uint256 sharesBurned)",
      });

      // Get recent withdrawal events
      const events = await getContractEvents({
        contract: vault,
        events: [withdrawEvent],
        fromBlock: fromBlock || BigInt(0),
        toBlock: "latest",
      });

      console.log(
        `Found ${events.length} withdrawal events for ${tokenSymbol} on chain ${chain.id}`
      );

      for (const event of events) {
        await this.processWithdrawalEvent(
          chain.id,
          tokenSymbol,
          vaultAddress,
          event
        );
      }
    } catch (error) {
      console.error(
        `Error monitoring vault withdrawals for ${tokenSymbol}:`,
        error
      );
    }
  },

  /**
   * Monitor yield distribution events
   */
  async monitorYieldDistribution(
    chain: Chain,
    tokenSymbol: string,
    fromBlock?: bigint
  ): Promise<void> {
    try {
      const vaultAddress = getVaultAddress(chain.id, tokenSymbol);

      const vault = getContract({
        client,
        chain,
        address: vaultAddress,
      });

      // Prepare the YieldDistributed event
      const yieldEvent = prepareEvent({
        signature:
          "event YieldDistributed(uint256 amount, uint256 newInterestIndex)",
      });

      // Get recent yield events
      const events = await getContractEvents({
        contract: vault,
        events: [yieldEvent],
        fromBlock: fromBlock || BigInt(0),
        toBlock: "latest",
      });

      console.log(
        `Found ${events.length} yield distribution events for ${tokenSymbol} on chain ${chain.id}`
      );

      for (const event of events) {
        await this.processYieldDistributionEvent(
          chain.id,
          tokenSymbol,
          vaultAddress,
          event
        );
      }
    } catch (error) {
      console.error(
        `Error monitoring yield distribution for ${tokenSymbol}:`,
        error
      );
    }
  },

  /**
   * Process a deposit event and update goal progress if applicable
   */
  async processDepositEvent(
    chainId: number,
    tokenSymbol: string,
    vaultAddress: string,
    event: any
  ): Promise<void> {
    try {
      const { user, depositId, amount, shares, lockTier } =
        event.args as DepositedEvent;
      const userAddress = user.toLowerCase();
      const txHash = event.transactionHash;

      console.log(
        `Processing deposit event: ${userAddress}, depositId: ${depositId}, amount: ${amount}`
      );

      // Check if this deposit is associated with a goal transaction
      const transactionCollection = await getCollection("savingsTransactions");
      const goalTransaction = await transactionCollection.findOne({
        userId: userAddress,
        transactionHash: txHash,
        type: "deposit",
        "contractData.vaultAddress": vaultAddress,
      });

      if (goalTransaction && goalTransaction.goalId) {
        // Update the transaction with vault-specific data
        await transactionCollection.updateOne(
          { _id: goalTransaction._id },
          {
            $set: {
              status: "confirmed",
              confirmedAt: new Date(),
              "contractData.depositId": Number(depositId),
              "contractData.shares": shares.toString(),
              updatedAt: new Date(),
            },
          }
        );

        console.log(
          `Updated goal transaction ${goalTransaction.transactionId} with vault deposit data`
        );
      }

      // Store the event for audit purposes
      await this.storeVaultEvent({
        chainId,
        vaultAddress,
        tokenSymbol,
        eventType: "Deposited",
        userAddress,
        transactionHash: txHash,
        blockNumber: event.blockNumber,
        eventData: {
          depositId: Number(depositId),
          amount: amount.toString(),
          shares: shares.toString(),
          lockTier: Number(lockTier),
        },
        processedAt: new Date(),
      });
    } catch (error) {
      console.error("Error processing deposit event:", error);
    }
  },

  /**
   * Process a withdrawal event and update goal progress
   */
  async processWithdrawalEvent(
    chainId: number,
    tokenSymbol: string,
    vaultAddress: string,
    event: any
  ): Promise<void> {
    try {
      const {
        user,
        depositId,
        amount,
        yield: yieldAmount,
        sharesBurned,
      } = event.args as WithdrawnEvent;
      const userAddress = user.toLowerCase();
      const txHash = event.transactionHash;

      console.log(
        `Processing withdrawal event: ${userAddress}, depositId: ${depositId}, amount: ${amount}, yield: ${yieldAmount}`
      );

      // Check if this withdrawal is associated with a goal transaction
      const transactionCollection = await getCollection("savingsTransactions");
      const goalTransaction = await transactionCollection.findOne({
        userId: userAddress,
        transactionHash: txHash,
        type: "withdrawal",
        "contractData.vaultAddress": vaultAddress,
        "contractData.depositId": Number(depositId),
      });

      if (goalTransaction && goalTransaction.goalId) {
        // Update the transaction with actual withdrawal amounts
        await transactionCollection.updateOne(
          { _id: goalTransaction._id },
          {
            $set: {
              status: "confirmed",
              confirmedAt: new Date(),
              amount: amount.toString(),
              "contractData.yieldEarned": yieldAmount.toString(),
              "contractData.sharesBurned": sharesBurned.toString(),
              updatedAt: new Date(),
            },
          }
        );

        // If yield was earned, create an interest transaction
        if (yieldAmount > 0) {
          await GoalService.createInterestTransaction(
            goalTransaction.goalId,
            userAddress,
            yieldAmount.toString(),
            {
              vaultAddress,
              depositId: Number(depositId),
            }
          );
        }

        console.log(
          `Updated goal withdrawal transaction ${goalTransaction.transactionId} with vault data`
        );
      }

      // Store the event for audit purposes
      await this.storeVaultEvent({
        chainId,
        vaultAddress,
        tokenSymbol,
        eventType: "Withdrawn",
        userAddress,
        transactionHash: txHash,
        blockNumber: event.blockNumber,
        eventData: {
          depositId: Number(depositId),
          amount: amount.toString(),
          yieldAmount: yieldAmount.toString(),
          sharesBurned: sharesBurned.toString(),
        },
        processedAt: new Date(),
      });
    } catch (error) {
      console.error("Error processing withdrawal event:", error);
    }
  },

  /**
   * Process yield distribution events to update interest calculations
   */
  async processYieldDistributionEvent(
    chainId: number,
    tokenSymbol: string,
    vaultAddress: string,
    event: any
  ): Promise<void> {
    try {
      const { amount, newInterestIndex } = event.args as YieldDistributedEvent;
      const txHash = event.transactionHash;

      console.log(
        `Processing yield distribution: amount: ${amount}, newIndex: ${newInterestIndex}`
      );

      // Store the yield distribution event
      await this.storeVaultEvent({
        chainId,
        vaultAddress,
        tokenSymbol,
        eventType: "YieldDistributed",
        transactionHash: txHash,
        blockNumber: event.blockNumber,
        eventData: {
          amount: amount.toString(),
          newInterestIndex: newInterestIndex.toString(),
        },
        processedAt: new Date(),
      });

      // TODO: Update interest calculations for affected goals
      // This would involve recalculating yield for all active deposits in this vault
    } catch (error) {
      console.error("Error processing yield distribution event:", error);
    }
  },

  /**
   * Store vault event for audit and tracking purposes
   */
  async storeVaultEvent(eventData: {
    chainId: number;
    vaultAddress: string;
    tokenSymbol: string;
    eventType: string;
    userAddress?: string;
    transactionHash: string;
    blockNumber: number;
    eventData: Record<string, any>;
    processedAt: Date;
  }): Promise<void> {
    try {
      const eventsCollection = await getCollection("vaultEvents");
      await eventsCollection.insertOne({
        ...eventData,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error("Error storing vault event:", error);
    }
  },

  /**
   * Monitor all supported vaults on a chain
   */
  async monitorAllVaultsOnChain(
    chain: Chain,
    fromBlock?: bigint
  ): Promise<void> {
    if (!hasVaultContracts(chain.id)) {
      console.log(`Chain ${chain.id} does not support vault contracts`);
      return;
    }

    const vaultContracts = VAULT_CONTRACTS[chain.id];
    if (!vaultContracts) return;

    const tokenSymbols = Object.keys(vaultContracts);

    console.log(
      `Monitoring ${tokenSymbols.length} vaults on chain ${chain.id}`
    );

    for (const tokenSymbol of tokenSymbols) {
      console.log(`Monitoring vault for ${tokenSymbol}...`);

      await Promise.all([
        this.monitorVaultDeposits(chain, tokenSymbol, fromBlock),
        this.monitorVaultWithdrawals(chain, tokenSymbol, fromBlock),
        this.monitorYieldDistribution(chain, tokenSymbol, fromBlock),
      ]);
    }
  },

  /**
   * Get the last processed block for a vault to avoid reprocessing events
   */
  async getLastProcessedBlock(
    chainId: number,
    vaultAddress: string
  ): Promise<bigint> {
    try {
      const eventsCollection = await getCollection("vaultEvents");
      const lastEvent = await eventsCollection.findOne(
        { chainId, vaultAddress },
        { sort: { blockNumber: -1 } }
      );

      return lastEvent ? BigInt(lastEvent.blockNumber) : BigInt(0);
    } catch (error) {
      console.error("Error getting last processed block:", error);
      return BigInt(0);
    }
  },

  /**
   * Sync vault state with goal progress (manual sync)
   */
  async syncVaultStateWithGoals(
    chain: Chain,
    tokenSymbol: string,
    userAddress?: string
  ): Promise<void> {
    try {
      const vaultAddress = getVaultAddress(chain.id, tokenSymbol);
      const lastProcessedBlock = await this.getLastProcessedBlock(
        chain.id,
        vaultAddress
      );

      console.log(
        `Syncing vault ${tokenSymbol} from block ${lastProcessedBlock}`
      );

      await this.monitorAllVaultsOnChain(chain, lastProcessedBlock + BigInt(1));
    } catch (error) {
      console.error("Error syncing vault state:", error);
    }
  },
};
