import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useActiveAccount } from "thirdweb/react";
import {
  GroupGoal,
  GroupGoalSummary,
  GroupGoalStats,
} from "@/lib/models/groupGoal";

interface UseGroupGoalsResult {
  groupGoals: GroupGoalSummary[];
  stats: GroupGoalStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch user group goals from the API
 */
export function useGroupGoals(
  type: "user" | "owned" | "public" = "user"
): UseGroupGoalsResult {
  const { data: session } = useSession();
  const account = useActiveAccount();
  const [groupGoals, setGroupGoals] = useState<GroupGoalSummary[]>([]);
  const [stats, setStats] = useState<GroupGoalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = account?.address || session?.user?.address;

  const fetchGroupGoals = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams({ type });
      if (userId && type !== "public") {
        params.append("userId", userId);
      }

      // Fetch group goals
      const response = await fetch(`/api/group-goals?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch group goals: ${response.statusText}`);
      }

      const data = await response.json();
      setGroupGoals(data.groupGoals || []);

      // Fetch stats if it's user-specific data
      if (userId && type === "user") {
        try {
          const statsResponse = await fetch(
            `/api/group-goals/stats?userId=${userId}`
          );
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            setStats(statsData.stats);
          }
        } catch (statsError) {
          console.warn("Failed to fetch group goal stats:", statsError);
          // Don't fail the entire request if stats fail
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch group goals"
      );
      console.error("Error fetching group goals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (type === "public" || userId) {
      fetchGroupGoals();
    } else {
      // Clear state when no user
      setGroupGoals([]);
      setStats(null);
      setError(null);
      setLoading(false);
    }
  }, [userId, type]);

  return {
    groupGoals,
    stats,
    loading,
    error,
    refetch: fetchGroupGoals,
  };
}

/**
 * Hook to get user's total group savings amount
 */
export function useGroupSavingsAmount(): {
  amount: string;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { data: session } = useSession();
  const account = useActiveAccount();
  const [amount, setAmount] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = account?.address || session?.user?.address;

  const fetchAmount = async () => {
    if (!userId) {
      // Initialize default values
      setAmount("0");
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // We'll calculate this from the stats for now
      // In the future, we could create a dedicated endpoint
      const response = await fetch(`/api/group-goals/stats?userId=${userId}`);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch group savings amount: ${response.statusText}`
        );
      }

      const data = await response.json();
      setAmount(data.stats?.totalAmountSaved || "0");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch group savings amount"
      );
      console.error("Error fetching group savings amount:", err);
      setAmount("0"); // Default to 0 on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmount();
  }, [userId]);

  return {
    amount,
    loading,
    error,
    refetch: fetchAmount,
  };
}
