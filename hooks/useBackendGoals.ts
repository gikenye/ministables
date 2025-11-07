import { useState, useEffect, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  backendApiClient,
  GoalDetailsResponse,
  QuicksaveGoalResponse,
  mapTokenSymbolToAsset,
  SupportedAsset,
} from "@/lib/services/backendApiService";
import { getVaultAddress } from "@/config/chainConfig";
import { celo } from "thirdweb/chains";
import { reportError, reportInfo } from "@/lib/services/errorReportingService";

// Enhanced goal interface that combines backend data with frontend needs
export interface BackendGoal
  extends Omit<GoalDetailsResponse, "targetDate" | "createdAt"> {
  title?: string;
  description?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  progress?: number;
  category?:
    | "personal"
    | "retirement"
    | "quick"
    | "emergency"
    | "travel"
    | "education"
    | "business"
    | "health"
    | "home";
  status: "active" | "completed" | "paused" | "cancelled";
  isQuickSave?: boolean;
  targetDate: Date | null;
  createdAt: Date;
  interestRate?: number;
  totalInterestEarned?: string;
  isPublic?: boolean;
  allowContributions?: boolean;
}

interface UseBackendGoalsResult {
  goals: BackendGoal[];
  quicksaveGoal: BackendGoal | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getGoalById: (goalId: string) => Promise<BackendGoal | null>;
  getQuicksaveGoalId: (
    userAddress?: string,
    tokenSymbol?: string
  ) => Promise<string | null>;
}

/**
 * Hook for managing goals through the backend API
 * Integrates with the backend /api/goals endpoint
 */
export function useBackendGoals(
  tokenSymbol: string = "USDC"
): UseBackendGoalsResult {
  const account = useActiveAccount();
  const [goals, setGoals] = useState<BackendGoal[]>([]);
  const [quicksaveGoal, setQuicksaveGoal] = useState<BackendGoal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert backend goal response to frontend goal format
  const convertBackendGoal = useCallback(
    (goalData: GoalDetailsResponse): BackendGoal => {
      const targetDate = goalData.targetDate
        ? new Date(parseInt(goalData.targetDate) * 1000)
        : null;
      const createdAt = new Date(parseInt(goalData.createdAt) * 1000);

      // Calculate progress percentage
      const currentValue = parseFloat(goalData.totalValue || "0");
      const targetValue = parseFloat(goalData.targetAmount || "0");
      const progress =
        targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;

      // Determine status based on backend fields
      let status: "active" | "completed" | "paused" | "cancelled" = "active";
      if (goalData.cancelled) status = "cancelled";
      else if (goalData.completed) status = "completed";

      // Determine if this is a quicksave goal
      const isQuickSave = goalData.metadataURI === "quicksave";

      return {
        ...goalData,
        title: isQuickSave ? "Quick Save" : `Goal ${goalData.id}`,
        description: isQuickSave
          ? "Save without a specific goal"
          : "Custom savings goal",
        tokenSymbol,
        progress,
        status,
        targetDate,
        createdAt,
        isQuickSave,
        category: isQuickSave ? "quick" : "personal",
        isPublic: false,
        allowContributions: false,
      };
    },
    [tokenSymbol]
  );

  // Fetch goal details by ID
  const getGoalById = useCallback(
    async (goalId: string): Promise<BackendGoal | null> => {
      try {
        reportInfo("Fetching goal details from backend", {
          component: "useBackendGoals",
          operation: "getGoalById",
          additional: { goalId },
        });

        const response = await fetch(`/api/backend-goals?goalId=${goalId}`);
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const goalData = (await response.json()) as GoalDetailsResponse;
        return convertBackendGoal(goalData);
      } catch (err) {
        reportError(err as Error, {
          component: "useBackendGoals",
          operation: "getGoalById",
          additional: { goalId },
        });
        return null;
      }
    },
    [convertBackendGoal]
  );

  // Get quicksave goal ID for user
  const getQuicksaveGoalId = useCallback(
    async (
      userAddress?: string,
      tokenSymbolOverride?: string
    ): Promise<string | null> => {
      const address = userAddress || account?.address;
      const symbol = tokenSymbolOverride || tokenSymbol;

      if (!address) {
        setError("No wallet connected");
        return null;
      }

      const asset = mapTokenSymbolToAsset(symbol);
      if (!asset) {
        setError(`Unsupported token: ${symbol}`);
        return null;
      }

      try {
        reportInfo("Fetching quicksave goal ID from backend", {
          component: "useBackendGoals",
          operation: "getQuicksaveGoalId",
          userId: address,
          tokenSymbol: symbol,
        });

        const params = new URLSearchParams({
          userAddress: address,
          tokenSymbol: symbol,
        });
        const response = await fetch(`/api/backend-goals?${params}`);

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data = (await response.json()) as QuicksaveGoalResponse;
        return data.quicksaveGoalId;
      } catch (err) {
        reportError(err as Error, {
          component: "useBackendGoals",
          operation: "getQuicksaveGoalId",
          userId: address,
          tokenSymbol: symbol,
        });
        return null;
      }
    },
    [account?.address, tokenSymbol]
  );

  // Fetch and update quicksave goal
  const fetchQuicksaveGoal = useCallback(async () => {
    if (!account?.address) return;

    try {
      const quicksaveGoalId = await getQuicksaveGoalId();
      if (!quicksaveGoalId) {
        setQuicksaveGoal(null);
        return;
      }

      const goalData = await getGoalById(quicksaveGoalId);
      setQuicksaveGoal(goalData);
    } catch (err) {
      reportError(err as Error, {
        component: "useBackendGoals",
        operation: "fetchQuicksaveGoal",
        userId: account.address,
      });
    }
  }, [account?.address, getQuicksaveGoalId, getGoalById]);

  // Main refetch function
  const refetch = useCallback(async () => {
    if (!account?.address) {
      setGoals([]);
      setQuicksaveGoal(null);
      setError("No wallet connected");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // For now, we'll primarily focus on the quicksave goal
      // In the future, you might want to add an endpoint to fetch all user goals
      await fetchQuicksaveGoal();

      reportInfo("Backend goals refreshed successfully", {
        component: "useBackendGoals",
        operation: "refetch",
        userId: account.address,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to fetch goals from backend";
      setError(errorMessage);

      reportError(err as Error, {
        component: "useBackendGoals",
        operation: "refetch",
        userId: account.address,
      });
    } finally {
      setLoading(false);
    }
  }, [account?.address, fetchQuicksaveGoal]);

  // Initial load effect
  useEffect(() => {
    if (account?.address) {
      refetch();
    } else {
      setGoals([]);
      setQuicksaveGoal(null);
      setError(null);
      setLoading(false);
    }
  }, [account?.address, refetch]);

  // Update goals array to include quicksave goal
  useEffect(() => {
    if (quicksaveGoal) {
      setGoals([quicksaveGoal]);
    } else {
      setGoals([]);
    }
  }, [quicksaveGoal]);

  return {
    goals,
    quicksaveGoal,
    loading,
    error,
    refetch,
    getGoalById,
    getQuicksaveGoalId,
  };
}

// Helper hook specifically for quicksave goal management
export function useQuicksaveGoal(tokenSymbol: string = "USDC") {
  const account = useActiveAccount();
  const [quicksaveGoal, setQuicksaveGoal] = useState<BackendGoal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getQuicksaveGoalId, getGoalById } = useBackendGoals(tokenSymbol);

  const fetchQuicksaveGoal = useCallback(async () => {
    if (!account?.address) return;

    setLoading(true);
    setError(null);

    try {
      const goalId = await getQuicksaveGoalId();
      if (goalId) {
        const goal = await getGoalById(goalId);
        setQuicksaveGoal(goal);
      } else {
        setQuicksaveGoal(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch quicksave goal"
      );
      reportError(err as Error, {
        component: "useQuicksaveGoal",
        operation: "fetchQuicksaveGoal",
        userId: account.address,
        tokenSymbol,
      });
    } finally {
      setLoading(false);
    }
  }, [account?.address, getQuicksaveGoalId, getGoalById, tokenSymbol]);

  useEffect(() => {
    if (account?.address) {
      fetchQuicksaveGoal();
    }
  }, [account?.address, fetchQuicksaveGoal]);

  return {
    quicksaveGoal,
    loading,
    error,
    refetch: fetchQuicksaveGoal,
  };
}
