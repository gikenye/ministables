"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner"; 
import {
  AmountInputModal,
  CustomGoalModal,
  DepositConfirmationModal,
  GoalDetailsModal,
  QuickSaveDetailsModal,
  SaveActionsModal,
  WithdrawActionsModal,
} from "@/components/common";
import { CreateGroupGoalModal } from "@/components/clan/CreateGroupGoalModal";
import { JoinGoalModal } from "@/components/clan/JoinGoalModal";
import { OnrampDepositModal } from "@/components/OnrampDepositModal";
import MobileMoneyWithdrawModal from "@/components/MobileMoneyWithdrawModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import type { GroupSavingsGoal } from "@/lib/services/backendApiService";
import { getStablecoinBalances } from "@/lib/services/balanceService";
import type { TokenBalance } from "@/lib/services/balanceService";
import { getOfframpSupportedSymbols } from "@/lib/services/offrampService";

interface ModalManagerProps {
  // Save Actions Modal
  saveActionsModalOpen: boolean;
  onSaveActionsClose: () => void;
  onSaveActionSelect: (actionId: string) => void;

  // Withdraw Actions Modal
  withdrawActionsModalOpen: boolean;
  onWithdrawActionsClose: () => void;
  onWithdrawActionSelect: (actionId: string) => void;

  // Quick Save Modals
  quickSaveDetailsOpen: boolean;
  quickSaveAmountOpen: boolean;
  quickSaveConfirmationOpen: boolean;
  quickSaveAmount: string;
  onQuickSaveClose: () => void;
  onQuickSaveSaveNow: () => void;
  onQuickSaveAmountContinue: (amount: string) => void;
  onQuickSaveDeposit: () => void;
  onQuickSaveWithdraw?: () => void;
  quickSaveBalanceUsd?: number;

  // Goal Modals
  goalDetailsOpen: boolean;
  goalAmountOpen: boolean;
  goalConfirmationOpen: boolean;
  selectedGoal: any;
  goalAmount: string;
  onGoalClose: () => void;
  onGoalSaveNow: () => void;
  onGoalAmountContinue: (amount: string) => void;
  showBalances: boolean;
  exchangeRate?: number;
  onGoalsRefetch?: () => void; 

  // Custom Goal Modal
  customGoalModalOpen: boolean;
  customGoalForm: any;
  customGoalLoading: boolean;
  onCustomGoalClose: () => void;
  onCreateCustomGoal: () => void;
  setCustomGoalForm: (form: any) => void;

  // Group Goal Modal
  createGroupGoalModalOpen: boolean;
  groupGoalForm: any;
  createGroupGoalLoading: boolean;
  onGroupGoalClose: () => void;
  onCreateGroupGoal: () => void;
  setGroupGoalForm: (form: any) => void;

  // Join Goal Modal
  joinGoalModalOpen: boolean;
  selectedGoalToJoin: GroupSavingsGoal | null;
  joinGoalLoading: boolean;
  joinGoalError: string | null;
  onJoinGoalClose: () => void;
  onJoinGoal: (amount: string) => void;

  // Withdrawal Modal
  withdrawalModalOpen: boolean;
  vaultPositions: any[];
  vaultPositionsLoading: boolean;
  onWithdrawalClose: () => void;
  setWithdrawalModalOpen: (open: boolean) => void; 
  onWithdraw: (
    tokenSymbol: string,
    depositIds: number[],
    sponsorGas?: boolean
  ) => Promise<void>;

  // Mobile Offramp Modal
  mobileOfframpModalOpen: boolean;
  onMobileOfframpClose: () => void;
  onSettlementTransfer: (
    tokenAddress: string,
    amount: string,
    toAddress: string,
    decimals?: number
  ) => Promise<string>;

  // Onramp Modal
  showOnrampModal: boolean;
  selectedTokenForOnramp: string;
  onrampTargetGoalId: string | null;
  tokenInfos: any;
  onOnrampClose: () => void;
  onOnrampSuccess: () => void;

  // Deposit Confirmation Props
  isDepositLoading: boolean;
  depositError: string | null;
  transactionStatus: string | null;
  depositSuccess: any;
  defaultToken: any;
  account: any;
  chain: any;
  tokens: any[];
  supportedStablecoins: string[];
  copied: boolean;
  setCopied: (copied: boolean) => void;
  setSelectedTokenForOnramp: (token: string) => void;
  setShowOnrampModal: (show: boolean) => void;
  depositMethod: "ONCHAIN" | "MPESA";
  selectedDepositToken: TokenBalance | null;
  setSelectedDepositToken: (token: TokenBalance | null) => void;
}

export function ModalManager(props: ModalManagerProps) {
  const {
    saveActionsModalOpen,
    onSaveActionsClose,
    onSaveActionSelect,
    withdrawActionsModalOpen,
    onWithdrawActionsClose,
    onWithdrawActionSelect,
    quickSaveDetailsOpen,
    quickSaveAmountOpen,
    quickSaveConfirmationOpen,
    quickSaveAmount,
    onQuickSaveClose,
    onQuickSaveSaveNow,
    onQuickSaveAmountContinue,
    onQuickSaveDeposit,
    onQuickSaveWithdraw,
    quickSaveBalanceUsd = 0,
    goalDetailsOpen,
    goalAmountOpen,
    goalConfirmationOpen,
    selectedGoal,
    goalAmount,
    onGoalClose,
    onGoalSaveNow,
    onGoalAmountContinue,
    showBalances,
    exchangeRate,
    onGoalsRefetch,
    customGoalModalOpen,
    customGoalForm,
    customGoalLoading,
    onCustomGoalClose,
    onCreateCustomGoal,
    setCustomGoalForm,
    createGroupGoalModalOpen,
    groupGoalForm,
    createGroupGoalLoading,
    onGroupGoalClose,
    onCreateGroupGoal,
    setGroupGoalForm,
    joinGoalModalOpen,
    selectedGoalToJoin,
    joinGoalLoading,
    joinGoalError,
    onJoinGoalClose,
    onJoinGoal,
    withdrawalModalOpen,
    vaultPositions,
    vaultPositionsLoading,
    onWithdrawalClose,
    setWithdrawalModalOpen,
    onWithdraw,
    mobileOfframpModalOpen,
    onMobileOfframpClose,
    onSettlementTransfer,
    showOnrampModal,
    selectedTokenForOnramp,
    onrampTargetGoalId,
    tokenInfos,
    onOnrampClose,
    onOnrampSuccess,
    isDepositLoading,
    depositError,
    transactionStatus,
    depositSuccess,
    defaultToken,
    account,
    chain,
    tokens,
    supportedStablecoins,
    copied,
    setCopied,
    setSelectedTokenForOnramp,
    setShowOnrampModal,
    depositMethod,
    selectedDepositToken,
    setSelectedDepositToken,
  } = props;

  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [stablecoinBalances, setStablecoinBalances] = useState<TokenBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [selectedOfframpToken, setSelectedOfframpToken] = useState<TokenBalance | null>(null);
  const isOnchainDeposit = depositMethod === "ONCHAIN";

  const pickDefaultToken = (balances: TokenBalance[]) => {
    const priorityOrder = ["USDC", "USDT", "CUSD"];
    const sorted = [...balances].sort((a, b) => {
      if (a.balance !== b.balance) {
        return b.balance - a.balance;
      }

      const aPriority = priorityOrder.indexOf(a.symbol.toUpperCase());
      const bPriority = priorityOrder.indexOf(b.symbol.toUpperCase());

      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      return 0;
    });

    return sorted[0] || null;
  };

  useEffect(() => {
    if (!isOnchainDeposit) {
      setStablecoinBalances([]);
      setBalancesLoading(false);
      setSelectedDepositToken(null);
    }
  }, [isOnchainDeposit, setSelectedDepositToken]);

  useEffect(() => {
    const shouldLoadBalances =
      isOnchainDeposit &&
      (quickSaveAmountOpen || goalAmountOpen) &&
      account?.address &&
      chain?.id;

    if (!shouldLoadBalances) {
      return;
    }

    let isActive = true;
    setBalancesLoading(true);

    getStablecoinBalances(account.address, chain.id)
      .then((balances) => {
        if (!isActive) return;
        setStablecoinBalances(balances);
      })
      .catch(() => {
        if (!isActive) return;
        setStablecoinBalances([]);
      })
      .finally(() => {
        if (!isActive) return;
        setBalancesLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [
    isOnchainDeposit,
    quickSaveAmountOpen,
    goalAmountOpen,
    account?.address,
    chain?.id,
  ]);

  useEffect(() => {
    if (!stablecoinBalances.length) {
      setSelectedDepositToken(null);
      return;
    }

    setSelectedDepositToken((prev) => {
      if (prev && stablecoinBalances.some((token) => token.address === prev.address)) {
        return prev;
      }
      return pickDefaultToken(stablecoinBalances);
    });
  }, [stablecoinBalances, setSelectedDepositToken]);

  const getGoalIcon = (category?: string) => {
    const icons: Record<string, string> = {
      personal: "🎯",
      retirement: "🏦",
      emergency: "🚨",
      travel: "✈️",
      education: "🎓",
      business: "💼",
      health: "🏥",
      home: "🏠",
    };
    return icons[category || ""] || "💰";
  };

  const handleDeleteGoal = async (metaGoalId: string) => {
    if (!account?.address || !metaGoalId) return;
    
    setIsDeleteLoading(true);
    const toastId = toast.loading("Deleting your goal...");

    try {
      const response = await fetch("/api/goals/cancel-goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metaGoalId, userAddress: account.address }),
      });

      const data = await response.json();

      if (response.ok) {
        if (typeof window !== "undefined" && window.navigator.vibrate) {
          window.navigator.vibrate(50);
        }
        
        toast.success("Goal deleted successfully", { id: toastId });
        
        if (onGoalsRefetch) onGoalsRefetch();
        
        setTimeout(() => {
          onGoalClose();
        }, 100);
      } else {
        toast.error(data.error || "Failed to delete goal", { id: toastId });
      }
    } catch (error) {
      console.error("Delete failed", error);
      toast.error("An unexpected error occurred", { id: toastId });
    } finally {
      setIsDeleteLoading(false);
    }
  };

  const offrampSupportedSymbols = useMemo(
    () => getOfframpSupportedSymbols(chain?.name || ""),
    [chain?.name]
  );
  const offrampTokenBalances = useMemo(() => {
    if (!vaultPositions?.length) return [];
    const allowedSymbols = offrampSupportedSymbols.length > 0 ? offrampSupportedSymbols : null;
    const balancesBySymbol = new Map<string, TokenBalance>();
    const tokenInfoBySymbol = new Map(
      (tokens || []).map((token) => [token.symbol.toUpperCase(), token])
    );

    vaultPositions.forEach((position) => {
      const symbol = position.tokenSymbol?.toUpperCase();
      if (!symbol) return;
      if (allowedSymbols && !allowedSymbols.includes(symbol)) return;
      const amount = Number.parseFloat(position.withdrawableAmount || "0");
      if (!Number.isFinite(amount)) return;

      const tokenInfo = tokenInfoBySymbol.get(symbol);
      const address = tokenInfo?.address || position.tokenAddress;
      const decimals = tokenInfo?.decimals ?? 18;
      const existing = balancesBySymbol.get(symbol);
      const balance = (existing?.balance || 0) + amount;

      balancesBySymbol.set(symbol, {
        address,
        symbol,
        balance,
        formattedBalance: balance.toString(),
        decimals,
      });
    });

    return Array.from(balancesBySymbol.values()).sort(
      (a, b) => b.balance - a.balance
    );
  }, [vaultPositions, tokens, offrampSupportedSymbols]);

  useEffect(() => {
    if (!offrampTokenBalances.length) {
      setSelectedOfframpToken(null);
      return;
    }
    setSelectedOfframpToken((prev) => {
      if (prev && offrampTokenBalances.some((token) => token.address === prev.address)) {
        return prev;
      }
      return offrampTokenBalances[0];
    });
  }, [offrampTokenBalances]);

  const activeOfframpToken = selectedOfframpToken || defaultToken;
  const offrampTokenSymbol = activeOfframpToken?.symbol || "USDC";
  const offrampTokenAddress = activeOfframpToken?.address || "";
  const offrampTokenDecimals = activeOfframpToken?.decimals ?? 18;

  const offrampAvailableAmount = useMemo(() => {
    if (selectedOfframpToken) {
      return selectedOfframpToken.balance.toString();
    }
    if (!vaultPositions?.length) return "0";
    const total = vaultPositions
      .filter((position) => position.tokenSymbol === offrampTokenSymbol)
      .reduce(
        (sum, position) =>
          sum + Number.parseFloat(position.withdrawableAmount || "0"),
        0
      );
    return total.toString();
  }, [vaultPositions, offrampTokenSymbol]);

  const selectPositionsForAmount = (
    amount: number,
    tokenSymbol: string
  ): number[] => {
    const positions = vaultPositions.filter(
      (position) =>
        position.tokenSymbol === tokenSymbol &&
        Number.parseFloat(position.withdrawableAmount || "0") > 0
    );
    const sorted = [...positions].sort(
      (a, b) =>
        Number.parseFloat(b.withdrawableAmount || "0") -
        Number.parseFloat(a.withdrawableAmount || "0")
    );

    const selectedIds: number[] = [];
    let remaining = amount;
    for (const pos of sorted) {
      if (remaining <= 0) break;
      selectedIds.push(pos.depositId);
      remaining -= Number.parseFloat(pos.withdrawableAmount || "0");
    }

    return selectedIds;
  };

  const handleVaultWithdrawForAmount = async (
    tokenSymbol: string,
    amount: string
  ) => {
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      throw new Error("Enter a valid amount");
    }

    const depositIds = selectPositionsForAmount(amountNum, tokenSymbol);
    if (!depositIds.length) {
      throw new Error("No withdrawable deposits available");
    }

    await onWithdraw(tokenSymbol, depositIds, true);
  };

  const handleSettlementTransfer = (
    tokenAddress: string,
    amount: string,
    toAddress: string
  ) => {
    return onSettlementTransfer(
    tokenAddress,
    amount,
    toAddress,
    offrampTokenDecimals
    );
  };

  return (
    <>
      <SaveActionsModal
        isOpen={saveActionsModalOpen}
        onClose={onSaveActionsClose}
        onActionSelect={onSaveActionSelect}
      />

      <WithdrawActionsModal
        isOpen={withdrawActionsModalOpen}
        onClose={onWithdrawActionsClose}
        onActionSelect={onWithdrawActionSelect}
      />

      <QuickSaveDetailsModal
        isOpen={quickSaveDetailsOpen}
        onClose={onQuickSaveClose}
        onSaveNow={onQuickSaveSaveNow}
        onWithdraw={onQuickSaveWithdraw}
        balanceUSD={quickSaveBalanceUsd}
        exchangeRate={exchangeRate}
        showBalance={showBalances}
      />

      <AmountInputModal
        isOpen={quickSaveAmountOpen}
        onClose={onQuickSaveClose}
        onContinue={onQuickSaveAmountContinue}
        title="How much do you want to save?"
        initialAmount={isOnchainDeposit ? "0" : "100"}
        currency={isOnchainDeposit ? "USD" : "KES"}
        allowDecimal={isOnchainDeposit}
        tokenBalances={isOnchainDeposit ? stablecoinBalances : []}
        selectedToken={selectedDepositToken}
        onTokenSelect={setSelectedDepositToken}
        balancesLoading={isOnchainDeposit ? balancesLoading : false}
        icon="🐷"
      />

      <DepositConfirmationModal
        isOpen={quickSaveConfirmationOpen}
        onClose={onQuickSaveClose}
        amount={quickSaveAmount}
        onDeposit={onQuickSaveDeposit}
        isLoading={isDepositLoading}
        error={depositError}
        transactionStatus={transactionStatus}
        tokenSymbol={defaultToken?.symbol || "USDC"}
        depositSuccess={depositSuccess}
        account={account}
        tokens={tokens}
        tokenInfos={tokenInfos}
        supportedStablecoins={supportedStablecoins}
        copied={copied}
        setCopied={setCopied}
        setSelectedTokenForOnramp={setSelectedTokenForOnramp}
        setShowOnrampModal={setShowOnrampModal}
        goalTitle="Quick Save Goal"
        depositMethod={depositMethod}
      />

      {/* Primary Goal Management Modal */}
      <GoalDetailsModal
        isOpen={goalDetailsOpen}
        onClose={onGoalClose}
        goal={selectedGoal}
        showBalance={showBalances}
        exchangeRate={exchangeRate}
        onDeleteGoal={handleDeleteGoal}
        isDeleteLoading={isDeleteLoading}
        onSaveNow={(type?: string) => {
          if (type === "withdraw") {
            onGoalClose();
            // Open the specific withdrawal flow
            setWithdrawalModalOpen(true);
          } else {
            // Open the deposit amount flow
            onGoalSaveNow();
          }
        }}
      />

      <AmountInputModal
        isOpen={goalAmountOpen}
        onClose={onGoalClose}
        onContinue={onGoalAmountContinue}
        title={`Save to ${selectedGoal?.title || "Goal"}`}
        initialAmount={isOnchainDeposit ? "0" : "100"}
        currency={isOnchainDeposit ? "USD" : "KES"}
        allowDecimal={isOnchainDeposit}
        tokenBalances={isOnchainDeposit ? stablecoinBalances : []}
        selectedToken={selectedDepositToken}
        onTokenSelect={setSelectedDepositToken}
        balancesLoading={isOnchainDeposit ? balancesLoading : false}
        icon={getGoalIcon(selectedGoal?.category)}
      />

      <DepositConfirmationModal
        isOpen={goalConfirmationOpen}
        onClose={onGoalClose}
        amount={goalAmount}
        onDeposit={onQuickSaveDeposit}
        isLoading={isDepositLoading}
        error={depositError}
        transactionStatus={transactionStatus}
        tokenSymbol={defaultToken?.symbol || "USDC"}
        depositSuccess={depositSuccess}
        account={account}
        tokens={tokens}
        tokenInfos={tokenInfos}
        supportedStablecoins={supportedStablecoins}
        copied={copied}
        setCopied={setCopied}
        setSelectedTokenForOnramp={setSelectedTokenForOnramp}
        setShowOnrampModal={setShowOnrampModal}
        goalTitle={selectedGoal?.title || "Goal"}
        goalIcon={getGoalIcon(selectedGoal?.category)}
        depositMethod={depositMethod}
      />

      <CustomGoalModal
        isOpen={customGoalModalOpen}
        onClose={onCustomGoalClose}
        onCreateGoal={onCreateCustomGoal}
        form={customGoalForm}
        setForm={setCustomGoalForm}
        isLoading={customGoalLoading}
        error={null}
        exchangeRate={exchangeRate}
      />

      <CreateGroupGoalModal
        isOpen={createGroupGoalModalOpen}
        onClose={onGroupGoalClose}
        onCreateGroupGoal={onCreateGroupGoal}
        groupGoalForm={groupGoalForm}
        setGroupGoalForm={setGroupGoalForm}
        isLoading={createGroupGoalLoading}
        exchangeRate={exchangeRate}
      />

      <JoinGoalModal
        isOpen={joinGoalModalOpen}
        onClose={onJoinGoalClose}
        goal={selectedGoalToJoin}
        onJoin={onJoinGoal}
        isLoading={joinGoalLoading}
        error={joinGoalError}
        exchangeRate={exchangeRate}
      />

      <WithdrawModal
        isOpen={withdrawalModalOpen}
        onClose={onWithdrawalClose}
        onWithdraw={onWithdraw}
        vaultPositions={vaultPositions}
        loading={vaultPositionsLoading}
        userAddress={account?.address}
      />

      <MobileMoneyWithdrawModal
        isOpen={mobileOfframpModalOpen}
        onClose={onMobileOfframpClose}
        tokenSymbol={offrampTokenSymbol}
        tokenAddress={offrampTokenAddress}
        network={chain?.name || ""}
        availableAmount={offrampAvailableAmount}
        decimals={offrampTokenDecimals}
        tokenBalances={offrampTokenBalances}
        selectedToken={selectedOfframpToken}
        onTokenSelect={setSelectedOfframpToken}
        userDeposits={offrampAvailableAmount}
        userBorrows="0"
        onVaultWithdraw={handleVaultWithdrawForAmount}
        onSettlementTransfer={handleSettlementTransfer}
      />

      <OnrampDepositModal
        isOpen={showOnrampModal}
        onClose={onOnrampClose}
        selectedAsset={tokenInfos[selectedTokenForOnramp]?.symbol || "USDC"}
        assetSymbol={tokenInfos[selectedTokenForOnramp]?.symbol || "USDC"}
        targetGoalId={onrampTargetGoalId || undefined}
        onSuccess={onOnrampSuccess}
      />
    </>
  );
}
