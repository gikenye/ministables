import { useCallback, useRef } from "react";
import type { GroupSavingsGoal } from "@/lib/services/backendApiService";

interface UseModalHandlersProps {
  setQuickSaveDetailsOpen: (open: boolean) => void;
  setQuickSaveAmountOpen: (open: boolean) => void;
  setQuickSaveConfirmationOpen: (open: boolean) => void;
  setQuickSaveAmount: (amount: string) => void;
  setGoalDetailsOpen: (open: boolean) => void;
  setGoalAmountOpen: (open: boolean) => void;
  setGoalConfirmationOpen: (open: boolean) => void;
  setSelectedGoal: (goal: any) => void;
  setGoalAmount: (amount: string) => void;
  setCustomGoalModalOpen: (open: boolean) => void;
  setCustomGoalForm: (form: any) => void;
  setSaveActionsModalOpen: (open: boolean) => void;
  setWithdrawActionsModalOpen: (open: boolean) => void;
  setShowOnrampModal: (open: boolean) => void;
  setOnrampTargetGoalId: (goalId: string | null) => void;
  setDepositMethod: (method: "ONCHAIN" | "MPESA") => void;
  setWithdrawalModalOpen: (open: boolean) => void;
  setMobileOfframpModalOpen: (open: boolean) => void;
  setJoinGoalModalOpen: (open: boolean) => void;
  setSelectedGoalToJoin: (goal: GroupSavingsGoal | null) => void;
  setJoinGoalError: (error: string | null) => void;
  setIsDepositLoading: (loading: boolean) => void;
  setDepositError: (error: string | null) => void;
  setTransactionStatus: (status: string | null) => void;
  setDepositSuccess: (success: any) => void;
  selectedGoal?: any;
}

export function useModalHandlers(props: UseModalHandlersProps) {
  const {
    setQuickSaveDetailsOpen,
    setQuickSaveAmountOpen,
    setQuickSaveConfirmationOpen,
    setQuickSaveAmount,
    setGoalDetailsOpen,
    setGoalAmountOpen,
    setGoalConfirmationOpen,
    setSelectedGoal,
    setGoalAmount,
    setCustomGoalModalOpen,
    setCustomGoalForm,
    setSaveActionsModalOpen,
    setWithdrawActionsModalOpen,
    setShowOnrampModal,
    setOnrampTargetGoalId,
    setDepositMethod,
    setWithdrawalModalOpen,
    setMobileOfframpModalOpen,
    setJoinGoalModalOpen,
    setSelectedGoalToJoin,
    setJoinGoalError,
    setIsDepositLoading,
    setDepositError,
    setTransactionStatus,
    setDepositSuccess,
    selectedGoal,
  } = props;

  const saveActionsContextRef = useRef<"quick" | "goal">("quick");

  const resetDepositState = useCallback(() => {
    setIsDepositLoading(false);
    setDepositError(null);
    setTransactionStatus(null);
    setDepositSuccess(null);
  }, [
    setIsDepositLoading,
    setDepositError,
    setTransactionStatus,
    setDepositSuccess,
  ]);

  const resolveTargetGoalId = useCallback((goal?: any) => {
    if (!goal) return null;
    const onChainGoals = goal.onChainGoals || goal.goalIds;
    if (!onChainGoals) return null;
    return (
      onChainGoals.USDC ||
      onChainGoals.USDT ||
      onChainGoals.CUSD ||
      onChainGoals.cUSD ||
      Object.values(onChainGoals)[0] ||
      null
    );
  }, []);

  const handleSaveActionSelect = useCallback(
    (actionId: string) => {
      setSaveActionsModalOpen(false);
      const context = saveActionsContextRef.current;

      if (actionId === "onramp") {
        setDepositMethod("MPESA");
        setOnrampTargetGoalId(
          context === "goal" ? resolveTargetGoalId(selectedGoal) : null
        );
        setShowOnrampModal(true);
        saveActionsContextRef.current = "quick";
        return;
      } 
      else if (actionId === "onchain") {
        setDepositMethod("ONCHAIN");
        setOnrampTargetGoalId(null);
        if (context === "goal") {
          setGoalAmountOpen(true);
        } else {
          setQuickSaveAmountOpen(true);
        }
        saveActionsContextRef.current = "quick";
      }
    },
    [
      setSaveActionsModalOpen,
      setShowOnrampModal,
      setOnrampTargetGoalId,
      setDepositMethod,
      setQuickSaveAmountOpen,
      setGoalAmountOpen,
      resolveTargetGoalId,
      selectedGoal,
    ]
  );

  const openSaveActionsForQuickSave = useCallback(() => {
    saveActionsContextRef.current = "quick";
    setSaveActionsModalOpen(true);
  }, [setSaveActionsModalOpen]);

  const openSaveActionsForGoal = useCallback(() => {
    saveActionsContextRef.current = "goal";
    setSaveActionsModalOpen(true);
  }, [setSaveActionsModalOpen]);

  const handleQuickSaveSaveNow = useCallback(() => {
    setQuickSaveDetailsOpen(false);
    setQuickSaveAmountOpen(true);
  }, [setQuickSaveDetailsOpen, setQuickSaveAmountOpen]);

  const handleWithdrawActionSelect = useCallback(
    (actionId: string) => {
      setWithdrawActionsModalOpen(false);

      if (actionId === "wallet") {
        setWithdrawalModalOpen(true);
        return;
      }

      if (actionId === "offramp") {
        setMobileOfframpModalOpen(true);
      }
    },
    [
      setWithdrawActionsModalOpen,
      setWithdrawalModalOpen,
      setMobileOfframpModalOpen,
    ]
  );

  const handleQuickSaveAmountContinue = useCallback(
    (amount: string) => {
      setQuickSaveAmount(amount);
      setQuickSaveAmountOpen(false);
      setQuickSaveConfirmationOpen(true);
    },
    [setQuickSaveAmount, setQuickSaveAmountOpen, setQuickSaveConfirmationOpen]
  );

  const closeAllQuickSaveModals = useCallback(() => {
    setQuickSaveDetailsOpen(false);
    setQuickSaveAmountOpen(false);
    setQuickSaveConfirmationOpen(false);
    resetDepositState();
  }, [
    setQuickSaveDetailsOpen,
    setQuickSaveAmountOpen,
    setQuickSaveConfirmationOpen,
    resetDepositState,
  ]);

  const handleGoalCardClick = useCallback(
    (goal: any) => {
      setSelectedGoal(goal);
      setGoalDetailsOpen(true);
    },
    [setSelectedGoal, setGoalDetailsOpen]
  );

  const handleGoalSaveNow = useCallback(() => {
    setGoalDetailsOpen(false);
    setGoalAmountOpen(true);
  }, [setGoalDetailsOpen, setGoalAmountOpen]);

  const closeGoalDetailsOnly = useCallback(() => {
    setGoalDetailsOpen(false);
  }, [setGoalDetailsOpen]);

  const handleGoalAmountContinue = useCallback(
    (amount: string) => {
      setGoalAmount(amount);
      setGoalAmountOpen(false);
      setGoalConfirmationOpen(true);
    },
    [setGoalAmount, setGoalAmountOpen, setGoalConfirmationOpen]
  );

  const closeAllGoalModals = useCallback(() => {
    setGoalDetailsOpen(false);
    setGoalAmountOpen(false);
    setGoalConfirmationOpen(false);
    setSelectedGoal(null);
    resetDepositState();
  }, [
    setGoalDetailsOpen,
    setGoalAmountOpen,
    setGoalConfirmationOpen,
    setSelectedGoal,
    resetDepositState,
  ]);

  const closeCustomGoalModal = useCallback(() => {
    setCustomGoalModalOpen(false);
    setCustomGoalForm({
      name: "",
      amount: "",
      timeline: "12",
      category: "custom",
    });
  }, [setCustomGoalModalOpen, setCustomGoalForm]);

  const handleJoinGroupGoal = useCallback(
    (goal: GroupSavingsGoal) => {
      setSelectedGoalToJoin(goal);
      setJoinGoalModalOpen(true);
      setJoinGoalError(null);
    },
    [setSelectedGoalToJoin, setJoinGoalModalOpen, setJoinGoalError]
  );

  return {
    handleSaveActionSelect,
    handleWithdrawActionSelect,
    handleQuickSaveSaveNow,
    handleQuickSaveAmountContinue,
    closeAllQuickSaveModals,
    handleGoalCardClick,
    handleGoalSaveNow,
    closeGoalDetailsOnly,
    handleGoalAmountContinue,
    closeAllGoalModals,
    closeCustomGoalModal,
    handleJoinGroupGoal,
    openSaveActionsForQuickSave,
    openSaveActionsForGoal,
  };
}
