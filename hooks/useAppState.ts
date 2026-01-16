import { useState } from "react";
import type { GroupSavingsGoal } from "@/lib/services/backendApiService";

export function useAppState() {
  // UI State
  const [saveActionsModalOpen, setSaveActionsModalOpen] = useState(false);
  const [depositMethod, setDepositMethod] = useState<"ONCHAIN" | "MPESA">(
    "ONCHAIN"
  );
  const [showBalances, setShowBalances] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<"goals" | "groups" | "leaderboard" | "profile">("goals");
  const [announcements, setAnnouncements] = useState<string[]>([]);

  // Portfolio State
  const [userPortfolio, setUserPortfolio] = useState<any>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  // Goals State
  const [userGoals, setUserGoals] = useState<any[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [userScore, setUserScore] = useState<{ rank: number; formattedLeaderboardScore: string } | null>(null);

  // Group Goals State
  const [groupGoals, setGroupGoals] = useState<GroupSavingsGoal[]>([]);
  const [groupGoalsLoading, setGroupGoalsLoading] = useState(false);
  const [groupGoalsError, setGroupGoalsError] = useState<string | null>(null);
  const [myGroups, setMyGroups] = useState<any>(null);
  const [myGroupsLoading, setMyGroupsLoading] = useState(false);

  // Quick Save Modal State
  const [quickSaveDetailsOpen, setQuickSaveDetailsOpen] = useState(false);
  const [quickSaveAmountOpen, setQuickSaveAmountOpen] = useState(false);
  const [quickSaveConfirmationOpen, setQuickSaveConfirmationOpen] = useState(false);
  const [quickSaveAmount, setQuickSaveAmount] = useState("100");

  // Goal Modal State
  const [goalDetailsOpen, setGoalDetailsOpen] = useState(false);
  const [goalAmountOpen, setGoalAmountOpen] = useState(false);
  const [goalConfirmationOpen, setGoalConfirmationOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [goalAmount, setGoalAmount] = useState("100");

  // Custom Goal Modal State
  const [customGoalModalOpen, setCustomGoalModalOpen] = useState(false);
  const [customGoalForm, setCustomGoalForm] = useState({
    name: "",
    amount: "",
    timeline: "3",
    category: "custom",
  });
  const [customGoalLoading, setCustomGoalLoading] = useState(false);

  // Group Goal Modal State
  const [createGroupGoalModalOpen, setCreateGroupGoalModalOpen] = useState(false);
  const [groupGoalForm, setGroupGoalForm] = useState({
    name: "",
    amount: "",
    timeline: "3",
    isPublic: true,
  });
  const [createGroupGoalLoading, setCreateGroupGoalLoading] = useState(false);

  // Join Goal Modal State
  const [joinGoalModalOpen, setJoinGoalModalOpen] = useState(false);
  const [selectedGoalToJoin, setSelectedGoalToJoin] = useState<GroupSavingsGoal | null>(null);
  const [joinGoalLoading, setJoinGoalLoading] = useState(false);
  const [joinGoalError, setJoinGoalError] = useState<string | null>(null);

  // Withdrawal Modal State
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [withdrawActionsModalOpen, setWithdrawActionsModalOpen] = useState(false);
  const [mobileOfframpModalOpen, setMobileOfframpModalOpen] = useState(false);

  // Onramp Modal State
  const [showOnrampModal, setShowOnrampModal] = useState(false);
  const [selectedTokenForOnramp, setSelectedTokenForOnramp] = useState("");
  const [copied, setCopied] = useState(false);

  const toggleBalanceVisibility = () => setShowBalances(!showBalances);

  return {
    // UI State
    saveActionsModalOpen,
    setSaveActionsModalOpen,
    depositMethod,
    setDepositMethod,
    showBalances,
    setShowBalances,
    isOnline,
    setIsOnline,
    activeTab,
    setActiveTab,
    announcements,
    setAnnouncements,
    toggleBalanceVisibility,

    // Portfolio State
    userPortfolio,
    setUserPortfolio,
    portfolioLoading,
    setPortfolioLoading,
    portfolioError,
    setPortfolioError,

    // Goals State
    userGoals,
    setUserGoals,
    goalsLoading,
    setGoalsLoading,
    goalsError,
    setGoalsError,

    // Leaderboard State
    leaderboard,
    setLeaderboard,
    leaderboardLoading,
    setLeaderboardLoading,
    leaderboardError,
    setLeaderboardError,
    userScore,
    setUserScore,

    // Group Goals State
    groupGoals,
    setGroupGoals,
    groupGoalsLoading,
    setGroupGoalsLoading,
    groupGoalsError,
    setGroupGoalsError,
    myGroups,
    setMyGroups,
    myGroupsLoading,
    setMyGroupsLoading,

    // Quick Save Modal State
    quickSaveDetailsOpen,
    setQuickSaveDetailsOpen,
    quickSaveAmountOpen,
    setQuickSaveAmountOpen,
    quickSaveConfirmationOpen,
    setQuickSaveConfirmationOpen,
    quickSaveAmount,
    setQuickSaveAmount,

    // Goal Modal State
    goalDetailsOpen,
    setGoalDetailsOpen,
    goalAmountOpen,
    setGoalAmountOpen,
    goalConfirmationOpen,
    setGoalConfirmationOpen,
    selectedGoal,
    setSelectedGoal,
    goalAmount,
    setGoalAmount,

    // Custom Goal Modal State
    customGoalModalOpen,
    setCustomGoalModalOpen,
    customGoalForm,
    setCustomGoalForm,
    customGoalLoading,
    setCustomGoalLoading,

    // Group Goal Modal State
    createGroupGoalModalOpen,
    setCreateGroupGoalModalOpen,
    groupGoalForm,
    setGroupGoalForm,
    createGroupGoalLoading,
    setCreateGroupGoalLoading,

    // Join Goal Modal State
    joinGoalModalOpen,
    setJoinGoalModalOpen,
    selectedGoalToJoin,
    setSelectedGoalToJoin,
    joinGoalLoading,
    setJoinGoalLoading,
    joinGoalError,
    setJoinGoalError,

    // Withdrawal Modal State
    withdrawalModalOpen,
    setWithdrawalModalOpen,
    withdrawActionsModalOpen,
    setWithdrawActionsModalOpen,
    mobileOfframpModalOpen,
    setMobileOfframpModalOpen,

    // Onramp Modal State
    showOnrampModal,
    setShowOnrampModal,
    selectedTokenForOnramp,
    setSelectedTokenForOnramp,
    copied,
    setCopied,
  };
}
