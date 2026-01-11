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
  handleCreateFirstGoal: () => void;
  handleGoalCardClick: (goal: any) => void;
  fetchUserPortfolio: () => void;
  fetchUserGoals: () => void;
  toggleBalanceVisibility: () => void;
  setQuickSaveDetailsOpen: (open: boolean) => void;
  setWithdrawalModalOpen: (open: boolean) => void;
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
  handleCreateFirstGoal,
  handleGoalCardClick,
  fetchUserPortfolio,
  fetchUserGoals,
  toggleBalanceVisibility,
  setQuickSaveDetailsOpen,
  setWithdrawalModalOpen,
  sendTransaction,
}: GoalsSectionProps) {
  const getKESRate = () => exchangeRate;

  return (
    <div className="py-4">
      {/* Error State - only show when there's an error and not loading */}
      {combinedError && !combinedLoading && (
        <div className="text-center py-8">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
            <p className="text-red-400 mb-2">Failed to load data</p>
            <p className="text-gray-400 text-sm">
              {goalsError || portfolioError || "Unknown error occurred"}
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <ActionButton onClick={fetchUserGoals} variant="outline" size="sm">
              Retry Goals
            </ActionButton>
            <ActionButton
              onClick={fetchUserPortfolio}
              variant="outline"
              size="sm"
            >
              Retry Positions
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
                onDeposit={() => setQuickSaveDetailsOpen(true)}
                onWithdraw={() => setWithdrawalModalOpen(true)}
                defaultToken={defaultToken}
                chain={chain}
                tokenInfo={tokenInfos}
                exchangeRate={getKESRate() || undefined}
                onGoalsRefetch={() => {
                  fetchUserPortfolio();
                  fetchUserGoals();
                }}
                sendTransaction={sendTransaction}
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

          {/* User Goals Section */}
          <section className="mb-20 pb-4" aria-labelledby="goals-heading">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp
                className="w-5 h-5 text-gray-400"
                aria-hidden="true"
              />
              <h2
                id="goals-heading"
                className="text-lg font-semibold text-white"
              >
                My Goals
              </h2>
            </div>

            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6"
              role="grid"
              aria-label="Savings goals"
            >
              {goalsLoading ? (
                // Show skeleton cards while loading
                <>
                  <GoalCardSkeleton />
                  <GoalCardSkeleton />
                  <GoalCardSkeleton />
                </>
              ) : (
                <>
                  {combinedGoals
                    .filter((g) => g.category !== "quick")
                    .map((goal, index) => (
                      <div
                        key={goal.metaGoalId || goal.id}
                        role="gridcell"
                        aria-label={`Goal ${index + 1}: ${
                          goal.name || goal.title
                        }`}
                      >
                        <GoalCard
                          goal={goal as unknown as FrontendGoal}
                          showBalance={showBalances}
                          onCardClick={() => handleGoalCardClick(goal)}
                          exchangeRate={getKESRate() || undefined}
                        />
                      </div>
                    ))}

                  {/* Show empty state if no user goals exist */}
                  {combinedGoals.filter((g) => g.category !== "quick")
                    .length === 0 && (
                    <div
                      className="col-span-full text-center py-8"
                      role="region"
                      aria-label="No goals available"
                    >
                      <p className="text-gray-400 mb-4">
                        No custom goals created yet
                      </p>
                      <ActionButton
                        onClick={handleCreateFirstGoal}
                        variant="primary"
                        size="lg"
                        className="w-full max-w-xs mx-auto"
                        aria-describedby="create-goal-description"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Create Your First Goal
                      </ActionButton>
                      <div id="create-goal-description" className="sr-only">
                        Opens a form to create your first savings goal
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
