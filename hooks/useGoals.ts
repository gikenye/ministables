import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";

export interface FrontendGoal {
  id: string;
  title: string;
  description?: string;
  currentAmount: string;
  targetAmount: string;
  progress: number;
  icon?: string;
  category: "personal" | "retirement" | "quick";
  status: "active" | "completed" | "paused" | "cancelled";
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  interestRate: number;
  totalInterestEarned: string;
  createdAt: Date;
  updatedAt: Date;
  targetDate?: Date;
  completedAt?: Date;
  isPublic: boolean;
  allowContributions: boolean;
  isQuickSave: boolean;
  blockchainGoalId?: string;
}

export interface GoalStats {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalSaved: string;
  totalInterestEarned: string;
  averageProgress: number;
}

interface UseGoalsResult {
  goals: FrontendGoal[];
  stats: GoalStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGoals(category?: string): UseGoalsResult {
  const account = useActiveAccount();
  const [goals, setGoals] = useState<FrontendGoal[]>([]);
  const [stats, setStats] = useState<GoalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userAddress = account?.address;

  const fetchGoals = async () => {
    if (!userAddress) {
      setGoals([]);
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/goals?userId=${userAddress}${category ? `&category=${category}` : ""}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setGoals([]);
          setStats({
            totalGoals: 0,
            activeGoals: 0,
            completedGoals: 0,
            totalSaved: "0",
            totalInterestEarned: "0",
            averageProgress: 0,
          });
          setLoading(false);
          return;
        }
        throw new Error(`Failed to fetch goals: ${response.statusText}`);
      }

      const data = await response.json();
      const dbGoals = data.goals || [];

      const userGoals: FrontendGoal[] = dbGoals.map((goal: any) => ({
        id: goal._id?.toString() || goal.id,
        title: goal.title || "Untitled Goal",
        description: goal.description,
        currentAmount: goal.currentAmount || "0",
        targetAmount: goal.targetAmount || "0",
        progress: goal.progress || 0,
        icon: goal.icon,
        category: goal.category || "personal",
        status: goal.status || "active",
        tokenSymbol: goal.tokenSymbol || "USDC",
        tokenAddress: goal.tokenAddress || "",
        tokenDecimals: goal.tokenDecimals || 6,
        interestRate: goal.interestRate || 0,
        totalInterestEarned: goal.totalInterestEarned || "0",
        createdAt: goal.createdAt ? new Date(goal.createdAt) : new Date(),
        updatedAt: goal.updatedAt ? new Date(goal.updatedAt) : new Date(),
        targetDate: goal.targetDate ? new Date(goal.targetDate) : undefined,
        completedAt: goal.completedAt ? new Date(goal.completedAt) : undefined,
        isPublic: goal.isPublic || false,
        allowContributions: goal.allowContributions || false,
        isQuickSave: goal.isQuickSave || false,
        blockchainGoalId: goal.blockchainGoalId,
      }));

      setGoals(userGoals);

      const activeGoals = userGoals.filter((g) => g.status === "active");
      const completedGoals = userGoals.filter((g) => g.status === "completed");
      const totalSaved = userGoals.reduce(
        (sum, goal) => sum + parseFloat(goal.currentAmount || "0"),
        0
      );
      const totalInterestEarned = userGoals.reduce(
        (sum, goal) =>
          sum + parseFloat((goal as any).totalInterestEarned || "0"),
        0
      );
      const avgProgress =
        activeGoals.length > 0
          ? activeGoals.reduce((sum, goal) => sum + goal.progress, 0) /
            activeGoals.length
          : 0;

      setStats({
        totalGoals: userGoals.length,
        activeGoals: activeGoals.length,
        completedGoals: completedGoals.length,
        totalSaved: totalSaved.toString(),
        totalInterestEarned: totalInterestEarned.toString(),
        averageProgress: avgProgress,
      });
    } catch (err) {
      console.error("Error fetching goals:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch goals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [userAddress, category]);

  const refetch = async () => {
    await fetchGoals();
  };

  return {
    goals,
    stats,
    loading,
    error,
    refetch,
  };
}
