import { BlockchainService } from "./blockchain.service";
import { getMetaGoalsCollection } from "../database";
import { resolveTargetAmountToken } from "../utils";
import type { Goal, GoalAttachment, MetaGoalWithProgress, VaultAsset, ChainKey } from "../types";
import { getGoalsForChain } from "../metaGoalMapping";

const MAX_ATTACHMENTS_TO_FETCH = 100;

export class GoalService {
  constructor(
    private blockchainService: BlockchainService,
    private chainKey: ChainKey | null = null
  ) {}

  async getGoalDetails(goalId: string): Promise<Goal> {
    const goalManager = this.blockchainService.getGoalManager();
    const goal = await goalManager.goals(goalId);
    
    if (goal.id.toString() === "0") {
      throw new Error(`Goal ${goalId} not found`);
    }
    
    const [totalValue, percentBps] = await goalManager.getGoalProgressFull(goalId);
    const attachmentCount = await goalManager.attachmentCount(goalId);
    const attachments = await this.getGoalAttachments(goalId, Number(attachmentCount));

    return {
      id: goal.id.toString(),
      creator: goal.creator,
      vault: goal.vault,
      targetAmount: goal.targetAmount.toString(),
      targetDate: goal.targetDate.toString(),
      metadataURI: goal.metadataURI,
      createdAt: goal.createdAt.toString(),
      cancelled: goal.cancelled,
      completed: goal.completed,
      totalValue: totalValue.toString(),
      percentBps: percentBps.toString(),
      attachments,
    };
  }

  private async getGoalAttachments(goalId: string, count: number): Promise<GoalAttachment[]> {
    const goalManager = this.blockchainService.getGoalManager();
    const maxAttachments = Math.min(count, MAX_ATTACHMENTS_TO_FETCH);
    
    const attachmentPromises = Array.from({ length: maxAttachments }, (_, i) =>
      goalManager.attachmentAt(goalId, i).catch(() => null)
    );

    const results = await Promise.all(attachmentPromises);
    
    return results
      .filter((attachment): attachment is NonNullable<typeof attachment> => attachment !== null)
      .map((attachment) => ({
        owner: attachment.owner,
        depositId: attachment.depositId.toString(),
        attachedAt: attachment.attachedAt.toString(),
        pledged: attachment.pledged,
      }));
  }

  async getUserMetaGoals(userAddress: string): Promise<MetaGoalWithProgress[]> {
    const metaGoalsCollection = await getMetaGoalsCollection();
    const metaGoals = await metaGoalsCollection
      .find({ creatorAddress: userAddress })
      .toArray();

    const goalManager = this.blockchainService.getGoalManager();
    const goalsWithProgress: MetaGoalWithProgress[] = [];

    for (const metaGoal of metaGoals) {
      const targetAmountToken = resolveTargetAmountToken(metaGoal);
      const vaultProgress: Record<VaultAsset, {
        goalId: string;
        progressUSD: number;
        progressPercent: number;
        attachmentCount: number;
      }> = {} as Record<VaultAsset, {
        goalId: string;
        progressUSD: number;
        progressPercent: number;
        attachmentCount: number;
      }>;

      let totalProgressUSD = 0;

      const chainGoals = getGoalsForChain(metaGoal, this.chainKey);
      const progressPromises = Object.entries(chainGoals).map(
        async ([asset, goalIdStr]: [string, unknown]) => {
          try {
            const goalId = BigInt(goalIdStr as string);
            const [, percentBps] = await goalManager.getGoalProgressFull(goalId);
            const progressUSD = (Number(percentBps) / 10000) * targetAmountToken;
            const progressPercent = Number(percentBps) / 100;
            const attachmentCount = Number(await goalManager.attachmentCount(goalId));

            return {
              asset: asset as VaultAsset,
              data: { goalId: goalIdStr as string, progressUSD, progressPercent, attachmentCount },
            };
          } catch (error) {
            console.error(`Error getting progress for goal ${goalIdStr}:`, error);
            return {
              asset: asset as VaultAsset,
              data: { goalId: goalIdStr as string, progressUSD: 0, progressPercent: 0, attachmentCount: 0 },
            };
          }
        }
      );

      const progressResults = await Promise.all(progressPromises);
      
      progressResults.forEach(({ asset, data }) => {
        vaultProgress[asset] = data;
        totalProgressUSD += data.progressUSD;
      });

      const progressPercent =
        targetAmountToken > 0
          ? (totalProgressUSD / targetAmountToken) * 100
          : 0;

      const { targetAmountUSD: _legacyTargetAmount, ...metaGoalBase } =
        metaGoal as typeof metaGoal & { targetAmountUSD?: number };
      goalsWithProgress.push({
        ...metaGoalBase,
        targetAmountToken,
        totalProgressUSD,
        progressPercent,
        vaultProgress,
        // TODO: Implement participants aggregation from attachment data
        participants: [],
        // TODO: Implement user-specific balance calculation
        userBalance: "0",
        userBalanceUSD: "0.00",
      });
    }

    return goalsWithProgress;
  }
}
