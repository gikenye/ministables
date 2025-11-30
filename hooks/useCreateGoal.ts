import { useState, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useSession } from "next-auth/react";
import { NewGoal, Goal } from "@/lib/models/goal";

interface UseCreateGoalResult {
  createGoal: (goalData: Omit<NewGoal, "userId">) => Promise<Goal | null>;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to create goals via backend API
 */
export function useCreateGoal(): UseCreateGoalResult {
  const { data: session } = useSession();
  const account = useActiveAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = account?.address || session?.user?.address;

  const createGoal = useCallback(
    async (goalData: Omit<NewGoal, "userId">): Promise<Goal | null> => {
      if (!userId) {
        setError("User not authenticated");
        return null;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/user-balances?action=create-goal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vaultAddress:
              (goalData as any).vaultAddress || goalData.tokenAddress,
            targetAmount: goalData.targetAmount, // Already converted to USD
            targetDate: goalData.targetDate ? Math.floor(goalData.targetDate.getTime() / 1000).toString() : "0",
            name: goalData.title,
            creatorAddress: userId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create goal");
        }

        const blockchainResult = await response.json();

        if (!blockchainResult.success) {
          throw new Error("Failed to create goal on blockchain");
        }

        const goal: Goal = {
          _id: { toString: () => blockchainResult.goalId } as any,
          userId,
          title: goalData.title,
          description:
            goalData.description || `Custom goal for ${goalData.title}`,
          category: goalData.category,
          status: "active",
          currentAmount: "0",
          targetAmount: goalData.targetAmount,
          progress: 0,
          tokenAddress: goalData.tokenAddress,
          tokenSymbol: goalData.tokenSymbol,
          tokenDecimals: goalData.tokenDecimals,
          interestRate: goalData.interestRate || 4.0,
          totalInterestEarned: "0",
          isPublic: goalData.isPublic || false,
          allowContributions: goalData.allowContributions || false,
          isQuickSave: goalData.isQuickSave || false,
          createdAt: new Date(),
          updatedAt: new Date(),
          targetDate: goalData.targetDate,
          blockchainGoalId: blockchainResult.goalId,
        };

        return goal;
      } catch (err) {
        console.error("Error creating goal:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  return {
    createGoal,
    loading,
    error,
  };
}
