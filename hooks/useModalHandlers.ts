import { useCallback } from "react";
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
  setJoinGoalModalOpen: (open: boolean) => void;
  setSelectedGoalToJoin: (goal: GroupSavingsGoal | null) => void;
  setJoinGoalError: (error: string | null) => void;
  setIsDepositLoading: (loading: boolean) => void;
  setDepositError: (error: string | null) => void;
  setTransactionStatus: (status: string | null) => void;
  setDepositSuccess: (success: any) => void;
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
    setJoinGoalModalOpen,
    setSelectedGoalToJoin,
    setJoinGoalError,
    setIsDepositLoading,
    setDepositError,
    setTransactionStatus,
    setDepositSuccess,
  } = props;

  const handleSaveActionSelect = useCallback(
    (actionId: string) => {
      setSaveActionsModalOpen(false);
      if (actionId === "quick") {
        setQuickSaveDetailsOpen(true);
      }
    },
    [setSaveActionsModalOpen, setQuickSaveDetailsOpen]
  );

  const handleQuickSaveSaveNow = useCallback(() => {
    setQuickSaveDetailsOpen(false);
    setQuickSaveAmountOpen(true);
  }, [setQuickSaveDetailsOpen, setQuickSaveAmountOpen]);

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
    setIsDepositLoading(false);
    setDepositError(null);
    setTransactionStatus(null);
    setDepositSuccess(null);
  }, [
    setQuickSaveDetailsOpen,
    setQuickSaveAmountOpen,
    setQuickSaveConfirmationOpen,
    setIsDepositLoading,
    setDepositError,
    setTransactionStatus,
    setDepositSuccess,
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
  }, [setGoalDetailsOpen, setGoalAmountOpen, setGoalConfirmationOpen, setSelectedGoal]);

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
    handleQuickSaveSaveNow,
    handleQuickSaveAmountContinue,
    closeAllQuickSaveModals,
    handleGoalCardClick,
    handleGoalSaveNow,
    handleGoalAmountContinue,
    closeAllGoalModals,
    closeCustomGoalModal,
    handleJoinGroupGoal,
  };
}
