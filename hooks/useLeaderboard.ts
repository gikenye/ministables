import { useState, useEffect, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  backendApiClient,
  UserScoreResponse,
  LeaderboardResponse,
} from "@/lib/services/backendApiService";
import { reportError, reportInfo } from "@/lib/services/errorReportingService";

export interface LeaderboardEntry {
  rank: number;
  address: string;
  score: string;
  formattedLeaderboardScore: string;
  isCurrentUser?: boolean;
}

export interface UserScore {
  userAddress: string;
  score: string;
  formattedLeaderboardScore: string;
  rank?: number;
}

interface UseLeaderboardResult {
  leaderboard: LeaderboardEntry[];
  userScore: UserScore | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  total: number;
}

// Legacy interface for backward compatibility
interface LegacyUseLeaderboardResult {
  userScore: string;
  userRank: number | null;
  topUsers: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseLeaderboardOptions {
  initialLimit?: number;
  autoFetch?: boolean;
}

/**
 * Hook for managing leaderboard data from the backend API
 * Integrates with the backend /api/leaderboard endpoint
 */
export function useBackendLeaderboard(
  options: UseLeaderboardOptions = {}
): UseLeaderboardResult {
  const { initialLimit = 10, autoFetch = true } = options;
  const account = useActiveAccount();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userScore, setUserScore] = useState<UserScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLimit, setCurrentLimit] = useState(initialLimit);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Format raw blockchain scores into readable decimal format
  const formatScore = useCallback((scoreString: string): string => {
    try {
      const rawScore = parseFloat(scoreString);
      if (isNaN(rawScore) || rawScore === 0) return "0";

      // Convert from raw blockchain value (e.g., 200999924416749) to decimal (e.g., 0.000201)
      if (rawScore > 1000000000000) {
        // This appears to be a raw blockchain value with 18 decimals
        const converted = rawScore / Math.pow(10, 18);
        return converted.toFixed(6);
      } else if (rawScore > 1000000) {
        // This appears to be a raw blockchain value with 6 decimals
        const converted = rawScore / Math.pow(10, 6);
        return converted.toFixed(6);
      } else {
        // Already in decimal format
        return rawScore.toFixed(6);
      }
    } catch (error) {
      console.warn("Error formatting score:", scoreString, error);
      return "0";
    }
  }, []);

  // Fetch user's individual score
  const fetchUserScore = useCallback(
    async (userAddress?: string) => {
      const address = userAddress || account?.address;
      if (!address) return;

      try {
        reportInfo("Fetching user score from backend", {
          component: "useBackendLeaderboard",
          operation: "fetchUserScore",
          userId: address,
        });

        const params = new URLSearchParams({ userAddress: address });
        const response = await fetch(`/api/leaderboard?${params}`);

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data = await response.json();

        const formattedUserScore: UserScore = {
          userAddress: data.userAddress,
          score: data.score,
          formattedLeaderboardScore:
            data.formattedLeaderboardScore || formatScore(data.score), // Use backend formatted score if available
          rank: data.rank,
        };
        setUserScore(formattedUserScore);
      } catch (err) {
        reportError(err as Error, {
          component: "useBackendLeaderboard",
          operation: "fetchUserScore",
          userId: address,
        });
      }
    },
    [account?.address, formatScore]
  );

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(
    async (start: number = 0, limit: number = initialLimit) => {
      try {
        reportInfo("Fetching leaderboard from backend", {
          component: "useBackendLeaderboard",
          operation: "fetchLeaderboard",
          additional: { start, limit },
        });

        const params = new URLSearchParams({
          start: start.toString(),
          limit: limit.toString(),
        });
        const response = await fetch(`/api/leaderboard?${params}`);

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const data = await response.json();

        const formattedEntries: LeaderboardEntry[] = data.data.map(
          (entry: any) => ({
            rank: entry.rank,
            address: entry.address,
            score: entry.score,
            formattedLeaderboardScore:
              entry.formattedLeaderboardScore || formatScore(entry.score), // Use backend formatted score if available
            isCurrentUser:
              account?.address?.toLowerCase() === entry.address.toLowerCase(),
          })
        );

        // Update state based on whether this is initial load or load more
        if (start === 0) {
          setLeaderboard(formattedEntries);
        } else {
          setLeaderboard((prev) => [...prev, ...formattedEntries]);
        }

        setTotal(parseInt(data.total, 10));
        setHasMore(start + limit < parseInt(data.total, 10));
        setCurrentLimit(start + limit);

        // If user's score exists but doesn't have rank, try to get it from leaderboard
        if (account?.address && start === 0) {
          const userEntry = formattedEntries.find(
            (entry) =>
              entry.address.toLowerCase() === account.address!.toLowerCase()
          );

          if (userEntry) {
            setUserScore((prev) =>
              prev
                ? {
                    ...prev,
                    rank: userEntry.rank,
                  }
                : {
                    userAddress: userEntry.address,
                    score: userEntry.score,
                    formattedLeaderboardScore:
                      userEntry.formattedLeaderboardScore,
                    rank: userEntry.rank,
                  }
            );
          }
        }
      } catch (err) {
        reportError(err as Error, {
          component: "useBackendLeaderboard",
          operation: "fetchLeaderboard",
          additional: { start, limit },
        });
        throw err;
      }
    },
    [account?.address, formatScore, initialLimit]
  );

  // Main refetch function
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch both leaderboard and user score in parallel
      const promises: Promise<void>[] = [fetchLeaderboard(0, initialLimit)];

      if (account?.address) {
        promises.push(fetchUserScore());
      }

      await Promise.all(promises);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch leaderboard data";
      setError(errorMessage);

      reportError(err as Error, {
        component: "useBackendLeaderboard",
        operation: "refetch",
        userId: account?.address,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchLeaderboard, account?.address, initialLimit]);

  // Load more entries for pagination
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    setLoading(true);
    try {
      await fetchLeaderboard(currentLimit, initialLimit);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load more entries"
      );
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, currentLimit, fetchLeaderboard, initialLimit]);

  // Initial load effect
  useEffect(() => {
    if (autoFetch) {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch]);

  // Update user score when account changes
  useEffect(() => {
    if (account?.address && autoFetch) {
      fetchUserScore();
    } else if (!account?.address) {
      setUserScore(null);
    }
  }, [account?.address, autoFetch, fetchUserScore]);

  return {
    leaderboard,
    userScore,
    loading,
    error,
    refetch,
    loadMore,
    hasMore,
    total,
  };
}

/**
 * Legacy hook for backward compatibility - uses backend API but maintains old interface
 */
export function useLeaderboard(): LegacyUseLeaderboardResult {
  const backendHook = useBackendLeaderboard({
    initialLimit: 10,
    autoFetch: true,
  });

  // Transform new interface to legacy interface
  const userScore = backendHook.userScore?.score || "0";
  const userRank = backendHook.userScore?.rank || null;
  const topUsers: LeaderboardEntry[] = backendHook.leaderboard;

  return {
    userScore,
    userRank,
    topUsers,
    loading: backendHook.loading,
    error: backendHook.error,
    refetch: backendHook.refetch,
  };
}

// Helper hook for just getting user score
export function useUserScore(userAddress?: string) {
  const account = useActiveAccount();
  const [userScore, setUserScore] = useState<UserScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = userAddress || account?.address;

  // Format raw blockchain scores into readable decimal format
  const formatScore = useCallback((scoreString: string): string => {
    try {
      const rawScore = parseFloat(scoreString);
      if (isNaN(rawScore) || rawScore === 0) return "0";

      // Convert from raw blockchain value (e.g., 200999924416749) to decimal (e.g., 0.000201)
      if (rawScore > 1000000000000) {
        // This appears to be a raw blockchain value with 18 decimals
        const converted = rawScore / Math.pow(10, 18);
        return converted.toFixed(6);
      } else if (rawScore > 1000000) {
        // This appears to be a raw blockchain value with 6 decimals
        const converted = rawScore / Math.pow(10, 6);
        return converted.toFixed(6);
      } else {
        // Already in decimal format
        return rawScore.toFixed(6);
      }
    } catch (error) {
      console.warn("Error formatting score:", scoreString, error);
      return "0";
    }
  }, []);

  const fetchScore = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const response = await backendApiClient.getUserScore(address);

      setUserScore({
        userAddress: response.userAddress,
        score: response.score,
        formattedLeaderboardScore: formatScore(response.score),
      });

      reportInfo("Individual user score fetched", {
        component: "useUserScore",
        operation: "fetchScore",
        userId: address,
        additional: { score: response.score },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch user score"
      );
      reportError(err as Error, {
        component: "useUserScore",
        operation: "fetchScore",
        userId: address,
      });
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      fetchScore();
    } else {
      setUserScore(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return {
    userScore,
    loading,
    error,
    refetch: fetchScore,
  };
}
