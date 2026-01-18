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

    const getGoalProgressUsd = (goal: any) => {
      const directProgress =
        goal.totalProgressUSD ??
        goal.currentAmountUSD ??
        goal.userBalanceUSD ??
        goal.totalContributedUSD ??
        goal.totalContributedUsd;
      if (typeof directProgress === "number") return directProgress;
      if (typeof directProgress === "string" && directProgress !== "") {
        const parsed = Number(directProgress);
        if (Number.isFinite(parsed)) return parsed;
      }
      const targetAmount = Number(goal.targetAmountUSD);
      const progressPercent = Number(goal.progressPercent);
      if (Number.isFinite(targetAmount) && Number.isFinite(progressPercent) && targetAmount > 0 && progressPercent > 0) {
        return (targetAmount * progressPercent) / 100;
      }
      return 0;
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
      currentAmount: getGoalProgressUsd(goal).toString(),
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
