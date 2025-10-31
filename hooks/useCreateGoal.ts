import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useSession } from "next-auth/react";
import { NewGoal, Goal } from "@/lib/models/goal";

interface UseCreateGoalResult {
  createGoal: (goalData: Omit<NewGoal, "userId">) => Promise<Goal | null>;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to create goals via the API
 */
export function useCreateGoal(): UseCreateGoalResult {
  const { data: session } = useSession();
  const account = useActiveAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = account?.address || session?.user?.address;

  const createGoal = async (
    goalData: Omit<NewGoal, "userId">
  ): Promise<Goal | null> => {
    if (!userId) {
      setError("User not authenticated");
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          ...goalData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to create goal: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data.goal;
    } catch (err) {
      console.error("Error creating goal:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    createGoal,
    loading,
    error,
  };
}
