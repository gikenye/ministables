import { ethers } from "ethers";
import { ObjectId } from "mongodb";
import {
  VAULTS,
  GOAL_MANAGER_ABI,
  CONTRACTS,
  type VaultMap,
  type ContractsConfig,
} from "../constants";
import { getDatabase, getMetaGoalsCollection, getUserXPCollection } from "../database";
import { formatAmountForDisplay } from "../utils";
import type { MetaGoal, VaultAsset, ChainKey } from "../types";
import { getGoalsForChain, resolveChainKey } from "../metaGoalMapping";

export class XPService {
  constructor(
    private provider: ethers.Provider,
    private contracts: ContractsConfig = CONTRACTS,
    private vaults: VaultMap = VAULTS
  ) {
    this.chainKey = resolveChainKey({ contractAddress: this.contracts.GOAL_MANAGER });
  }

  private chainKey: ChainKey | null;

  private hasCrossChainGoals(metaGoal: MetaGoal): boolean {
    const onChainGoalsByChain = metaGoal.onChainGoalsByChain;
    if (!onChainGoalsByChain) return false;
    for (const [chainKey, assetMap] of Object.entries(onChainGoalsByChain)) {
      if (this.chainKey && chainKey === this.chainKey) continue;
      if (Object.values(assetMap || {}).some((goalId) => !!goalId)) return true;
    }
    return false;
  }

  async checkAndAwardXP(
    metaGoalId: string
  ): Promise<{ awarded: boolean; recipients?: Record<string, number> }> {
    const metaGoalsCollection = await getMetaGoalsCollection();

  //Atomically clain this meta-goal for XP processing
  const metaGoal =  await metaGoalsCollection.findOneAndUpdate(
    {metaGoalId, xpAwarded: {$ne:true}},
    {$set: {xpAwarded: true, updatedAt: new Date().toISOString()}},
    {returnDocument: 'before'}
  );

  if (!metaGoal) {
    return { awarded: false };
  }

    const goalManager = new ethers.Contract(
      this.contracts.GOAL_MANAGER,
      GOAL_MANAGER_ABI,
      this.provider
    );
    const allCompleted = await this.checkAllGoalsCompleted(
      metaGoal,
      goalManager
    );

    if (!allCompleted) {
      
      //revert the flag if goals are not completed
      await metaGoalsCollection.updateOne(
        {metaGoalId},
        {$set: {xpAwarded: false, updatedAt: new Date().toISOString()}}
      )
      return { awarded: false };
    }

    const contributions = await this.calculateContributions(
      metaGoal,
      goalManager
    );
    await this.awardXP(metaGoal, contributions);

    return { awarded: true, recipients: contributions };
  }

  private async checkAllGoalsCompleted(
    metaGoal: MetaGoal,
    goalManager: ethers.Contract
  ): Promise<boolean> {
    // If this meta-goal spans multiple chains, do not decide completion locally.
    if (this.hasCrossChainGoals(metaGoal)) {
      return false;
    }
    let hasAnyProgress = false;
    const chainGoals = getGoalsForChain(metaGoal, this.chainKey);
    for (const goalId of Object.values(chainGoals)) {
      const attachmentCount = await goalManager.attachmentCount(goalId);
      if (attachmentCount === BigInt(0)) continue;

      hasAnyProgress = true;
      const [, percentBps] = await goalManager.getGoalProgressFull(goalId);
      if (percentBps < BigInt(10000)) return false;
    }
    return hasAnyProgress;
  }

  private async calculateContributions(
    metaGoal: MetaGoal,
    goalManager: ethers.Contract
  ): Promise<Record<string, number>> {
    const contributions: Record<string, number> = {};

    // Skip local-only XP calculation when meta-goal includes other chains.
    if (this.hasCrossChainGoals(metaGoal)) {
      return contributions;
    }

    const chainGoals = getGoalsForChain(metaGoal, this.chainKey);
    for (const [asset, goalId] of Object.entries(chainGoals)) {
      const vaultConfig = this.vaults[asset as VaultAsset];
      const vault = new ethers.Contract(
        vaultConfig.address,
        [
          "function getUserDeposit(address,uint256) view returns (uint256,uint256,uint256,uint256,bool)",
        ],
        this.provider
      );
      const attachmentCount = await goalManager.attachmentCount(goalId);

      for (let i = 0; i < Number(attachmentCount); i++) {
        const attachment = await goalManager.attachmentAt(goalId, i);
        const [, currentValue] = await vault.getUserDeposit(
          attachment.owner,
          attachment.depositId
        );
        const contributionUSD = parseFloat(
          formatAmountForDisplay(currentValue.toString(), vaultConfig.decimals)
        );
        const userAddress = attachment.owner.toLowerCase();
        contributions[userAddress] =
          (contributions[userAddress] || 0) + contributionUSD;
      }
    }

    return contributions;
  }

  private async awardXP(
    metaGoal: MetaGoal,
    contributions: Record<string, number>
  ): Promise<void> {
    const xpCollection = await getUserXPCollection();
    const completedAt = new Date().toISOString();

    for (const [userAddress, xpEarned] of Object.entries(contributions)) {
      await xpCollection.updateOne(
        { userAddress },
        {
          $inc: { totalXP: xpEarned },
          $push: {
            xpHistory: {
              metaGoalId: metaGoal.metaGoalId,
              goalName: metaGoal.name,
              xpEarned,
              contributionUSD: xpEarned,
              completedAt,
            },
          },
          $set: { updatedAt: completedAt },
        },
        { upsert: true }
      );
    }
  }

  async awardSelfVerificationXP(walletAddress: string): Promise<{ awarded: boolean; totalXP: number }> {
    const xpCollection = await getUserXPCollection();
    const userAddress = walletAddress.toLowerCase();
    const completedAt = new Date().toISOString();
    const xpAmount = 2;

    const result = await xpCollection.updateOne(
      { 
        userAddress,
        "xpHistory.goalName": { $ne: "Self Protocol Verification" }
      },
      {
        $inc: { totalXP: xpAmount },
        $push: {
          xpHistory: {
            metaGoalId: "self-verification",
            goalName: "Self Protocol Verification",
            xpEarned: xpAmount,
            contributionUSD: 0,
            completedAt,
          },
        },
        $set: { updatedAt: completedAt },
      },
      { upsert: true }
    );

    const userXP = await xpCollection.findOne({ userAddress });
    return { 
      awarded: result.modifiedCount > 0 || result.upsertedCount > 0,
      totalXP: userXP?.totalXP || xpAmount
    };
  }

  async awardActivityXP(
    userAddress: string
  ): Promise<{ awarded: boolean; earned: number; totalXP: number }> {
    const normalizedAddress = userAddress.toLowerCase();
    const db = await getDatabase();
    const activities = db.collection<{ _id: ObjectId; userAddress: string }>(
      "indexed_activities"
    );
    const xpCollection = await getUserXPCollection();

    const existing = await xpCollection.findOne({ userAddress: normalizedAddress });
    const lastActivityId = existing?.lastActivityId;
    let query: Record<string, unknown> = { userAddress: normalizedAddress };
    if (lastActivityId && ObjectId.isValid(lastActivityId)) {
      query = { ...query, _id: { $gt: new ObjectId(lastActivityId) } };
    }

    const [count, latest] = await Promise.all([
      activities.countDocuments(query),
      activities.find(query).sort({ _id: -1 }).limit(1).toArray(),
    ]);

    if (!count || count <= 0 || latest.length === 0) {
      return {
        awarded: false,
        earned: 0,
        totalXP: existing?.totalXP || 0,
      };
    }

    const now = new Date().toISOString();
    const lastId = latest[0]._id.toString();
    const historyEntry = {
      metaGoalId: `activity:${lastId}`,
      goalName: "Activity",
      xpEarned: count,
      contributionUSD: 0,
      completedAt: now,
    };

    const expectedLastActivityId = existing?.lastActivityId ?? null;
    const baseFilter: Record<string, unknown> = {
      userAddress: normalizedAddress,
    };
    const filter = expectedLastActivityId
      ? { ...baseFilter, lastActivityId: expectedLastActivityId }
      : {
          ...baseFilter,
          $or: [{ lastActivityId: { $exists: false } }, { lastActivityId: null }],
        };
    const updated = await xpCollection.findOneAndUpdate(
      filter,
      {
        $inc: { totalXP: count },
        $set: { updatedAt: now, lastActivityId: lastId },
        $push: { xpHistory: historyEntry },
        $setOnInsert: { userAddress: normalizedAddress },
      },
      { upsert: !existing, returnDocument: "after" }
    );

    if (!updated?.value) {
      return {
        awarded: false,
        earned: 0,
        totalXP: existing?.totalXP || 0,
      };
    }

    return {
      awarded: true,
      earned: count,
      totalXP: updated.value.totalXP || (existing?.totalXP || 0) + count,
    };
  }
}
