import { ObjectId } from "mongodb";
import { getCollection } from "../mongodb";
import {
  Goal,
  NewGoal,
  GoalUpdate,
  GoalSummary,
  GoalStats,
  GoalContribution,
  GoalMilestone,
  GoalCategory,
  GoalStatus,
} from "../models/goal";
import {
  SavingsTransaction,
  NewSavingsTransaction,
  TransactionType,
  TransactionStatus,
} from "../models/savingsTransaction";
import {
  vaultService,
  VaultDepositGoalIntegration,
  VaultWithdrawalGoalIntegration,
} from "./vaultService";

const GOALS_COLLECTION = "goals";
const TRANSACTIONS_COLLECTION = "savingsTransactions";
const CONTRIBUTIONS_COLLECTION = "goalContributions";
const MILESTONES_COLLECTION = "goalMilestones";

/**
 * Goal service for handling all goal-related operations
 */
export const GoalService = {
  /**
   * Create a new goal for a user
   */
  async createGoal(goalData: NewGoal): Promise<Goal> {
    const collection = await getCollection(GOALS_COLLECTION);

    const goal: Goal = {
      ...goalData,
      progress: 0,
      totalInterestEarned: "0",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(goal);
    const createdGoal = { ...goal, _id: result.insertedId };

    // Blockchain sync removed for production deployment

    return createdGoal;
  },

  /**
   * Create the default Quick Save goal for a new user
   */
  async createQuickSaveGoal(
    userId: string,
    tokenAddress: string,
    tokenSymbol: string,
    tokenDecimals: number
  ): Promise<Goal> {
    const quickSaveGoal: NewGoal = {
      userId,
      title: "Quick Save",
      description:
        "*Quick save is automatically created on registration and enables you to save when you don't have a goal in mind. Money saved on quick save is transferrable to any goal.",
      category: "quick",
      status: "active",
      currentAmount: "0",
      targetAmount: "0", // No specific target for quick save
      tokenAddress,
      tokenSymbol,
      tokenDecimals,
      interestRate: 5.0, // 5% annual interest
      isPublic: false,
      allowContributions: false,
      isQuickSave: true,
    };

    return this.createGoal(quickSaveGoal);
  },

  /**
   * Get all goals for a user
   */
  async getUserGoals(userId: string): Promise<Goal[]> {
    const collection = await getCollection(GOALS_COLLECTION);
    return collection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray() as Promise<Goal[]>;
  },

  /**
   * Get goals by category for a user
   */
  async getUserGoalsByCategory(
    userId: string,
    category: GoalCategory
  ): Promise<Goal[]> {
    const collection = await getCollection(GOALS_COLLECTION);
    return collection
      .find({ userId, category })
      .sort({ createdAt: -1 })
      .toArray() as Promise<Goal[]>;
  },

  /**
   * Get a specific goal by ID
   */
  async getGoalById(goalId: string, userId?: string): Promise<Goal | null> {
    const collection = await getCollection(GOALS_COLLECTION);
    const query: any = { _id: new ObjectId(goalId) };

    if (userId) {
      query.userId = userId;
    }

    return collection.findOne(query) as Promise<Goal | null>;
  },

  /**
   * Get user's Quick Save goal
   */
  async getQuickSaveGoal(userId: string): Promise<Goal | null> {
    const collection = await getCollection(GOALS_COLLECTION);
    return collection.findOne({
      userId,
      isQuickSave: true,
    }) as Promise<Goal | null>;
  },

  /**
   * Update a goal
   */
  async updateGoal(
    goalId: string,
    userId: string,
    update: GoalUpdate
  ): Promise<Goal | null> {
    const collection = await getCollection(GOALS_COLLECTION);

    const updateData = {
      ...update,
      updatedAt: new Date(),
    };

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(goalId), userId },
      { $set: updateData },
      { returnDocument: "after" }
    );

    return result?.value as Goal | null;
  },

  /**
   * Delete a goal (only if balance is 0)
   */
  async deleteGoal(goalId: string, userId: string): Promise<boolean> {
    const goal = await this.getGoalById(goalId, userId);

    if (!goal) {
      throw new Error("Goal not found");
    }

    if (goal.isQuickSave) {
      throw new Error("Cannot delete Quick Save goal");
    }

    if (parseFloat(goal.currentAmount) > 0) {
      throw new Error("Cannot delete goal with remaining balance");
    }

    const collection = await getCollection(GOALS_COLLECTION);
    const result = await collection.deleteOne({
      _id: new ObjectId(goalId),
      userId,
    });

    return result.deletedCount > 0;
  },

  /**
   * Add money to a goal (deposit)
   */
  async depositToGoal(
    goalId: string,
    userId: string,
    amount: string,
    transactionData: Partial<NewSavingsTransaction>
  ): Promise<{ goal: Goal; transaction: SavingsTransaction }> {
    const goal = await this.getGoalById(goalId, userId);

    if (!goal) {
      throw new Error("Goal not found");
    }

    if (goal.status !== "active") {
      throw new Error("Cannot deposit to inactive goal");
    }

    // Create transaction record
    const transaction: NewSavingsTransaction = {
      transactionId: this.generateTransactionId(),
      userId,
      goalId,
      type: "deposit",
      status: "pending",
      paymentMethod: transactionData.paymentMethod || "blockchain",
      amount,
      tokenAddress: goal.tokenAddress,
      tokenSymbol: goal.tokenSymbol,
      tokenDecimals: goal.tokenDecimals,
      initiatedAt: new Date(),
      ...transactionData,
    };

    const transactionCollection = await getCollection(TRANSACTIONS_COLLECTION);
    const transactionResult = await transactionCollection.insertOne({
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update goal balance
    const newAmount = (
      parseFloat(goal.currentAmount) + parseFloat(amount)
    ).toString();
    const newProgress =
      goal.targetAmount !== "0"
        ? Math.min(
            (parseFloat(newAmount) / parseFloat(goal.targetAmount)) * 100,
            100
          )
        : 0;

    const updatedGoal = await this.updateGoal(goalId, userId, {
      currentAmount: newAmount,
      progress: newProgress,
    });

    // Blockchain sync removed for production deployment

    return {
      goal: updatedGoal!,
      transaction: {
        ...transaction,
        _id: transactionResult.insertedId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  },

  /**
   * Withdraw money from a goal
   */
  async withdrawFromGoal(
    goalId: string,
    userId: string,
    amount: string,
    transactionData: Partial<NewSavingsTransaction>
  ): Promise<{ goal: Goal; transaction: SavingsTransaction }> {
    const goal = await this.getGoalById(goalId, userId);

    if (!goal) {
      throw new Error("Goal not found");
    }

    if (parseFloat(goal.currentAmount) < parseFloat(amount)) {
      throw new Error("Insufficient balance");
    }

    // Create transaction record
    const transaction: NewSavingsTransaction = {
      transactionId: this.generateTransactionId(),
      userId,
      goalId,
      type: "withdrawal",
      status: "pending",
      paymentMethod: transactionData.paymentMethod || "blockchain",
      amount,
      tokenAddress: goal.tokenAddress,
      tokenSymbol: goal.tokenSymbol,
      tokenDecimals: goal.tokenDecimals,
      initiatedAt: new Date(),
      ...transactionData,
    };

    const transactionCollection = await getCollection(TRANSACTIONS_COLLECTION);
    const transactionResult = await transactionCollection.insertOne({
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update goal balance
    const newAmount = (
      parseFloat(goal.currentAmount) - parseFloat(amount)
    ).toString();
    const newProgress =
      goal.targetAmount !== "0"
        ? Math.min(
            (parseFloat(newAmount) / parseFloat(goal.targetAmount)) * 100,
            100
          )
        : 0;

    const updatedGoal = await this.updateGoal(goalId, userId, {
      currentAmount: newAmount,
      progress: newProgress,
    });

    return {
      goal: updatedGoal!,
      transaction: {
        ...transaction,
        _id: transactionResult.insertedId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  },

  /**
   * Transfer money between goals
   */
  async transferBetweenGoals(
    fromGoalId: string,
    toGoalId: string,
    userId: string,
    amount: string
  ): Promise<{
    fromGoal: Goal;
    toGoal: Goal;
    transaction: SavingsTransaction;
  }> {
    const fromGoal = await this.getGoalById(fromGoalId, userId);
    const toGoal = await this.getGoalById(toGoalId, userId);

    if (!fromGoal || !toGoal) {
      throw new Error("One or both goals not found");
    }

    if (parseFloat(fromGoal.currentAmount) < parseFloat(amount)) {
      throw new Error("Insufficient balance in source goal");
    }

    if (fromGoal.tokenAddress !== toGoal.tokenAddress) {
      throw new Error("Cannot transfer between different token types");
    }

    // Create transfer transaction
    const transaction: NewSavingsTransaction = {
      transactionId: this.generateTransactionId(),
      userId,
      fromGoalId,
      toGoalId,
      type: "transfer",
      status: "completed", // Transfers are immediate
      amount,
      tokenAddress: fromGoal.tokenAddress,
      tokenSymbol: fromGoal.tokenSymbol,
      tokenDecimals: fromGoal.tokenDecimals,
      initiatedAt: new Date(),
      completedAt: new Date(),
      paymentMethod: "blockchain",
    };

    const transactionCollection = await getCollection(TRANSACTIONS_COLLECTION);
    const transactionResult = await transactionCollection.insertOne({
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update both goals
    const updatedFromGoal = await this.updateGoal(fromGoalId, userId, {
      currentAmount: (
        parseFloat(fromGoal.currentAmount) - parseFloat(amount)
      ).toString(),
      progress:
        fromGoal.targetAmount !== "0"
          ? Math.min(
              ((parseFloat(fromGoal.currentAmount) - parseFloat(amount)) /
                parseFloat(fromGoal.targetAmount)) *
                100,
              100
            )
          : 0,
    });

    const updatedToGoal = await this.updateGoal(toGoalId, userId, {
      currentAmount: (
        parseFloat(toGoal.currentAmount) + parseFloat(amount)
      ).toString(),
      progress:
        toGoal.targetAmount !== "0"
          ? Math.min(
              ((parseFloat(toGoal.currentAmount) + parseFloat(amount)) /
                parseFloat(toGoal.targetAmount)) *
                100,
              100
            )
          : 0,
    });

    return {
      fromGoal: updatedFromGoal!,
      toGoal: updatedToGoal!,
      transaction: {
        ...transaction,
        _id: transactionResult.insertedId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  },

  /**
   * Calculate and add interest to goals
   */
  async calculateInterest(userId: string): Promise<Goal[]> {
    const goals = await this.getUserGoals(userId);
    const updatedGoals: Goal[] = [];

    for (const goal of goals) {
      if (goal.status === "active" && parseFloat(goal.currentAmount) > 0) {
        // Calculate daily interest (annual rate / 365)
        const dailyRate = goal.interestRate / 365 / 100;
        const interestAmount = parseFloat(goal.currentAmount) * dailyRate;

        if (interestAmount > 0) {
          // Add interest transaction
          const interestTransaction: NewSavingsTransaction = {
            transactionId: this.generateTransactionId(),
            userId,
            goalId: goal._id!.toString(),
            type: "interest",
            status: "completed",
            amount: interestAmount.toString(),
            tokenAddress: goal.tokenAddress,
            tokenSymbol: goal.tokenSymbol,
            tokenDecimals: goal.tokenDecimals,
            initiatedAt: new Date(),
            completedAt: new Date(),
            paymentMethod: "blockchain",
            interestData: {
              rate: goal.interestRate,
              periodDays: 1,
              calculatedAt: new Date(),
            },
          };

          const transactionCollection = await getCollection(
            TRANSACTIONS_COLLECTION
          );
          await transactionCollection.insertOne({
            ...interestTransaction,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Update goal with interest
          const newAmount = (
            parseFloat(goal.currentAmount) + interestAmount
          ).toString();
          const newInterestEarned = (
            parseFloat(goal.totalInterestEarned) + interestAmount
          ).toString();

          const updatedGoal = await this.updateGoal(
            goal._id!.toString(),
            userId,
            {
              currentAmount: newAmount,
              totalInterestEarned: newInterestEarned,
              progress:
                goal.targetAmount !== "0"
                  ? Math.min(
                      (parseFloat(newAmount) / parseFloat(goal.targetAmount)) *
                        100,
                      100
                    )
                  : goal.progress,
            }
          );

          if (updatedGoal) {
            updatedGoals.push(updatedGoal);
          }
        }
      }
    }

    return updatedGoals;
  },

  /**
   * Get goal statistics for a user
   */
  async getUserGoalStats(userId: string): Promise<GoalStats> {
    const goals = await this.getUserGoals(userId);

    const activeGoals = goals.filter((g) => g.status === "active").length;
    const completedGoals = goals.filter((g) => g.status === "completed").length;

    const totalSaved = goals
      .reduce((total, goal) => total + parseFloat(goal.currentAmount), 0)
      .toString();

    const totalInterestEarned = goals
      .reduce((total, goal) => total + parseFloat(goal.totalInterestEarned), 0)
      .toString();

    const activeGoalsList = goals.filter((g) => g.status === "active");
    const averageProgress =
      activeGoalsList.length > 0
        ? activeGoalsList.reduce((total, goal) => total + goal.progress, 0) /
          activeGoalsList.length
        : 0;

    return {
      totalGoals: goals.length,
      activeGoals,
      completedGoals,
      totalSaved,
      totalInterestEarned,
      averageProgress,
    };
  },

  /**
   * Get goal summaries for dashboard
   */
  async getUserGoalSummaries(userId: string): Promise<GoalSummary[]> {
    const goals = await this.getUserGoals(userId);

    return goals.map((goal) => ({
      id: goal._id!.toString(),
      title: goal.title,
      category: goal.category,
      currentAmount: goal.currentAmount,
      targetAmount: goal.targetAmount,
      progress: goal.progress,
      tokenSymbol: goal.tokenSymbol,
      icon: goal.icon,
      status: goal.status,
    }));
  },

  /**
   * Get goal transactions
   */
  async getGoalTransactions(
    goalId: string,
    userId: string,
    limit: number = 50
  ): Promise<SavingsTransaction[]> {
    const transactionCollection = await getCollection(TRANSACTIONS_COLLECTION);

    return transactionCollection
      .find({ goalId, userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray() as Promise<SavingsTransaction[]>;
  },

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    additionalData?: Partial<SavingsTransaction>
  ): Promise<SavingsTransaction | null> {
    const transactionCollection = await getCollection(TRANSACTIONS_COLLECTION);

    const updateData: any = {
      status,
      updatedAt: new Date(),
      ...additionalData,
    };

    if (status === "confirmed") {
      updateData.confirmedAt = new Date();
    } else if (status === "completed") {
      updateData.completedAt = new Date();
    }

    const result = await transactionCollection.findOneAndUpdate(
      { transactionId },
      { $set: updateData },
      { returnDocument: "after" }
    );

    return result?.value as SavingsTransaction | null;
  },

  /**
   * Generate a unique transaction ID
   */
  generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Vault Integration Methods

  /**
   * Create a vault deposit transaction for a goal
   * This method bridges the goal system with vault smart contracts
   */
  async createVaultDepositForGoal(
    goalId: string,
    userId: string,
    vaultDeposit: VaultDepositGoalIntegration,
    transactionHash?: string
  ): Promise<{ goal: Goal; transaction: SavingsTransaction }> {
    const goal = await this.getGoalById(goalId, userId);

    if (!goal) {
      throw new Error("Goal not found");
    }

    if (goal.status !== "active") {
      throw new Error("Cannot deposit to inactive goal");
    }

    // Validate vault deposit parameters
    const validation = vaultService.validateGoalDepositParams(vaultDeposit);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Create transaction record with vault data
    const transaction: NewSavingsTransaction = {
      transactionId: this.generateTransactionId(),
      transactionHash,
      userId,
      goalId,
      type: "deposit",
      status: transactionHash ? "confirmed" : "pending",
      paymentMethod: "blockchain",
      amount: vaultDeposit.amount,
      tokenAddress: vaultDeposit.tokenAddress,
      tokenSymbol: vaultDeposit.tokenSymbol,
      tokenDecimals: goal.tokenDecimals,
      initiatedAt: new Date(),
      confirmedAt: transactionHash ? new Date() : undefined,
      contractData: {
        vaultAddress: vaultDeposit.vaultAddress,
        depositId: vaultDeposit.depositId,
        lockTierId: vaultDeposit.lockTierId,
        lockPeriod: vaultDeposit.lockPeriod,
        lockEnd: new Date(Date.now() + vaultDeposit.lockPeriod * 1000),
        contractType: "SupplierVault",
      },
      metadata: {
        ...vaultService.formatVaultDepositTransaction(vaultDeposit).metadata,
        goalIntegration: true,
      },
    };

    const transactionCollection = await getCollection(TRANSACTIONS_COLLECTION);
    const transactionResult = await transactionCollection.insertOne({
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update goal balance
    const newAmount = (
      parseFloat(goal.currentAmount) + parseFloat(vaultDeposit.amount)
    ).toString();
    const newProgress =
      goal.targetAmount !== "0"
        ? Math.min(
            (parseFloat(newAmount) / parseFloat(goal.targetAmount)) * 100,
            100
          )
        : 0;

    const updatedGoal = await this.updateGoal(goalId, userId, {
      currentAmount: newAmount,
      progress: newProgress,
    });

    // Blockchain sync removed for production deployment

    return {
      goal: updatedGoal!,
      transaction: {
        ...transaction,
        _id: transactionResult.insertedId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  },

  /**
   * Create a vault withdrawal transaction for a goal
   */
  async createVaultWithdrawalForGoal(
    goalId: string,
    userId: string,
    vaultWithdrawal: VaultWithdrawalGoalIntegration,
    transactionHash?: string
  ): Promise<{ goal: Goal; transaction: SavingsTransaction }> {
    const goal = await this.getGoalById(goalId, userId);

    if (!goal) {
      throw new Error("Goal not found");
    }

    const withdrawAmount = vaultWithdrawal.withdrawnAmount || "0";

    if (parseFloat(goal.currentAmount) < parseFloat(withdrawAmount)) {
      throw new Error("Insufficient balance in goal");
    }

    // Create transaction record with vault data
    const transaction: NewSavingsTransaction = {
      transactionId: this.generateTransactionId(),
      transactionHash,
      userId,
      goalId,
      type: "withdrawal",
      status: transactionHash ? "confirmed" : "pending",
      paymentMethod: "blockchain",
      amount: withdrawAmount,
      tokenAddress: goal.tokenAddress,
      tokenSymbol: goal.tokenSymbol,
      tokenDecimals: goal.tokenDecimals,
      initiatedAt: new Date(),
      confirmedAt: transactionHash ? new Date() : undefined,
      contractData: {
        vaultAddress: vaultWithdrawal.vaultAddress,
        depositId: vaultWithdrawal.depositId,
        contractType: "SupplierVault",
      },
      metadata: {
        ...vaultService.formatVaultWithdrawalTransaction(vaultWithdrawal)
          .metadata,
        goalIntegration: true,
        yieldEarned: vaultWithdrawal.yieldEarned,
      },
    };

    const transactionCollection = await getCollection(TRANSACTIONS_COLLECTION);
    const transactionResult = await transactionCollection.insertOne({
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update goal balance
    const newAmount = (
      parseFloat(goal.currentAmount) - parseFloat(withdrawAmount)
    ).toString();
    const newProgress =
      goal.targetAmount !== "0"
        ? Math.min(
            (parseFloat(newAmount) / parseFloat(goal.targetAmount)) * 100,
            100
          )
        : 0;

    const updatedGoal = await this.updateGoal(goalId, userId, {
      currentAmount: newAmount,
      progress: newProgress,
    });

    // If yield was earned, create a separate interest transaction
    if (
      vaultWithdrawal.yieldEarned &&
      parseFloat(vaultWithdrawal.yieldEarned) > 0
    ) {
      await this.createInterestTransaction(
        goalId,
        userId,
        vaultWithdrawal.yieldEarned,
        {
          vaultAddress: vaultWithdrawal.vaultAddress,
          depositId: vaultWithdrawal.depositId,
        }
      );
    }

    return {
      goal: updatedGoal!,
      transaction: {
        ...transaction,
        _id: transactionResult.insertedId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  },

  /**
   * Create an interest/yield transaction for vault earnings
   */
  async createInterestTransaction(
    goalId: string,
    userId: string,
    yieldAmount: string,
    vaultData: { vaultAddress: string; depositId: number }
  ): Promise<SavingsTransaction> {
    const goal = await this.getGoalById(goalId, userId);

    if (!goal) {
      throw new Error("Goal not found");
    }

    const transaction: NewSavingsTransaction = {
      transactionId: this.generateTransactionId(),
      userId,
      goalId,
      type: "interest",
      status: "completed",
      paymentMethod: "blockchain",
      amount: yieldAmount,
      tokenAddress: goal.tokenAddress,
      tokenSymbol: goal.tokenSymbol,
      tokenDecimals: goal.tokenDecimals,
      initiatedAt: new Date(),
      confirmedAt: new Date(),
      completedAt: new Date(),
      contractData: {
        vaultAddress: vaultData.vaultAddress,
        depositId: vaultData.depositId,
        contractType: "SupplierVault",
      },
      description: "Vault yield earnings",
      metadata: {
        source: "vault_yield",
        goalIntegration: true,
      },
    };

    const transactionCollection = await getCollection(TRANSACTIONS_COLLECTION);
    const transactionResult = await transactionCollection.insertOne({
      ...transaction,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update goal's total interest earned
    const newInterestEarned = (
      parseFloat(goal.totalInterestEarned || "0") + parseFloat(yieldAmount)
    ).toString();

    await this.updateGoal(goalId, userId, {
      totalInterestEarned: newInterestEarned,
    });

    return {
      ...transaction,
      _id: transactionResult.insertedId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Get vault deposits for a specific goal
   */
  async getGoalVaultDeposits(
    goalId: string,
    userId: string
  ): Promise<SavingsTransaction[]> {
    const transactionCollection = await getCollection(TRANSACTIONS_COLLECTION);
    return transactionCollection
      .find({
        goalId,
        userId,
        type: "deposit",
        paymentMethod: "blockchain",
        "contractData.contractType": "SupplierVault",
      })
      .sort({ createdAt: -1 })
      .toArray() as Promise<SavingsTransaction[]>;
  },

  /**
   * Get vault configuration for supported chains
   */
  getVaultConfigForGoals(chainId: number) {
    return vaultService.getVaultConfig(chainId);
  },

  /**
   * Prepare vault deposit data for a goal transaction
   */
  prepareGoalVaultDeposit(params: {
    chainId: number;
    tokenSymbol: string;
    amount: string;
    lockPeriod: number;
    userId: string;
    goalId: string;
  }): VaultDepositGoalIntegration {
    return vaultService.prepareGoalVaultDeposit(params);
  },
};
