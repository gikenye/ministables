"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  useActiveAccount,
  useSendTransaction,
} from "thirdweb/react";
import { client } from "@/lib/thirdweb/client";
import { useChain } from "@/components/ChainProvider";
import { WelcomeHeader } from "@/components/common/WelcomeHeader";

import { AppContainer } from "@/components/common/AppContainer";
import { DesktopSidebar } from "@/components/common/DesktopSidebar";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";
import { ModalManager } from "@/components/common/ModalManager";
import { GoalsSection } from "@/components/sections/GoalsSection";
import { LeaderboardSection } from "@/components/sections/LeaderboardSection";
import { RecentActivitySection } from "@/components/sections/RecentActivitySection";
import { ClanTab } from "@/components/clan/ClanTab";
import { NetworkStatusBar } from "@/components/common/NetworkStatusBar";

import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useVaultPositions } from "@/hooks/useVaultPositions";
import { useTransactionHandlers } from "@/hooks/useTransactionHandlers";
import { useWalletOperations } from "@/hooks/useWalletOperations";
import { useAppState } from "@/hooks/useAppState";
import { useDataFetching } from "@/hooks/useDataFetching";
import { useModalHandlers } from "@/hooks/useModalHandlers";
import { useGoalOperations } from "@/hooks/useGoalOperations";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useCombinedGoals } from "@/hooks/useCombinedGoals";
import type { MyGroups } from "@/lib/types/shared";
import type { GroupSavingsGoal } from "@/lib/services/backendApiService";
import type { TokenBalance } from "@/lib/services/balanceService";

const NewProfile = dynamic(
  () =>
    import("@/components/common/NewProfile").then((mod) => mod.NewProfile),
  { ssr: false }
);

export default function AppPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const account = useActiveAccount();
  const isConnected = !!account;
  // Track the currently active address so we can ignore stale async fetch results after disconnect/account switch
  const activeAddressRef = useRef<string | null>(null);

  useEffect(() => {
    activeAddressRef.current = account?.address ?? null;
  }, [account?.address]);

  const expectedAddress = account?.address ?? null;
  const guardSetter = useMemo(
    () =>
      (fn: (...args: any[]) => void) =>
      (...args: any[]) => {
        // Ignore results from requests that started under a different account
        if (activeAddressRef.current !== expectedAddress) return;
        fn(...args);
      },
    [expectedAddress]
  );
  const { mutateAsync: sendTransaction } = useSendTransaction({
    payModal: false,
  });
  const { chain, tokens, tokenInfos } = useChain();

  const state = useAppState();
  const { rates, getKESRate } = useExchangeRates();

  const defaultToken = useMemo(() => {
    if (!tokens || tokens.length === 0) return null;
    const usdc = tokens.find((t) => t.symbol.toUpperCase() === "USDC");
    if (usdc) return usdc;
    const stablecoins = tokens.filter((t) =>
      ["USDT", "CUSD", "USDC"].includes(t.symbol.toUpperCase())
    );
    return stablecoins.length > 0 ? stablecoins[0] : tokens[0];
  }, [tokens]);

  const supportedStablecoins = useMemo(() => {
    if (!tokens) return [];
    if (chain?.id === 42220) {
      return tokens
        .filter((t) =>
          ["USDC", "USDT", "CUSD"].includes(t.symbol.toUpperCase())
        )
        .map((t) => t.address);
    } else if (chain?.id === 534352) {
      return tokens
        .filter((t) => ["USDC"].includes(t.symbol.toUpperCase()))
        .map((t) => t.address);
    }
    return tokens.map((t) => t.address);
  }, [tokens, chain?.id]);

  const dataFetching = useDataFetching({
    address: account?.address,
    chainId: chain?.id,
    setUserPortfolio: guardSetter(state.setUserPortfolio),
    setPortfolioLoading: guardSetter(state.setPortfolioLoading),
    setPortfolioError: guardSetter(state.setPortfolioError),
    setUserGoals: guardSetter(state.setUserGoals),
    setGoalsLoading: guardSetter(state.setGoalsLoading),
    setGoalsError: guardSetter(state.setGoalsError),
    setLeaderboard: guardSetter(state.setLeaderboard),
    setLeaderboardLoading: guardSetter(state.setLeaderboardLoading),
    setLeaderboardError: guardSetter(state.setLeaderboardError),
    setUserScore: guardSetter(state.setUserScore),
    setGroupGoals: guardSetter(state.setGroupGoals),
    setGroupGoalsLoading: guardSetter(state.setGroupGoalsLoading),
    setGroupGoalsError: guardSetter(state.setGroupGoalsError),
    setMyGroups: guardSetter(state.setMyGroups),
    setMyGroupsLoading: guardSetter(state.setMyGroupsLoading),
  });

  const { vaultPositions, vaultPositionsLoading, fetchVaultPositions } =
    useVaultPositions();

  const transactionHandlers = useTransactionHandlers();

  const walletOperations = useWalletOperations({
    account,
    chain,
    defaultToken,
    client,
    sendTransaction,
  });

  const modalHandlers = useModalHandlers({
    setQuickSaveDetailsOpen: state.setQuickSaveDetailsOpen,
    setQuickSaveAmountOpen: state.setQuickSaveAmountOpen,
    setQuickSaveConfirmationOpen: state.setQuickSaveConfirmationOpen,
    setQuickSaveAmount: state.setQuickSaveAmount,
    setGoalDetailsOpen: state.setGoalDetailsOpen,
    setGoalAmountOpen: state.setGoalAmountOpen,
    setGoalConfirmationOpen: state.setGoalConfirmationOpen,
    setSelectedGoal: state.setSelectedGoal,
    setGoalAmount: state.setGoalAmount,
    setCustomGoalModalOpen: state.setCustomGoalModalOpen,
    setCustomGoalForm: state.setCustomGoalForm,
    setSaveActionsModalOpen: state.setSaveActionsModalOpen,
    setWithdrawActionsModalOpen: state.setWithdrawActionsModalOpen,
    setShowOnrampModal: state.setShowOnrampModal,
    setOnrampTargetGoalId: state.setOnrampTargetGoalId,
    setDepositMethod: state.setDepositMethod,
    setWithdrawalModalOpen: state.setWithdrawalModalOpen,
    setMobileOfframpModalOpen: state.setMobileOfframpModalOpen,
    setJoinGoalModalOpen: state.setJoinGoalModalOpen,
    setSelectedGoalToJoin: state.setSelectedGoalToJoin,
    setJoinGoalError: state.setJoinGoalError,
    setIsDepositLoading: transactionHandlers.setIsDepositLoading,
    setDepositError: transactionHandlers.setDepositError,
    setTransactionStatus: transactionHandlers.setTransactionStatus,
    setDepositSuccess: transactionHandlers.setDepositSuccess,
  });

  const goalOperations = useGoalOperations({
    address: account?.address,
    chain,
    getKESRate,
    setCustomGoalLoading: state.setCustomGoalLoading,
    setCustomGoalModalOpen: state.setCustomGoalModalOpen,
    setCustomGoalForm: state.setCustomGoalForm,
    setCreateGroupGoalLoading: state.setCreateGroupGoalLoading,
    setCreateGroupGoalModalOpen: state.setCreateGroupGoalModalOpen,
    setGroupGoalForm: state.setGroupGoalForm,
    setJoinGoalLoading: state.setJoinGoalLoading,
    setJoinGoalError: state.setJoinGoalError,
    fetchUserGoals: dataFetching.fetchUserGoals,
    fetchGroupGoals: dataFetching.fetchGroupGoals,
    refreshUserPortfolio: dataFetching.refreshUserPortfolio,
    handleWalletDeposit: walletOperations.handleQuickSaveDeposit,
  });

  const { handleKeyDown } = useKeyboardNavigation({
    setActiveTab: state.setActiveTab,
    setAnnouncements: state.setAnnouncements,
  });

  useNetworkStatus({ setIsOnline: state.setIsOnline });

  const { combinedGoals } = useCombinedGoals({
    userPortfolio: state.userPortfolio,
    userGoals: state.userGoals,
  });

  useEffect(() => {
    if (!account?.address) {
      state.setUserPortfolio(null);
      state.setUserGoals([]);
      state.setUserScore(null);
      state.setLeaderboard([]);
      state.setPortfolioError(null);
      state.setGoalsError(null);
      state.setLeaderboardError(null);

      // Clear group state to avoid stale UI after disconnect
      state.setGroupGoals([]);
      state.setMyGroups(null);
      state.setGroupGoalsError(null);

      // Ensure spinners don't remain visible after disconnect
      state.setPortfolioLoading(false);
      state.setGoalsLoading(false);
      state.setLeaderboardLoading(false);
      state.setGroupGoalsLoading(false);
      state.setMyGroupsLoading(false);

      return;
    }

    state.setUserPortfolio(null);
    dataFetching.refreshUserPortfolio();
    dataFetching.fetchUserGoals();
    dataFetching.fetchLeaderboard();
  }, [account?.address]);

  const prefetchedGroupsFor = useRef<string | null>(null);
  const dashboardRefreshAt = useRef(0);

  useEffect(() => {
    if (!account?.address || state.activeTab !== "goals") return;

    const minIntervalMs = 30000;

    const refreshDashboard = (silent = true) => {
      const now = Date.now();
      if (now - dashboardRefreshAt.current < minIntervalMs) return;
      dashboardRefreshAt.current = now;
      dataFetching.refreshUserPortfolio({ silent });
    };

    refreshDashboard(true);
    const interval = setInterval(() => refreshDashboard(true), minIntervalMs);
    const handleVisibilityChange = () => {
      if (!document.hidden) refreshDashboard(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [account?.address, state.activeTab]);

  const beginDeposit = () => {
    transactionHandlers.setIsDepositLoading(true);
    transactionHandlers.setDepositError(null);
    transactionHandlers.setTransactionStatus(null);
    transactionHandlers.setDepositSuccess(null);
  };

  const handleQuickSaveDeposit = async () => {
    beginDeposit();
    const depositAmount = state.goalConfirmationOpen
      ? state.goalAmount
      : state.quickSaveAmount;
    const selectedDepositToken =
      state.depositMethod === "ONCHAIN" ? state.selectedDepositToken : null;

    await walletOperations.handleQuickSaveDeposit(
      depositAmount,
      (status) => transactionHandlers.setTransactionStatus(status),
      (receipt, usdAmount, selectedToken) => {
        transactionHandlers.handleDepositSuccess(
          receipt,
          usdAmount.toString(),
          selectedToken,
          defaultToken,
          chain,
          account,
          state.goalConfirmationOpen,
          state.selectedGoal,
          () => {
            dataFetching.refreshUserPortfolio();
            dataFetching.fetchUserGoals();
          }
        );
      },
      (error) => transactionHandlers.handleDepositError(error),
      {
        depositMethod: state.depositMethod,
        token: selectedDepositToken,
      }
    );
  };

  const resetDepositState = () => {
    transactionHandlers.setIsDepositLoading(false);
    transactionHandlers.setDepositError(null);
    transactionHandlers.setTransactionStatus(null);
    transactionHandlers.setDepositSuccess(null);
  };

  const handleClanDeposit = async (
    goal: GroupSavingsGoal,
    amount: string,
    options?: { depositMethod?: "ONCHAIN" | "MPESA"; token?: TokenBalance }
  ) => {
    beginDeposit();
    const depositMethod = options?.depositMethod ?? "ONCHAIN";
    const selectedDepositToken =
      options?.token ||
      (depositMethod === "ONCHAIN" ? state.selectedDepositToken : null);

    await walletOperations.handleQuickSaveDeposit(
      amount,
      (status) => transactionHandlers.setTransactionStatus(status),
      (receipt, usdAmount, selectedToken) => {
        transactionHandlers.handleDepositSuccess(
          receipt,
          usdAmount.toString(),
          selectedToken,
          defaultToken,
          chain,
          account,
          true,
          goal,
          () => {
            dataFetching.refreshUserPortfolio();
            dataFetching.fetchMyGroups();
            dataFetching.fetchGroupGoals();
          }
        );
      },
      (error) => transactionHandlers.handleDepositError(error),
      {
        depositMethod,
        token: selectedDepositToken,
      }
    );
  };

  useEffect(() => {
    if (account && walletOperations.pendingDeposit) {
      walletOperations.setPendingDeposit(false);
      transactionHandlers.setDepositError(null);
      handleQuickSaveDeposit();
    }
  }, [account, walletOperations.pendingDeposit]);

  useEffect(() => {
    if (!account?.address || prefetchedGroupsFor.current === account.address) {
      return;
    }
    prefetchedGroupsFor.current = account.address;
    dataFetching.fetchGroupGoals();
    dataFetching.fetchMyGroups();
  }, [account?.address]);

  useEffect(() => {
    if (state.activeTab !== "groups" || !account?.address) return;
    if (state.myGroups || state.myGroupsLoading) return;
    dataFetching.fetchGroupGoals();
    dataFetching.fetchMyGroups();
  }, [state.activeTab, account?.address, state.myGroups, state.myGroupsLoading]);

  useEffect(() => {
    const shouldFetch =
      state.withdrawalModalOpen ||
      state.mobileOfframpModalOpen ||
      state.withdrawActionsModalOpen;
    if (shouldFetch && account?.address && chain && tokens) {
      const tokenSymbols = tokens.map((token) => token.symbol);
      fetchVaultPositions(chain, account.address, tokenSymbols);
    }
  }, [
    state.withdrawalModalOpen,
    state.mobileOfframpModalOpen,
    state.withdrawActionsModalOpen,
    account?.address,
    chain,
    tokens,
  ]);

  const handleVaultWithdrawal = async (
    tokenSymbol: string,
    depositIds: number[],
    sponsorGas: boolean = true
  ) => {
    await walletOperations.handleVaultWithdrawal(
      tokenSymbol,
      depositIds,
      sponsorGas
    );
    await dataFetching.refreshUserPortfolio();
    await dataFetching.fetchUserGoals();
    if (account?.address && chain && tokens) {
      const tokenSymbols = tokens.map((token) => token.symbol);
      await fetchVaultPositions(chain, account.address, tokenSymbols);
    }
  };

  const handleCreateFirstGoal = () => {
    if (!account || !isConnected) {
      state.setActiveTab("profile");
    } else {
      state.setCustomGoalModalOpen(true);
    }
  };

  const requestVaultPositions = useCallback(() => {
    if (!account?.address || !chain || !tokens?.length) return;
    const tokenSymbols = tokens.map((token) => token.symbol);
    fetchVaultPositions(chain, account.address, tokenSymbols);
  }, [account?.address, chain, tokens, fetchVaultPositions]);

  const chainConfigValid = useMemo(() => {
    return chain && tokens && tokens.length > 0 && tokenInfos;
  }, [chain, tokens, tokenInfos]);

  if (!chainConfigValid) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-900"
        role="alert"
      >
        <div className="text-center space-y-4 p-8 max-w-md mx-auto">
          <div className="text-red-400 text-xl font-semibold">
            Chain Configuration Error
          </div>
          <div className="text-gray-300">
            The current network is not properly configured. Please check your
            network connection or switch to a supported blockchain network.
          </div>
          <div className="text-sm text-gray-400 bg-gray-800/50 rounded-lg p-3">
            <strong>Current Network:</strong> {chain?.name || "Unknown Network"}
          </div>
          <div className="text-xs text-gray-500 mt-4">
            Supported networks: Celo, Scroll, Base
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppContainer announcements={state.announcements} onKeyDown={handleKeyDown}>
      <DesktopSidebar
        activeTab={state.activeTab}
        onTabChange={state.setActiveTab}
        onQuickSave={() => state.setSaveActionsModalOpen(true)}
        onNewGoal={() => state.setCustomGoalModalOpen(true)}
      />

      <div className="lg:pl-72 relative z-10">
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          {state.activeTab === "goals" && <WelcomeHeader />}
        </div>

        <main
          id="main-content"
          className="max-w-7xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8"
          role="main"
        >
          <NetworkStatusBar isOnline={state.isOnline} />

          {state.activeTab === "goals" && (
            <GoalsSection
              combinedGoals={combinedGoals}
              combinedLoading={state.goalsLoading || state.portfolioLoading}
              combinedError={state.goalsError || state.portfolioError}
              userPortfolio={state.userPortfolio}
              goalsLoading={state.goalsLoading}
              portfolioLoading={state.portfolioLoading}
              goalsError={state.goalsError}
              portfolioError={state.portfolioError}
              showBalances={state.showBalances}
              account={account}
              defaultToken={defaultToken}
              chain={chain}
              tokenInfos={tokenInfos}
              exchangeRate={getKESRate() || undefined}
              vaultPositions={vaultPositions}
              vaultPositionsLoading={vaultPositionsLoading}
              onRequestVaultPositions={requestVaultPositions}
              handleCreateFirstGoal={handleCreateFirstGoal}
              handleGoalCardClick={modalHandlers.handleGoalCardClick}
              onQuickSaveClick={() => state.setQuickSaveDetailsOpen(true)}
              fetchUserPortfolio={dataFetching.refreshUserPortfolio}
              fetchUserGoals={dataFetching.fetchUserGoals}
              toggleBalanceVisibility={state.toggleBalanceVisibility}
              setSaveActionsModalOpen={state.setSaveActionsModalOpen}
              setWithdrawActionsModalOpen={state.setWithdrawActionsModalOpen}
              sendTransaction={sendTransaction}
            />
          )}
          {state.activeTab === "groups" && (
            <ClanTab
              account={account}
              myGroups={state.myGroups as MyGroups | undefined}
              groupGoalsLoading={state.groupGoalsLoading}
              myGroupsLoading={state.myGroupsLoading}
              onCreateGroupGoal={() => state.setCreateGroupGoalModalOpen(true)}
              onOpenWithdrawActions={() =>
                state.setWithdrawActionsModalOpen(true)
              }
              onJoinGroupGoalWithAmount={handleClanDeposit}
              exchangeRate={getKESRate() || undefined}
              isDepositLoading={transactionHandlers.isDepositLoading}
              depositError={transactionHandlers.depositError}
              depositSuccess={transactionHandlers.depositSuccess}
              onResetDepositState={resetDepositState}
              setDepositMethod={state.setDepositMethod}
              setShowOnrampModal={state.setShowOnrampModal}
              setOnrampTargetGoalId={state.setOnrampTargetGoalId}
              showOnrampModal={state.showOnrampModal}
            />
          )}

          {state.activeTab === "leaderboard" && (
            <LeaderboardSection
              leaderboard={state.leaderboard}
              leaderboardLoading={state.leaderboardLoading}
              leaderboardError={state.leaderboardError}
              userScore={state.userScore}
              refetchLeaderboard={dataFetching.fetchLeaderboard}
            />
          )}

          {state.activeTab === "profile" && (
            <>
              <NewProfile
                showBalance={state.showBalances}
                onToggleBalance={state.toggleBalanceVisibility}
              />
            </>
          )}
        </main>

        <MobileBottomNav
          activeTab={state.activeTab}
          onTabChange={state.setActiveTab}
          onSaveClick={() => state.setSaveActionsModalOpen(true)}
          setAnnouncements={state.setAnnouncements}
        />

        <ModalManager
          saveActionsModalOpen={state.saveActionsModalOpen}
          onSaveActionsClose={() => state.setSaveActionsModalOpen(false)}
          onSaveActionSelect={modalHandlers.handleSaveActionSelect}
          withdrawActionsModalOpen={state.withdrawActionsModalOpen}
          onWithdrawActionsClose={() => state.setWithdrawActionsModalOpen(false)}
          onWithdrawActionSelect={modalHandlers.handleWithdrawActionSelect}
          quickSaveDetailsOpen={state.quickSaveDetailsOpen}
          quickSaveAmountOpen={state.quickSaveAmountOpen}
          quickSaveConfirmationOpen={state.quickSaveConfirmationOpen}
          quickSaveAmount={state.quickSaveAmount}
          onQuickSaveClose={modalHandlers.closeAllQuickSaveModals}
          onQuickSaveSaveNow={modalHandlers.handleQuickSaveSaveNow}
          onQuickSaveAmountContinue={
            modalHandlers.handleQuickSaveAmountContinue
          }
          onQuickSaveDeposit={handleQuickSaveDeposit}
          onQuickSaveWithdraw={() => state.setWithdrawActionsModalOpen(true)}
          quickSaveBalanceUsd={Number(state.userPortfolio?.totalValueUSD || 0)}
          goalDetailsOpen={state.goalDetailsOpen}
          goalAmountOpen={state.goalAmountOpen}
          goalConfirmationOpen={state.goalConfirmationOpen}
          selectedGoal={state.selectedGoal}
          goalAmount={state.goalAmount}
          onGoalClose={modalHandlers.closeAllGoalModals}
          onGoalSaveNow={modalHandlers.handleGoalSaveNow}
          onGoalAmountContinue={modalHandlers.handleGoalAmountContinue}
          showBalances={state.showBalances}
          exchangeRate={getKESRate() || undefined}
          customGoalModalOpen={state.customGoalModalOpen}
          customGoalForm={state.customGoalForm}
          customGoalLoading={state.customGoalLoading}
          onCustomGoalClose={modalHandlers.closeCustomGoalModal}
          onCreateCustomGoal={() =>
            goalOperations.handleCreateCustomGoal(state.customGoalForm)
          }
          setCustomGoalForm={state.setCustomGoalForm}
          createGroupGoalModalOpen={state.createGroupGoalModalOpen}
          groupGoalForm={state.groupGoalForm}
          createGroupGoalLoading={state.createGroupGoalLoading}
          onGroupGoalClose={() => state.setCreateGroupGoalModalOpen(false)}
          onCreateGroupGoal={() =>
            goalOperations.handleCreateGroupGoal(state.groupGoalForm)
          }
          setGroupGoalForm={state.setGroupGoalForm}
          joinGoalModalOpen={state.joinGoalModalOpen}
          selectedGoalToJoin={state.selectedGoalToJoin}
          joinGoalLoading={state.joinGoalLoading}
          joinGoalError={state.joinGoalError}
          onJoinGoalClose={() => {
            state.setJoinGoalModalOpen(false);
            state.setSelectedGoalToJoin(null);
            state.setJoinGoalError(null);
          }}
          onJoinGoal={(amount) =>
            goalOperations.handleJoinGoalWithAmount(
              state.selectedGoalToJoin,
              amount
            )
          }
          withdrawalModalOpen={state.withdrawalModalOpen}
          setWithdrawalModalOpen={state.setWithdrawalModalOpen}
          vaultPositions={vaultPositions}
          vaultPositionsLoading={vaultPositionsLoading}
          onWithdrawalClose={() => state.setWithdrawalModalOpen(false)}
          onWithdraw={handleVaultWithdrawal}
          mobileOfframpModalOpen={state.mobileOfframpModalOpen}
          onMobileOfframpClose={() => state.setMobileOfframpModalOpen(false)}
          showOnrampModal={state.showOnrampModal}
          selectedTokenForOnramp={state.selectedTokenForOnramp}
          onrampTargetGoalId={state.onrampTargetGoalId}
          tokenInfos={tokenInfos}
          onOnrampClose={() => {
            state.setShowOnrampModal(false);
            state.setOnrampTargetGoalId(null);
          }}
          onOnrampSuccess={transactionHandlers.handleOnrampSuccess}
          isDepositLoading={transactionHandlers.isDepositLoading}
          depositError={transactionHandlers.depositError}
          transactionStatus={transactionHandlers.transactionStatus}
          depositSuccess={transactionHandlers.depositSuccess}
          defaultToken={defaultToken}
          account={account}
          chain={chain}
          tokens={tokens}
          supportedStablecoins={supportedStablecoins}
          copied={state.copied}
          setCopied={state.setCopied}
          setSelectedTokenForOnramp={state.setSelectedTokenForOnramp}
          setShowOnrampModal={state.setShowOnrampModal}
          depositMethod={state.depositMethod}
          onSettlementTransfer={walletOperations.handleSettlementTransfer}
          selectedDepositToken={state.selectedDepositToken}
          setSelectedDepositToken={state.setSelectedDepositToken}
        />
      </div>
    </AppContainer>
  );
}
