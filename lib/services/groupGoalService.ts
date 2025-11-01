import { ObjectId } from "mongodb";
import { getCollection } from "../mongodb";
import {
  GroupGoal,
  NewGroupGoal,
  GroupGoalUpdate,
  GroupGoalSummary,
  GroupGoalStats,
  GroupGoalMember,
  GroupGoalInvitation,
  GroupGoalLeaderboard,
  MemberRole,
  MemberStatus,
  GroupVisibility,
} from "../models/groupGoal";
import {
  SavingsTransaction,
  NewSavingsTransaction,
  TransactionType,
  TransactionStatus,
} from "../models/savingsTransaction";
import { GoalCategory, GoalStatus } from "../models/goal";

const GROUP_GOALS_COLLECTION = "groupGoals";
const GROUP_TRANSACTIONS_COLLECTION = "groupSavingsTransactions";
const GROUP_INVITATIONS_COLLECTION = "groupGoalInvitations";

/**
 * Group Goal service for handling all group goal-related operations
 */
export const GroupGoalService = {
  /**
   * Create a new group goal
   */
  async createGroupGoal(groupGoalData: NewGroupGoal): Promise<GroupGoal> {
    const collection = await getCollection(GROUP_GOALS_COLLECTION);

    const groupGoal: GroupGoal = {
      ...groupGoalData,
      currentAmount: "0",
      progress: 0,
      totalMembers: 1, // Creator is the first member
      activeMembers: 1,
      totalInterestEarned: "0",
      createdAt: new Date(),
      updatedAt: new Date(),
      analytics: {
        totalContributions: 0,
        averageContributionAmount: "0",
        contributionFrequency: 0,
        memberRetentionRate: 100,
        goalCompletionRate: 0,
      },
      // Initialize creator as owner member
      members: [
        {
          userId: groupGoalData.ownerId,
          role: "owner",
          status: "active",
          currentContribution: "0",
          contributionPercentage: 0,
          joinedAt: new Date(),
          lastActiveAt: new Date(),
          isPublic: true,
          notifications: true,
        },
      ],
    };

    const result = await collection.insertOne(groupGoal);
    return { ...groupGoal, _id: result.insertedId };
  },

  /**
   * Get group goal by ID
   */
  async getGroupGoalById(groupGoalId: string): Promise<GroupGoal | null> {
    const collection = await getCollection(GROUP_GOALS_COLLECTION);
    return collection.findOne({
      _id: new ObjectId(groupGoalId),
    }) as Promise<GroupGoal | null>;
  },

  /**
   * Get all group goals for a user (as member or owner)
   */
  async getUserGroupGoals(userId: string): Promise<GroupGoal[]> {
    const collection = await getCollection(GROUP_GOALS_COLLECTION);
    return collection
      .find({
        "members.userId": userId,
        "members.status": { $in: ["active", "pending"] },
      })
      .sort({ createdAt: -1 })
      .toArray() as Promise<GroupGoal[]>;
  },

  /**
   * Get group goals owned by a user
   */
  async getOwnedGroupGoals(userId: string): Promise<GroupGoal[]> {
    const collection = await getCollection(GROUP_GOALS_COLLECTION);
    return collection
      .find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .toArray() as Promise<GroupGoal[]>;
  },

  /**
   * Get public group goals for discovery
   */
  async getPublicGroupGoals(
    limit: number = 20,
    offset: number = 0,
    category?: GoalCategory
  ): Promise<GroupGoalSummary[]> {
    const collection = await getCollection(GROUP_GOALS_COLLECTION);

    const filter: any = {
      visibility: "public",
      status: "active",
    };

    if (category) {
      filter.category = category;
    }

    const groupGoals = (await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .toArray()) as GroupGoal[];

    return groupGoals.map(this.toGroupGoalSummary);
  },

  /**
   * Update group goal
   */
  async updateGroupGoal(
    groupGoalId: string,
    updateData: GroupGoalUpdate
  ): Promise<GroupGoal | null> {
    const collection = await getCollection(GROUP_GOALS_COLLECTION);

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(groupGoalId) },
      {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    return result?.value as GroupGoal | null;
  },

  /**
   * Join a group goal
   */
  async joinGroupGoal(
    groupGoalId: string,
    userId: string,
    targetContribution?: string
  ): Promise<GroupGoal | null> {
    const groupGoal = await this.getGroupGoalById(groupGoalId);

    if (!groupGoal) {
      throw new Error("Group goal not found");
    }

    if (groupGoal.status !== "active") {
      throw new Error("Cannot join inactive group goal");
    }

    // Check if user is already a member
    const existingMember = groupGoal.members.find((m) => m.userId === userId);
    if (existingMember) {
      throw new Error("User is already a member of this group goal");
    }

    // Check member limit
    if (
      groupGoal.maxMembers &&
      groupGoal.members.length >= groupGoal.maxMembers
    ) {
      throw new Error("Group goal has reached maximum member limit");
    }

    const newMember: GroupGoalMember = {
      userId,
      role: "member",
      status: groupGoal.requireApproval ? "pending" : "active",
      targetContribution,
      currentContribution: "0",
      contributionPercentage: 0,
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      isPublic: true,
      notifications: true,
    };

    const collection = await getCollection(GROUP_GOALS_COLLECTION);

    const updateData: any = {
      $push: { members: newMember },
      $set: { updatedAt: new Date() },
    };

    if (!groupGoal.requireApproval) {
      updateData.$inc = { totalMembers: 1, activeMembers: 1 };
    } else {
      updateData.$inc = { totalMembers: 1 };
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(groupGoalId) },
      updateData,
      { returnDocument: "after" }
    );

    return result?.value as GroupGoal | null;
  },

  /**
   * Leave a group goal
   */
  async leaveGroupGoal(
    groupGoalId: string,
    userId: string
  ): Promise<GroupGoal | null> {
    const groupGoal = await this.getGroupGoalById(groupGoalId);

    if (!groupGoal) {
      throw new Error("Group goal not found");
    }

    const member = groupGoal.members.find((m) => m.userId === userId);
    if (!member) {
      throw new Error("User is not a member of this group goal");
    }

    if (member.role === "owner") {
      throw new Error(
        "Owner cannot leave group goal. Transfer ownership first."
      );
    }

    const collection = await getCollection(GROUP_GOALS_COLLECTION);

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(groupGoalId) },
      {
        $set: {
          "members.$[elem].status": "left",
          "members.$[elem].leftAt": new Date(),
          updatedAt: new Date(),
        },
        $inc: { activeMembers: -1 },
      },
      {
        arrayFilters: [{ "elem.userId": userId }],
        returnDocument: "after",
      }
    );

    return result?.value as GroupGoal | null;
  },

  /**
   * Contribute to a group goal
   */
  async contributeToGroupGoal(
    groupGoalId: string,
    userId: string,
    amount: string,
    transactionData: Partial<NewSavingsTransaction>
  ): Promise<{ groupGoal: GroupGoal; transaction: SavingsTransaction }> {
    const groupGoal = await this.getGroupGoalById(groupGoalId);

    if (!groupGoal) {
      throw new Error("Group goal not found");
    }

    if (groupGoal.status !== "active") {
      throw new Error("Cannot contribute to inactive group goal");
    }

    const member = groupGoal.members.find((m) => m.userId === userId);
    if (!member || member.status !== "active") {
      throw new Error("User is not an active member of this group goal");
    }

    // Create transaction record
    const transaction: NewSavingsTransaction = {
      transactionId: this.generateTransactionId(),
      userId,
      goalId: groupGoalId, // Using goalId to reference the group goal
      type: "deposit",
      status: "pending",
      amount,
      tokenAddress: groupGoal.tokenAddress,
      tokenSymbol: groupGoal.tokenSymbol,
      tokenDecimals: groupGoal.tokenDecimals,
      initiatedAt: new Date(),
      paymentMethod: transactionData.paymentMethod || "blockchain",
      ...transactionData,
    };

    const transactionCollection = await getCollection(
      GROUP_TRANSACTIONS_COLLECTION
    );
    const transactionResult = await transactionCollection.insertOne({
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update group goal and member contribution
    const newCurrentAmount = (
      parseFloat(groupGoal.currentAmount) + parseFloat(amount)
    ).toString();
    const newMemberContribution = (
      parseFloat(member.currentContribution) + parseFloat(amount)
    ).toString();

    const collection = await getCollection(GROUP_GOALS_COLLECTION);

    // Calculate new progress
    const newProgress =
      groupGoal.targetAmount !== "0"
        ? Math.min(
            (parseFloat(newCurrentAmount) /
              parseFloat(groupGoal.targetAmount)) *
              100,
            100
          )
        : 0;

    // Update member contribution and recalculate percentages
    const updatedMembers = groupGoal.members.map((m) => {
      if (m.userId === userId) {
        return {
          ...m,
          currentContribution: newMemberContribution,
          lastActiveAt: new Date(),
        };
      }
      return m;
    });

    // Recalculate contribution percentages
    const totalContributions = parseFloat(newCurrentAmount);
    updatedMembers.forEach((m) => {
      if (totalContributions > 0) {
        m.contributionPercentage =
          (parseFloat(m.currentContribution) / totalContributions) * 100;
      }
    });

    const updatedGroupGoal = await collection.findOneAndUpdate(
      { _id: new ObjectId(groupGoalId) },
      {
        $set: {
          currentAmount: newCurrentAmount,
          progress: newProgress,
          members: updatedMembers,
          updatedAt: new Date(),
        },
        $inc: {
          "analytics.totalContributions": 1,
        },
      },
      { returnDocument: "after" }
    );

    return {
      groupGoal: updatedGroupGoal?.value as GroupGoal,
      transaction: {
        ...transaction,
        _id: transactionResult.insertedId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  },

  /**
   * Get group goal statistics for a user
   */
  async getUserGroupGoalStats(userId: string): Promise<GroupGoalStats> {
    const userGroupGoals = await this.getUserGroupGoals(userId);

    const totalGroupGoals = userGroupGoals.length;
    const activeGroupGoals = userGroupGoals.filter(
      (g) => g.status === "active"
    ).length;
    const completedGroupGoals = userGroupGoals.filter(
      (g) => g.status === "completed"
    ).length;

    // Calculate total amount saved by user across all group goals
    const totalAmountSaved = userGroupGoals
      .reduce((sum, groupGoal) => {
        const member = groupGoal.members.find((m) => m.userId === userId);
        return sum + parseFloat(member?.currentContribution || "0");
      }, 0)
      .toString();

    // Calculate total interest earned (proportional to user's contribution)
    const totalInterestEarned = userGroupGoals
      .reduce((sum, groupGoal) => {
        const member = groupGoal.members.find((m) => m.userId === userId);
        if (member && parseFloat(groupGoal.currentAmount) > 0) {
          const userProportion =
            parseFloat(member.currentContribution) /
            parseFloat(groupGoal.currentAmount);
          return (
            sum + parseFloat(groupGoal.totalInterestEarned) * userProportion
          );
        }
        return sum;
      }, 0)
      .toString();

    const totalMembers = userGroupGoals.reduce(
      (sum, g) => sum + g.totalMembers,
      0
    );
    const averageGroupSize =
      totalGroupGoals > 0 ? totalMembers / totalGroupGoals : 0;
    const completionRate =
      totalGroupGoals > 0 ? (completedGroupGoals / totalGroupGoals) * 100 : 0;

    // Calculate popular categories
    const categoryCount: { [key: string]: number } = {};
    userGroupGoals.forEach((g) => {
      categoryCount[g.category] = (categoryCount[g.category] || 0) + 1;
    });

    const popularCategories = Object.entries(categoryCount)
      .map(([category, count]) => ({
        category: category as GoalCategory,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalGroupGoals,
      activeGroupGoals,
      completedGroupGoals,
      totalMembers,
      averageGroupSize,
      totalAmountSaved,
      totalInterestEarned,
      completionRate,
      popularCategories,
    };
  },

  /**
   * Get user's total group savings amount
   */
  async getUserGroupSavingsAmount(userId: string): Promise<string> {
    const userGroupGoals = await this.getUserGroupGoals(userId);

    const totalSavings = userGroupGoals.reduce((sum, groupGoal) => {
      const member = groupGoal.members.find(
        (m) => m.userId === userId && m.status === "active"
      );
      return sum + parseFloat(member?.currentContribution || "0");
    }, 0);

    return totalSavings.toString();
  },

  /**
   * Convert GroupGoal to GroupGoalSummary
   */
  toGroupGoalSummary(groupGoal: GroupGoal): GroupGoalSummary {
    return {
      id: groupGoal._id!.toString(),
      title: groupGoal.title,
      description: groupGoal.description,
      category: groupGoal.category,
      targetAmount: groupGoal.targetAmount,
      currentAmount: groupGoal.currentAmount,
      progress: groupGoal.progress,
      totalMembers: groupGoal.totalMembers,
      activeMembers: groupGoal.activeMembers,
      tokenSymbol: groupGoal.tokenSymbol,
      visibility: groupGoal.visibility,
      status: groupGoal.status,
      ownerId: groupGoal.ownerId,
      createdAt: groupGoal.createdAt,
      targetDate: groupGoal.targetDate,
      icon: groupGoal.icon,
    };
  },

  /**
   * Generate a unique transaction ID
   */
  generateTransactionId(): string {
    return `txn_group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Get group goal leaderboard
   */
  async getGroupGoalLeaderboard(
    groupGoalId: string
  ): Promise<GroupGoalLeaderboard[]> {
    const groupGoal = await this.getGroupGoalById(groupGoalId);

    if (!groupGoal) {
      throw new Error("Group goal not found");
    }

    const activeMembers = groupGoal.members
      .filter((m) => m.status === "active")
      .sort(
        (a, b) =>
          parseFloat(b.currentContribution) - parseFloat(a.currentContribution)
      );

    return activeMembers.map((member, index) => ({
      userId: member.userId,
      username: member.username,
      totalContributions: member.currentContribution,
      contributionCount: 1, // This would need to be calculated from transaction history
      contributionPercentage: member.contributionPercentage,
      rank: index + 1,
      badges: [], // This would be calculated based on achievements
    }));
  },

  /**
   * Search group goals
   */
  async searchGroupGoals(
    query: string,
    userId?: string,
    category?: GoalCategory,
    limit: number = 20
  ): Promise<GroupGoalSummary[]> {
    const collection = await getCollection(GROUP_GOALS_COLLECTION);

    const filter: any = {
      $and: [
        {
          $or: [{ visibility: "public" }, { "members.userId": userId }],
        },
        {
          $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
            { tags: { $in: [new RegExp(query, "i")] } },
          ],
        },
      ],
    };

    if (category) {
      filter.$and.push({ category });
    }

    const groupGoals = (await collection
      .find(filter)
      .limit(limit)
      .toArray()) as GroupGoal[];

    return groupGoals.map(this.toGroupGoalSummary);
  },
};
