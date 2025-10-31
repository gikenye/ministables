import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useActiveAccount } from "thirdweb/react";
import { Goal, GoalStats } from "@/lib/models/goal";
import { FrontendGoal, apiGoalsToFrontend } from "@/lib/utils/goalTransforms";

interface UseGoalsResult {
  goals: FrontendGoal[];
  stats: GoalStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch user goals from the API
 */
export function useGoals(category?: string): UseGoalsResult {
  const { data: session } = useSession();
  const account = useActiveAccount();
  const [goals, setGoals] = useState<FrontendGoal[]>([]);
  const [stats, setStats] = useState<GoalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = account?.address || session?.user?.address;

  const fetchGoals = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams({ userId });
      if (category) {
        params.append("category", category);
      }

      const response = await fetch(`/api/goals?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch goals: ${response.statusText}`);
      }

      const data = await response.json();
      const apiGoals: Goal[] = data.goals || [];
      const frontendGoals = apiGoalsToFrontend(apiGoals);
      setGoals(frontendGoals);

      // Fetch stats if needed (separate endpoint or calculate client-side)
      // For now, calculate basic stats from goals
      if (apiGoals.length > 0) {
        const totalGoals = apiGoals.length;
        const activeGoals = apiGoals.filter(
          (g: Goal) => g.status === "active"
        ).length;
        const completedGoals = apiGoals.filter(
          (g: Goal) => g.status === "completed"
        ).length;

        const totalSaved = apiGoals
          .reduce((sum: number, goal: Goal) => {
            return sum + parseFloat(goal.currentAmount || "0");
          }, 0)
          .toString();

        const totalInterestEarned = apiGoals
          .reduce((sum: number, goal: Goal) => {
            return sum + parseFloat(goal.totalInterestEarned || "0");
          }, 0)
          .toString();

        const averageProgress =
          activeGoals > 0
            ? apiGoals
                .filter((g: Goal) => g.status === "active")
                .reduce((sum: number, goal: Goal) => sum + goal.progress, 0) /
              activeGoals
            : 0;

        setStats({
          totalGoals,
          activeGoals,
          completedGoals,
          totalSaved,
          totalInterestEarned,
          averageProgress,
        });
      } else {
        setStats({
          totalGoals: 0,
          activeGoals: 0,
          completedGoals: 0,
          totalSaved: "0",
          totalInterestEarned: "0",
          averageProgress: 0,
        });
      }
    } catch (err) {
      console.error("Error fetching goals:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [userId, category]);

  return {
    goals,
    stats,
    loading,
    error,
    refetch: fetchGoals,
  };
}
