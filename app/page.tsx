"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  useActiveAccount,
  useSendTransaction,
  useWalletBalance,
} from "thirdweb/react";
import { client } from "@/lib/thirdweb/client";
import { useChain } from "@/components/ChainProvider";

import {
  AppContainer,
  AppHeader,
  DesktopSidebar,
  MobileBottomNav,
  ModalManager,
} from "@/components/common";
import { GoalsSection } from "@/components/sections/GoalsSection";
import { LeaderboardSection } from "@/components/sections/LeaderboardSection";
import { ClanTab } from "@/components/clan/ClanTab";
import { NewProfile } from "@/components/common";
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

export default function AppPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const account = useActiveAccount();
  const isConnected = !!account;
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
        .filter((t) => ["USDC", "WETH"].includes(t.symbol.toUpperCase()))
        .map((t) => t.address);
    }
    return tokens.map((t) => t.address);
  }, [tokens, chain?.id]);

  const { data: walletBalanceData } = useWalletBalance({
    client,
    chain,
    address: account?.address,
    tokenAddress: defaultToken?.address,
  });

  const dataFetching = useDataFetching({
    address: account?.address,
    setUserPortfolio: state.setUserPortfolio,
    setPortfolioLoading: state.setPortfolioLoading,
    setPortfolioError: state.setPortfolioError,
    setUserGoals: state.setUserGoals,
    setGoalsLoading: state.setGoalsLoading,
    setGoalsError: state.setGoalsError,
    setLeaderboard: state.setLeaderboard,
    setLeaderboardLoading: state.setLeaderboardLoading,
    setLeaderboardError: state.setLeaderboardError,
    setUserScore: state.setUserScore,
    setGroupGoals: state.setGroupGoals,
    setGroupGoalsLoading: state.setGroupGoalsLoading,
    setGroupGoalsError: state.setGroupGoalsError,
    setMyGroups: state.setMyGroups,
    setMyGroupsLoading: state.setMyGroupsLoading,
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
    client,
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
    if (account?.address && !state.portfolioLoading && !state.userPortfolio) {
      dataFetching.fetchUserPortfolio();
    }
  }, [account?.address]);

  useEffect(() => {
    if (account?.address) {
      dataFetching.fetchUserGoals();
      dataFetching.fetchLeaderboard();
    }
  }, [account?.address]);

  useEffect(() => {
    if (account && walletOperations.pendingDeposit) {
      walletOperations.setPendingDeposit(false);
      transactionHandlers.setDepositError(null);
      handleQuickSaveDeposit();
    }
  }, [account, walletOperations.pendingDeposit]);

  useEffect(() => {
    if (state.activeTab === "groups") {
      dataFetching.fetchGroupGoals();
      dataFetching.fetchMyGroups();
    }
  }, [state.activeTab, account?.address]);

  useEffect(() => {
    if (state.withdrawalModalOpen && account?.address && chain && tokens) {
      const tokenSymbols = tokens.map((token) => token.symbol);
      fetchVaultPositions(chain, account.address, tokenSymbols);
    }
  }, [state.withdrawalModalOpen, account?.address, chain, tokens]);

  const handleQuickSaveDeposit = async () => {
    const depositAmount = state.goalConfirmationOpen
      ? state.goalAmount
      : state.quickSaveAmount;

    await walletOperations.handleQuickSaveDeposit(
      depositAmount,
      (status) => transactionHandlers.setTransactionStatus(status),
      (receipt, usdAmount, selectedToken) => {
        transactionHandlers.handleDepositSuccess(
          receipt,
          depositAmount,
          selectedToken,
          defaultToken,
          chain,
          account,
          state.goalConfirmationOpen,
          state.selectedGoal,
          () => {
            dataFetching.fetchUserPortfolio();
            dataFetching.fetchUserGoals();
          }
        );
      },
      (error) => transactionHandlers.handleDepositError(error)
    );
  };

  const handleCreateFirstGoal = () => {
    if (!account || !isConnected) {
      state.setActiveTab("profile");
    } else {
      state.setCustomGoalModalOpen(true);
    }
  };

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
        <AppHeader
          activeTab={state.activeTab}
          onRefresh={dataFetching.forceRefresh}
          onNewGoal={() => state.setCustomGoalModalOpen(true)}
          onNewGroup={() => state.setCreateGroupGoalModalOpen(true)}
        />

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
              handleCreateFirstGoal={handleCreateFirstGoal}
              handleGoalCardClick={modalHandlers.handleGoalCardClick}
              fetchUserPortfolio={dataFetching.fetchUserPortfolio}
              fetchUserGoals={dataFetching.fetchUserGoals}
              toggleBalanceVisibility={state.toggleBalanceVisibility}
              setQuickSaveDetailsOpen={state.setQuickSaveDetailsOpen}
              setWithdrawalModalOpen={state.setWithdrawalModalOpen}
              sendTransaction={sendTransaction}
            />
          )}

          {state.activeTab === "groups" && (
            <ClanTab
              account={account}
              groupGoals={state.groupGoals}
              myGroups={state.myGroups as MyGroups | undefined}
              groupGoalsLoading={state.groupGoalsLoading}
              myGroupsLoading={state.myGroupsLoading}
              onCreateGroupGoal={() => state.setCreateGroupGoalModalOpen(true)}
              onJoinGroupGoal={modalHandlers.handleJoinGroupGoal}
              onRefreshGroups={() => {
                dataFetching.fetchGroupGoals();
                dataFetching.fetchMyGroups();
              }}
              exchangeRate={getKESRate() || undefined}
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
            <NewProfile
              showBalance={state.showBalances}
              onToggleBalance={state.toggleBalanceVisibility}
            />
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
          vaultPositions={vaultPositions}
          vaultPositionsLoading={vaultPositionsLoading}
          onWithdrawalClose={() => state.setWithdrawalModalOpen(false)}
          onWithdraw={walletOperations.handleVaultWithdrawal}
          showOnrampModal={state.showOnrampModal}
          selectedTokenForOnramp={state.selectedTokenForOnramp}
          tokenInfos={tokenInfos}
          onOnrampClose={() => state.setShowOnrampModal(false)}
          onOnrampSuccess={transactionHandlers.handleOnrampSuccess}
          isDepositLoading={transactionHandlers.isDepositLoading}
          depositError={transactionHandlers.depositError}
          transactionStatus={transactionHandlers.transactionStatus}
          depositSuccess={transactionHandlers.depositSuccess}
          defaultToken={defaultToken}
          account={account}
          tokens={tokens}
          supportedStablecoins={supportedStablecoins}
          copied={state.copied}
          setCopied={state.setCopied}
          setSelectedTokenForOnramp={state.setSelectedTokenForOnramp}
          setShowOnrampModal={state.setShowOnrampModal}
        />
      </div>
    </AppContainer>
  );
}
