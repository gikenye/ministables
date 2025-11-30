import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getVaultAddress, VAULT_CONTRACTS } from "@/config/chainConfig";
import { celo } from "thirdweb/chains";

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
  refreshing: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGoals(category?: string): UseGoalsResult {
  const account = useActiveAccount();
  const [goals, setGoals] = useState<FrontendGoal[]>([]);
  const [stats, setStats] = useState<GoalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const userAddress = account?.address;

  const fetchGoals = async () => {
    if (!userAddress) {
      setGoals([]);
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      // Only show loading on initial load, use refreshing for subsequent calls
      if (goals.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      // Fetch user positions directly from consolidated API
      const response = await fetch(`/api/user-balances?userAddress=${userAddress}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user positions');
      }
      
      const data = await response.json();
      console.log('API Response:', data); // Debug log
      console.log('Goals array:', data.goals); // Debug log
      console.log('Goals array length:', data.goals?.length); // Debug log
      const userGoals = data.goals || [];
      const allGoals: FrontendGoal[] = [];
      
      // Convert goals from database
      if (userGoals && Array.isArray(userGoals)) {
        for (const goalData of userGoals) {
          const goal: FrontendGoal = {
            id: goalData.goalId,
            title: goalData.isQuicksave ? `Quick Save (${goalData.asset})` : goalData.name || `Goal ${goalData.goalId}`,
            description: goalData.isQuicksave ? "Save without a specific goal" : "Custom savings goal",
            currentAmount: goalData.userBalanceUSD || goalData.totalValueUSD || "0",
            targetAmount: goalData.targetAmountUSD || "0",
            progress: parseFloat(goalData.progressPercent) || 0,
            icon: goalData.isQuicksave ? "🐷" : "🎯",
            category: goalData.isQuicksave ? "quick" : "personal",
            status: goalData.completed ? "completed" : goalData.cancelled ? "cancelled" : "active",
            tokenSymbol: goalData.asset,
            tokenAddress: goalData.vault || "",
            tokenDecimals: goalData.asset === 'cUSD' ? 18 : 6,
            interestRate: 4.2,
            totalInterestEarned: "0.00",
            createdAt: new Date(parseInt(goalData.createdAt) * 1000),
            updatedAt: new Date(),
            isPublic: false,
            allowContributions: false,
            isQuickSave: goalData.isQuicksave || false,
            blockchainGoalId: goalData.goalId,
          };
          
          allGoals.push(goal);
        }
      }
      
      console.log('Converted goals:', allGoals); // Debug log

      // Filter by category if specified
      const filteredGoals = category 
        ? allGoals.filter(goal => goal.category === category)
        : allGoals;

      setGoals(filteredGoals);

      // Calculate stats
      const activeGoals = filteredGoals.filter((g) => g.status === "active");
      const completedGoals = filteredGoals.filter((g) => g.status === "completed");
      const totalSaved = filteredGoals.reduce(
        (sum, goal) => sum + parseFloat(goal.currentAmount || "0"),
        0
      );
      const totalInterestEarned = filteredGoals.reduce(
        (sum, goal) =>
          sum + parseFloat(goal.totalInterestEarned || "0"),
        0
      );
      const avgProgress =
        activeGoals.length > 0
          ? activeGoals.reduce((sum, goal) => sum + goal.progress, 0) /
            activeGoals.length
          : 0;

      // Calculate total value from goals
      const totalValueFromGoals = filteredGoals.reduce((sum, goal) => sum + parseFloat(goal.currentAmount || "0"), 0);

      setStats({
        totalGoals: filteredGoals.length,
        activeGoals: activeGoals.length,
        completedGoals: completedGoals.length,
        totalSaved: totalValueFromGoals.toString(),
        totalInterestEarned: totalInterestEarned.toString(),
        averageProgress: avgProgress,
      });
    } catch (err) {
      console.error("Error fetching goals:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch goals");
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    refreshing,
    error,
    refetch,
  };
}
