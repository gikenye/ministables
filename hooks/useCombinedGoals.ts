import { useMemo } from "react";

interface UseCombinedGoalsProps {
  userPortfolio: any;
  userGoals: any[];
}

export function useCombinedGoals({ userPortfolio, userGoals }: UseCombinedGoalsProps) {
  const combinedGoals = useMemo(() => {
    const quickSaveGoal = {
      id: "quicksave",
      title: "Quick Save",
      description: "Save without a specific goal",
      currentAmount: userPortfolio?.totalValueUSD || "0",
      targetAmount: "0",
      progress: 0,
      category: "quick" as const,
      status: "active" as const,
    };

    const mappedUserGoals = userGoals.map((goal: any) => ({
      id: goal._id,
      metaGoalId: goal.metaGoalId,
      title: goal.name,
      name: goal.name,
      description:
        goal.targetDate && goal.targetDate !== "0"
          ? `Target: $${goal.targetAmountUSD} by ${new Date(goal.targetDate).toLocaleDateString()}`
          : `Target: $${goal.targetAmountUSD}`,
      currentAmount: goal.totalProgressUSD?.toString() || "0",
      targetAmount: goal.targetAmountUSD?.toString() || "0",
      progress: Math.min(goal.progressPercent || 0, 100),
      category: "personal" as const,
      status: "active" as const,
      targetAmountUSD: goal.targetAmountUSD,
      targetDate: goal.targetDate,
      creatorAddress: goal.creatorAddress,
      onChainGoals: goal.onChainGoals,
      participants: goal.participants,
      vaultProgress: goal.vaultProgress,
      userBalance: goal.userBalance,
      userBalanceUSD: goal.userBalanceUSD,
      isPublic: goal.isPublic,
      cachedMembers: goal.cachedMembers,
    }));

    return [quickSaveGoal, ...mappedUserGoals];
  }, [userPortfolio, userGoals]);

  return { combinedGoals };
}
