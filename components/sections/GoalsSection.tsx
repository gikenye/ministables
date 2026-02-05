"use client";

import { TrendingUp, Plus } from "lucide-react";
import { ActionButton } from "@/components/ui";
import {
  GoalCard,
  GoalCardSkeleton,
  QuickSaveCardSkeleton,
  ExpandableQuickSaveCard,
  type FrontendGoal,
} from "@/components/common";
import { RecentActivitySection } from "@/components/sections/RecentActivitySection";

interface GoalsSectionProps {
  combinedGoals: any[];
  combinedLoading: boolean;
  combinedError: string | null;
  userPortfolio: any;
  goalsLoading: boolean;
  portfolioLoading: boolean;
  goalsError: string | null;
  portfolioError: string | null;
  showBalances: boolean;
  account: any;
  defaultToken: any;
  chain: any;
  tokenInfos: any;
  exchangeRate: number | undefined;
  vaultPositions?: Array<{
    withdrawableAmount?: string;
    unlockTime?: number;
  }>;
  vaultPositionsLoading?: boolean;
  onRequestVaultPositions?: () => void;
  handleCreateFirstGoal: () => void;
  handleGoalCardClick: (goal: any) => void;
  onQuickSaveClick: () => void;
  fetchUserPortfolio: () => void;
  fetchUserGoals: () => void;
  toggleBalanceVisibility: () => void;
  setSaveActionsModalOpen: (open: boolean) => void;
  setWithdrawActionsModalOpen: (open: boolean) => void;
  sendTransaction: any;
}

export function GoalsSection({ 
  combinedGoals,
  combinedLoading,
  combinedError,
  userPortfolio,
  goalsLoading,
  portfolioLoading,
  goalsError,
  portfolioError,
  showBalances,
  account,
  defaultToken,
  chain,
  tokenInfos,
  exchangeRate,
  vaultPositions,
  vaultPositionsLoading,
  onRequestVaultPositions,
  handleCreateFirstGoal,
  handleGoalCardClick,
  onQuickSaveClick,
  fetchUserPortfolio,
  fetchUserGoals,
  toggleBalanceVisibility,
  setSaveActionsModalOpen,
  setWithdrawActionsModalOpen,
  sendTransaction,
}: GoalsSectionProps) {
  const getKESRate = () => exchangeRate;

  return (
    <div className="py-4">
      {/* Error State - only show when there's an error and not loading */}
      {combinedError && !combinedLoading && (
        <div className="text-center py-8">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
            <p className="text-red-300 mb-1 text-sm font-semibold">
              We couldn't refresh your dashboard
            </p>
            <p className="text-gray-400 text-xs">
              Check your connection and try again. Your money is safe.
            </p>
          </div>
          <div className="flex justify-center">
            <ActionButton
              onClick={() => {
                fetchUserGoals();
                fetchUserPortfolio();
              }}
              size="sm"
            >
              Refresh dashboard
            </ActionButton>
          </div>
        </div>
      )}

      {/* Goals Content - Always show, with loading states */}
      {!combinedError && (
        <>
          {/* Quick Save Section - Always visible */}
          <div className="mb-4">
            {combinedLoading ||
            !combinedGoals.find((g) => g.category === "quick") ? (
              // Skeleton for Quick Save card
              <QuickSaveCardSkeleton />
            ) : (
              <ExpandableQuickSaveCard
                goal={combinedGoals.find((g) => g.category === "quick")!}
                goals={combinedGoals}
                userPositions={userPortfolio}
                account={account}
                user={account}
                isLoading={combinedLoading}
                showBalance={showBalances}
                onToggleBalance={toggleBalanceVisibility}
                onDeposit={() => setSaveActionsModalOpen(true)}
                onWithdraw={() => setWithdrawActionsModalOpen(true)}
                defaultToken={defaultToken}
                chain={chain}
                tokenInfo={tokenInfos}
                exchangeRate={getKESRate() || undefined}
                onGoalsRefetch={() => {
                  fetchUserPortfolio();
                  fetchUserGoals();
                }}
                sendTransaction={sendTransaction}
                onCreateGoal={handleCreateFirstGoal}
                onGoalClick={handleGoalCardClick}
                onQuickSaveClick={onQuickSaveClick}
                vaultPositions={vaultPositions}
                vaultPositionsLoading={vaultPositionsLoading}
                onRequestVaultPositions={onRequestVaultPositions}
              />
            )}
          </div>

          {/* Loading indicator for goals data */}
          {combinedLoading && (
            <div className="flex items-center justify-center py-2 mb-3">
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400 mx-auto mb-2"></div>
                <p className="text-gray-400 text-sm">Loading your goals...</p>
              </div>
            </div>
          )}

          {/* Recent Activity Section - Replace My Goals */}
          <RecentActivitySection 
            account={account}
            exchangeRate={exchangeRate}
          />
        </>
      )}
    </div>
  );
}
