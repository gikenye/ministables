import { useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useSession } from "next-auth/react";
import { useQuicksaveGoal } from "./useBackendGoals";
import { reportInfo, reportError } from "@/lib/services/errorReportingService";

/**
 * Hook to initialize user goals with the backend API
 * The backend automatically creates quicksave goals when users make their first deposit
 * This hook just monitors and reports on the initialization status
 */
export function useInitializeUserGoals(defaultToken: any, chain: any) {
  const { data: session } = useSession();
  const account = useActiveAccount();
  const {
    quicksaveGoal,
    loading: quicksaveLoading,
    error,
  } = useQuicksaveGoal(defaultToken?.symbol);

  const userId = account?.address || session?.user?.address;

  useEffect(() => {
    const checkInitializationStatus = async () => {
      // Only proceed if we have all required data
      if (!userId || !defaultToken || !chain) {
        return;
      }

      // Skip if still loading
      if (quicksaveLoading) {
        return;
      }

      if (quicksaveGoal) {
        // User has a quicksave goal from the backend
        reportInfo("User quicksave goal found", {
          component: "useInitializeUserGoals",
          operation: "checkInitializationStatus",
          userId,
          tokenSymbol: defaultToken?.symbol,
          additional: {
            goalId: quicksaveGoal.id,
            currentAmount: quicksaveGoal.totalValue,
          },
        });
      } else if (!error) {
        // No quicksave goal yet, but no error - this is normal for new users
        reportInfo(
          "No quicksave goal found for user (will be created on first deposit)",
          {
            component: "useInitializeUserGoals",
            operation: "checkInitializationStatus",
            userId,
            tokenSymbol: defaultToken?.symbol,
          }
        );
      } else {
        // There was an error fetching the quicksave goal
        reportError(new Error(error), {
          component: "useInitializeUserGoals",
          operation: "checkInitializationStatus",
          userId,
          tokenSymbol: defaultToken?.symbol,
        });
      }
    };

    checkInitializationStatus();
  }, [userId, defaultToken, chain, quicksaveGoal, quicksaveLoading, error]);

  return {
    quicksaveGoal,
    loading: quicksaveLoading,
    error,
    isInitialized: !!quicksaveGoal,
  };
}
