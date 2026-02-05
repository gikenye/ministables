import { ethers } from "ethers";
import {
  CONTRACTS,
  VAULT_ABI,
  GOAL_MANAGER_ABI,
  LEADERBOARD_ABI,
  type ContractsConfig,
} from "../constants";
import { findEventInLogs } from "../utils";

export class BlockchainService {
  constructor(
    private provider: ethers.JsonRpcProvider,
    private contracts: ContractsConfig = CONTRACTS
  ) {}

  getGoalManager(signer?: ethers.Wallet) {
    return new ethers.Contract(
      this.contracts.GOAL_MANAGER,
      GOAL_MANAGER_ABI,
      signer || this.provider
    );
  }

  getLeaderboard(signer?: ethers.Wallet) {
    return new ethers.Contract(
      this.contracts.LEADERBOARD,
      LEADERBOARD_ABI,
      signer || this.provider
    );
  }

  getVault(address: string, signer?: ethers.Wallet) {
    return new ethers.Contract(address, VAULT_ABI, signer || this.provider);
  }

  async getUserLeaderboardRank(userAddress: string, score: bigint): Promise<number | null> {
    if (score <= BigInt(0)) return null;

    const leaderboard = this.getLeaderboard();
    const topLength = await leaderboard.getTopListLength();
    const maxCheck = Math.min(Number(topLength), 1000);
    const batchSize = 100;

    for (let start = 0; start < maxCheck; start += batchSize) {
      try {
        const end = Math.min(start + batchSize, maxCheck);
        const [users] = await leaderboard.getTopRange(start, end);
        const index = users.findIndex(
          (u: string) => u.toLowerCase() === userAddress.toLowerCase()
        );
        if (index !== -1) {
          return start + index + 1;
        }
      } catch {
        break;
      }
    }
    return null;
  }

  async getOrCreateQuicksaveGoal(
    vaultAddress: string,
    userAddress: string,
    signer: ethers.Wallet
  ): Promise<string> {
    const goalManager = this.getGoalManager();
    let quicksaveId = await goalManager.getQuicksaveGoal(vaultAddress, userAddress);

    if (quicksaveId.toString() === "0") {
      const goalManagerWithSigner = this.getGoalManager(signer);
      const tx = await goalManagerWithSigner.createQuicksaveGoalFor(userAddress, vaultAddress);
      const receipt = await tx.wait();

      const goalEvent = findEventInLogs(receipt.logs, goalManagerWithSigner, "GoalCreated");
      
      if (goalEvent) {
        quicksaveId = goalEvent.args.goalId;
      }
    }

    return quicksaveId.toString();
  }
}
