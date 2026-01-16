import { useCallback } from "react";
import { backendApiClient } from "@/lib/services/backendApiService";
import { reportError, reportWarning } from "@/lib/services/errorReportingService";

interface UseDataFetchingProps {
  address?: string;
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

  const fetchUserPortfolio = useCallback(async () => {
    if (!address) return;

    setPortfolioLoading(true);
    setPortfolioError(null);

    try {
      const data = await backendApiClient.getUserPortfolio(address);
      setUserPortfolio(data);
    } catch (error) {
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
      setPortfolioLoading(false);
    }
  }, [address, setUserPortfolio, setPortfolioLoading, setPortfolioError]);

  const fetchUserGoals = useCallback(async () => {
    if (!address) return;
    setGoalsLoading(true);
    setGoalsError(null);
    try {
      const goals = await backendApiClient.getGoalsWithProgress(address);
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
      setGoalsError(error instanceof Error ? error.message : "Failed to load goals");
      setUserGoals([]);
    } finally {
      setGoalsLoading(false);
    }
  }, [address, setUserGoals, setGoalsLoading, setGoalsError]);

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const [leaderboardData, userPortfolioData] = await Promise.all([
        backendApiClient.getLeaderboard(0, 10),
        address ? backendApiClient.getUserPortfolio(address) : null,
      ]);
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
      setLeaderboardError(error instanceof Error ? error.message : "Failed to load leaderboard");
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [address, setLeaderboard, setLeaderboardLoading, setLeaderboardError, setUserScore]);

  const fetchGroupGoals = useCallback(async () => {
    setGroupGoalsLoading(true);
    setGroupGoalsError(null);
    try {
      const response = await backendApiClient.getPublicGoals();
      setGroupGoals(response.goals);
    } catch (error) {
      setGroupGoalsError(error instanceof Error ? error.message : "Failed to load group goals");
      setGroupGoals([]);
    } finally {
      setGroupGoalsLoading(false);
    }
  }, [setGroupGoals, setGroupGoalsLoading, setGroupGoalsError]);

  const fetchMyGroups = useCallback(async () => {
    if (!address) return;
    setMyGroupsLoading(true);
    try {
      const response = await backendApiClient.getMyGroups(address);
      setMyGroups(response);
    } catch (error) {
      reportError("Failed to fetch user's groups", {
        component: "useDataFetching",
        operation: "fetchMyGroups",
        additional: { error },
      });
      setMyGroups(null);
    } finally {
      setMyGroupsLoading(false);
    }
  }, [address, setMyGroups, setMyGroupsLoading]);

  const forceRefresh = useCallback(() => {
    fetchUserPortfolio();
    fetchUserGoals();
    fetchLeaderboard();
  }, [fetchUserPortfolio, fetchUserGoals, fetchLeaderboard]);

  return {
    fetchUserPortfolio,
    fetchUserGoals,
    fetchLeaderboard,
    fetchGroupGoals,
    fetchMyGroups,
    forceRefresh,
  };
}
