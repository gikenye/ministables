import { useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useSession } from "next-auth/react";
import { useCreateGoal } from "./useCreateGoal";
import { useGoals } from "./useGoals";

/**
 * Hook to automatically create a Quick Save goal for new users
 */
export function useInitializeUserGoals(defaultToken: any, chain: any) {
  const { data: session } = useSession();
  const account = useActiveAccount();
  const { goals, loading: goalsLoading } = useGoals();
  const { createGoal } = useCreateGoal();

  const userId = account?.address || session?.user?.address;

  useEffect(() => {
    const initializeQuickSaveGoal = async () => {
      // Only proceed if we have all required data
      if (!userId || !defaultToken || !chain || goalsLoading) {
        return;
      }

      // Check if user already has a Quick Save goal
      const hasQuickSaveGoal = goals.some((goal) => goal.isQuickSave);

      if (!hasQuickSaveGoal) {
        console.log("Creating Quick Save goal for new user...");

        try {
          await createGoal({
            title: "Quick Save",
            description:
              "*Quick save is automatically created and enables you to save when you don't have a goal in mind. Money saved on quick save is transferrable to any goal.",
            category: "quick",
            status: "active",
            currentAmount: "0",
            targetAmount: "0", // No specific target for quick save
            tokenAddress: defaultToken.address,
            tokenSymbol: defaultToken.symbol,
            tokenDecimals: defaultToken.decimals,
            interestRate: 5.0, // 5% annual interest
            isPublic: false,
            allowContributions: false,
            isQuickSave: true,
          });

          console.log("Quick Save goal created successfully");
        } catch (error) {
          console.error("Failed to create Quick Save goal:", error);
        }
      }
    };

    initializeQuickSaveGoal();
  }, [userId, defaultToken, chain, goals, goalsLoading, createGoal]);
}
