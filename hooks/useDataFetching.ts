import { useCallback, useEffect, useRef } from "react";
import { backendApiClient } from "@/lib/services/backendApiService";
import { reportError, reportWarning } from "@/lib/services/errorReportingService";

interface UseDataFetchingProps {
  address?: string;
  chainId?: number;
  setUserPortfolio: (data: any) => void;
  setPortfolioLoading: (loading: boolean) => void;
  setPortfolioError: (error: string | null) => void;
  setUserGoals: (goals: any[]) => void;
  setGoalsLoading: (loading: boolean) => void;
  setGoalsError: (error: string | null) => void;
  setLeaderboard: (data: any[]) => void;
  setLeaderboardLoading: (loading: boolean) => void;
  setLeaderboardError: (error: string | null) => void;
  setUserScore: (score: { rank: number; formattedLeaderboardScore: string } | null) => void;
  setGroupGoals: (goals: any[]) => void;
  setGroupGoalsLoading: (loading: boolean) => void;
  setGroupGoalsError: (error: string | null) => void;
  setMyGroups: (groups: any) => void;
  setMyGroupsLoading: (loading: boolean) => void;
}

export function useDataFetching(props: UseDataFetchingProps) {
  const {
    address,
    chainId,
    setUserPortfolio,
    setPortfolioLoading,
    setPortfolioError,
    setUserGoals,
    setGoalsLoading,
    setGoalsError,
    setLeaderboard,
    setLeaderboardLoading,
    setLeaderboardError,
    setUserScore,
    setGroupGoals,
    setGroupGoalsLoading,
    setGroupGoalsError,
    setMyGroups,
    setMyGroupsLoading,
  } = props;

  // Track the latest address so we can ignore stale async results after disconnect/account switch
  const addressRef = useRef<string | undefined>(address);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  // Per-operation request ids so only the latest result applies
  const portfolioReqIdRef = useRef(0);
  const goalsReqIdRef = useRef(0);
  const leaderboardReqIdRef = useRef(0);
  const groupGoalsReqIdRef = useRef(0);
  const myGroupsReqIdRef = useRef(0);

  // Abort controllers for fetch() calls
  const portfolioAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      portfolioAbortRef.current?.abort();
    };
  }, []);

  const fetchUserPortfolio = useCallback(async () => {
    if (!address) return;

    const reqId = ++portfolioReqIdRef.current;
    const reqAddress = address;

    setPortfolioLoading(true);
    setPortfolioError(null);

    try {
      const data = await backendApiClient.getUserPortfolio(address, chainId);
      if (portfolioReqIdRef.current !== reqId || addressRef.current !== reqAddress) return;
      setUserPortfolio(data);
    } catch (error) {
      if (portfolioReqIdRef.current !== reqId || addressRef.current !== reqAddress) return;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setPortfolioError(errorMessage);
      setUserPortfolio({
        totalValueUSD: "0",
        formattedLeaderboardScore: "0.00",
        leaderboardRank: 0,
        assetBalances: [],
      });
      reportError("Failed to fetch user portfolio", {
        component: "useDataFetching",
        operation: "fetchUserPortfolio",
        additional: { error: errorMessage },
      });
    } finally {
      if (portfolioReqIdRef.current === reqId && addressRef.current === reqAddress) {
        setPortfolioLoading(false);
      }
    }
  }, [address, chainId, setUserPortfolio, setPortfolioLoading, setPortfolioError]);

  const refreshUserPortfolio = useCallback(async (options?: { silent?: boolean }) => {
    if (!address) return;

    const reqId = ++portfolioReqIdRef.current;
    const reqAddress = address;

    // Cancel any in-flight portfolio refresh
    portfolioAbortRef.current?.abort();
    const controller = new AbortController();
    portfolioAbortRef.current = controller;

    const shouldSetLoading = !options?.silent;
    if (shouldSetLoading) {
      setPortfolioLoading(true);
      setPortfolioError(null);
    }

    try {
      const params = new URLSearchParams({ userAddress: address });
      if (chainId) params.set("chainId", String(chainId));
      const response = await fetch(`/api/user-positions?${params}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          cache: "no-store",
        });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      if (portfolioReqIdRef.current !== reqId || addressRef.current !== reqAddress) return;
      setUserPortfolio(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (portfolioReqIdRef.current !== reqId || addressRef.current !== reqAddress) return;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (shouldSetLoading) {
        setPortfolioError(errorMessage);
        setUserPortfolio({
          totalValueUSD: "0",
          formattedLeaderboardScore: "0.00",
          leaderboardRank: 0,
          assetBalances: [],
        });
      }
      reportError("Failed to refresh user portfolio", {
        component: "useDataFetching",
        operation: "refreshUserPortfolio",
        additional: { error: errorMessage },
      });
    } finally {
      if (portfolioReqIdRef.current === reqId && addressRef.current === reqAddress) {
        // Always clear loading for the latest request so a silent refresh can't leave it stuck.
        setPortfolioLoading(false);
      }
    }
  }, [address, chainId, setUserPortfolio, setPortfolioLoading, setPortfolioError]);

  const fetchUserGoals = useCallback(async () => {
    if (!address) return;
    const reqId = ++goalsReqIdRef.current;
    const reqAddress = address;
    setGoalsLoading(true);
    setGoalsError(null);
    try {
      const goals = await backendApiClient.getGoalsWithProgress(
        address,
        chainId
      );
      if (goalsReqIdRef.current !== reqId || addressRef.current !== reqAddress) return;
      setUserGoals(goals);

      const completedGoals = goals.filter((goal) => goal.progressPercent >= 100 && goal.metaGoalId);
      if (completedGoals.length > 0) {
        Promise.all(
          completedGoals.map((goal) =>
            fetch("/api/xp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ metaGoalId: goal.metaGoalId }),
            }).catch((err) => {
              reportWarning("failed to award XP for completed goal", {
                component: "useDataFetching",
                operation: "fetchUserGoals",
                additional: { metaGoalId: goal.metaGoalId, error: err },
              });
            })
          )
        );
      }
    } catch (error) {
      if (goalsReqIdRef.current !== reqId || addressRef.current !== reqAddress) return;
      setGoalsError(error instanceof Error ? error.message : "Failed to load goals");
      setUserGoals([]);
    } finally {
      if (goalsReqIdRef.current === reqId && addressRef.current === reqAddress) {
        setGoalsLoading(false);
      }
    }
  }, [address, chainId, setUserGoals, setGoalsLoading, setGoalsError]);

  const fetchLeaderboard = useCallback(async () => {
    const reqId = ++leaderboardReqIdRef.current;
    const reqAddress = address;
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const [leaderboardData, userPortfolioData] = await Promise.all([
        backendApiClient.getLeaderboard(0, 10, chainId),
        address ? backendApiClient.getUserPortfolio(address, chainId) : null,
      ]);
      if (leaderboardReqIdRef.current !== reqId || addressRef.current !== reqAddress) return;
      setLeaderboard(
        leaderboardData.users.map((entry: any) => ({
          ...entry,
          isCurrentUser: address?.toLowerCase() === entry.userAddress?.toLowerCase(),
        }))
      );

      const userEntry = leaderboardData.users.find(
        (entry: any) => address?.toLowerCase() === entry.userAddress?.toLowerCase()
      );

      if (userEntry) {
        setUserScore({
          rank: userEntry.rank,
          formattedLeaderboardScore: userEntry.formattedLeaderboardScore,
        });
      } else if (userPortfolioData) {
        setUserScore({
          rank: userPortfolioData.leaderboardRank,
          formattedLeaderboardScore: userPortfolioData.formattedLeaderboardScore,
        });
      }
    } catch (error) {
      if (leaderboardReqIdRef.current !== reqId || addressRef.current !== reqAddress) return;
      setLeaderboardError(error instanceof Error ? error.message : "Failed to load leaderboard");
      setLeaderboard([]);
    } finally {
      if (leaderboardReqIdRef.current === reqId && addressRef.current === reqAddress) {
        setLeaderboardLoading(false);
      }
    }
  }, [address, chainId, setLeaderboard, setLeaderboardLoading, setLeaderboardError, setUserScore]);

  const fetchGroupGoals = useCallback(async () => {
    const reqId = ++groupGoalsReqIdRef.current;
    setGroupGoalsLoading(true);
    setGroupGoalsError(null);
    try {
      const response = await backendApiClient.getPublicGoals(chainId);
      if (groupGoalsReqIdRef.current !== reqId) return;
      setGroupGoals(response.goals);
    } catch (error) {
      if (groupGoalsReqIdRef.current !== reqId) return;
      setGroupGoalsError(error instanceof Error ? error.message : "Failed to load group goals");
      setGroupGoals([]);
    } finally {
      if (groupGoalsReqIdRef.current === reqId) {
        setGroupGoalsLoading(false);
      }
    }
  }, [chainId, setGroupGoals, setGroupGoalsLoading, setGroupGoalsError]);

  const fetchMyGroups = useCallback(async () => {
    if (!address) return;
    const reqId = ++myGroupsReqIdRef.current;
    const reqAddress = address;
    setMyGroupsLoading(true);
    try {
      const response = await backendApiClient.getMyGroups(address, chainId);
      if (myGroupsReqIdRef.current !== reqId || addressRef.current !== reqAddress) return;
      // Show base group data immediately, then enrich with progress later.
      setMyGroups(response);
      setMyGroupsLoading(false);
      let goalsWithProgress: any[] = [];
      try {
        goalsWithProgress = await backendApiClient.getGoalsWithProgress(
          address,
          chainId
        );
      } catch (error) {
        reportWarning("Failed to fetch group goal progress details", {
          component: "useDataFetching",
          operation: "fetchMyGroups",
          additional: { error },
        });
      }
      if (!goalsWithProgress.length) {
        return;
      }

      const progressByMetaGoalId = new Map(
        goalsWithProgress.map((goal) => [goal.metaGoalId, goal])
      );
      const mergeGoals = (goals: any[]) =>
        goals.map((goal) => {
          const progress = progressByMetaGoalId.get(goal.metaGoalId);
          if (!progress) return goal;
          return {
            ...goal,
            totalProgressUSD: progress.totalProgressUSD ?? goal.totalProgressUSD,
            progressPercent: progress.progressPercent ?? goal.progressPercent,
            currentAmountUSD: progress.totalProgressUSD ?? goal.currentAmountUSD,
            cachedMembers: progress.cachedMembers ?? goal.cachedMembers,
            participants: progress.participants ?? goal.participants,
            invitedUsers: progress.invitedUsers ?? goal.invitedUsers,
            onChainGoals: progress.onChainGoals ?? goal.onChainGoals,
            vaultProgress: progress.vaultProgress ?? goal.vaultProgress,
            userBalance: progress.userBalance ?? goal.userBalance,
            userBalanceUSD: progress.userBalanceUSD ?? goal.userBalanceUSD,
          };
        });
      if (myGroupsReqIdRef.current !== reqId || addressRef.current !== reqAddress) return;
      setMyGroups({
        ...response,
        public: {
          ...response.public,
          goals: mergeGoals(response.public?.goals || []),
        },
        private: {
          ...response.private,
          goals: mergeGoals(response.private?.goals || []),
        },
      });
    } catch (error) {
      if (myGroupsReqIdRef.current !== reqId || addressRef.current !== reqAddress) return;
      reportError("Failed to fetch user's groups", {
        component: "useDataFetching",
        operation: "fetchMyGroups",
        additional: { error },
      });
      setMyGroups(null);
      if (myGroupsReqIdRef.current === reqId && addressRef.current === reqAddress) {
        setMyGroupsLoading(false);
      }
      return;
    }
    if (myGroupsReqIdRef.current === reqId && addressRef.current === reqAddress) {
      setMyGroupsLoading(false);
    }
  }, [address, chainId, setMyGroups, setMyGroupsLoading]);

  const forceRefresh = useCallback(() => {
    refreshUserPortfolio();
    fetchUserGoals();
    fetchLeaderboard();
  }, [refreshUserPortfolio, fetchUserGoals, fetchLeaderboard]);

  return {
    fetchUserPortfolio,
    refreshUserPortfolio,
    fetchUserGoals,
    fetchLeaderboard,
    fetchGroupGoals,
    fetchMyGroups,
    forceRefresh,
  };
}
