"use client";

import React, { useState } from "react";
import {
  Users,
  Plus,
  ChevronRight,
  Globe,
  Lock,
  Calendar,
  DollarSign,
  Activity,
  Shield,
  X,
  Share2,
  TrendingUp,
} from "lucide-react";
import { ActionButton, InfoCard, ProgressBar } from "@/components/ui";
import { GroupSavingsGoal } from "@/lib/services/backendApiService";
import { Account, MyGroups } from "@/lib/types/shared";

interface ClanTabProps {
  account?: Account;
  groupGoals: GroupSavingsGoal[];
  myGroups?: MyGroups;
  groupGoalsLoading: boolean;
  myGroupsLoading: boolean;
  onCreateGroupGoal: () => void;
  onJoinGroupGoal: (goal: GroupSavingsGoal) => void;
  onRefreshGroups: () => void;
  exchangeRate?: number;
}

// Goal Details Modal
const GoalDetailsModal = ({
  goal,
  onClose,
  exchangeRate,
}: {
  goal: GroupSavingsGoal;
  onClose: () => void;
  exchangeRate?: number;
}) => {
  const progress = goal.progressPercent || 0;
  const formatAmount = (usdAmount: number) => {
    if (exchangeRate) {
      return `KES ${(usdAmount * exchangeRate).toLocaleString()}`;
    }
    return `$${usdAmount.toLocaleString()}`;
  };

  const shareOnWhatsApp = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteLink = `${baseUrl}/api/invite/${goal.metaGoalId}`;
    const message = `Join my savings goal "${goal.name}"!\n\nTarget: ${formatAmount(goal.targetAmountUSD)}\nProgress: ${progress.toFixed(1)}%\nParticipants: ${goal.participants?.length || 0}\n\n${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">{goal.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Target</div>
              <div className="text-lg font-bold text-white">{formatAmount(goal.targetAmountUSD)}</div>
            </div>
            <div className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Progress</div>
              <div className="text-lg font-bold text-cyan-400">{progress.toFixed(1)}%</div>
            </div>
            <div className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Raised</div>
              <div className="text-lg font-bold text-green-400">{formatAmount(goal.totalProgressUSD || 0)}</div>
            </div>
            <div className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Participants</div>
              <div className="text-lg font-bold text-white">{goal.participants?.length || 0}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg p-3">
            <ProgressBar progress={progress} height="sm" className="bg-gray-700 rounded-full" />
          </div>

          {/* Additional Info */}
          <div className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              {goal.isPublic ? <Globe className="w-4 h-4 text-cyan-400" /> : <Lock className="w-4 h-4 text-gray-400" />}
              <span>{goal.isPublic ? 'Public Goal' : 'Private Goal'}</span>
            </div>
            {goal.targetDate && goal.targetDate !== '0' && goal.targetDate !== '' && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span>Created: {new Date(goal.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Share Button */}
          <ActionButton
            onClick={shareOnWhatsApp}
            variant="primary"
            size="sm"
            className="w-full flex items-center justify-center gap-2"
          >
            <img width="20" height="20" src="https://img.icons8.com/3d-fluency/94/whatsapp.png" alt="whatsapp" />
            Share on WhatsApp
          </ActionButton>
        </div>
      </div>
    </div>
  );
};

// Redesigned Group Goal Card - Financial Focus
const GroupGoalCard = ({
  goal,
  isMyGroup = false,
  onJoin,
  onView,
  exchangeRate,
}: {
  goal: GroupSavingsGoal;
  isMyGroup?: boolean;
  onJoin: () => void;
  onView: () => void;
  exchangeRate?: number;
}) => {
  const progress = goal.progressPercent || 0;

  const formatAmount = (usdAmount: number) => {
    if (exchangeRate) {
      const kesAmount = usdAmount * exchangeRate;
      return `KES ${kesAmount.toLocaleString()}`;
    }
    return `$${usdAmount.toLocaleString()}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-400";
      case "completed":
        return "text-blue-400";
      case "paused":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div
      onClick={isMyGroup ? onView : onJoin}
      className="rounded-lg border bg-gray-800/20 backdrop-blur-sm border-gray-700/30 p-4 hover:border-cyan-400/50 transition-all duration-300 cursor-pointer"
    >
      {/* Header: Clear, focused financial information */}
      <div className="flex justify-between mb-3">
        <div>
          <h3 className="text-white font-medium text-sm">{goal.name}</h3>
          <div className="mt-1">
            {/* Status indicator - simplified */}
            <div className="text-xs text-gray-400">
              {goal.isPublic ? "Public Goal" : "Private Goal"} •{" "}
              {goal.status || "Active"}
            </div>
          </div>
        </div>

        {/* Owner indicator - simplified */}
        {isMyGroup && (
          <div className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded">
            Your Goal
          </div>
        )}
      </div>

      {/* Financial Information - Given Priority */}
      <div className="flex justify-between mb-3">
        <div>
          <div className="text-sm text-gray-400">Target</div>
          <div className="text-lg font-bold text-white">
            {formatAmount(goal.targetAmountUSD || 0)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Progress</div>
          <div className="text-lg font-bold text-cyan-400">
            {progress.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Progress Indicator - Simplified */}
      <div className="mb-4">
        <ProgressBar
          progress={progress}
          height="sm"
          className="bg-gray-700 rounded-full"
        />
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{formatAmount(goal.totalProgressUSD || 0)} raised</span>
          <span>{goal.participants?.length || 0} participants</span>
        </div>
      </div>

      {/* Key Dates - Added Financial Context */}
      {goal.targetDate && goal.targetDate !== "0" && goal.targetDate !== "" && (
        <div className="mb-3 bg-gray-800/20 p-2 rounded border border-gray-700/30">
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-3 h-3 text-gray-400" />
            <span>
              Target completion:{" "}
              {new Date(goal.targetDate).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Financial Summary Component
const FinancialSummary = ({
  account,
  myGroups,
  loading,
}: {
  account?: Account;
  myGroups?: MyGroups;
  loading: boolean;
}) => {
  if (loading || !account) {
    return (
      <InfoCard variant="stats" className="animate-pulse p-4 mb-6">
        <div className="h-20 bg-gray-800/50 rounded"></div>
      </InfoCard>
    );
  }

  // Calculate totals from user's groups
  const publicGoals = myGroups?.public?.goals || [];
  const privateGoals = myGroups?.private?.goals || [];

  const totalSaved = [...publicGoals, ...privateGoals].reduce(
    (total, goal) => total + (goal.totalProgressUSD || 0),
    0
  );

  const totalGoals =
    (myGroups?.public?.total || 0) + (myGroups?.private?.total || 0);

  return (
    <InfoCard variant="stats" className="p-4 mb-6">
      <h3 className="text-sm font-medium text-white mb-3">
        Your Financial Summary
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-400 mb-1">Total Saved</div>
          <div className="text-lg font-bold text-cyan-400">
            ${totalSaved.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Active Goals</div>
          <div className="text-lg font-bold text-white">{totalGoals}</div>
        </div>
      </div>
    </InfoCard>
  );
};

// Main Component
export const ClanTab: React.FC<ClanTabProps> = ({
  account,
  groupGoals,
  myGroups,
  groupGoalsLoading,
  myGroupsLoading,
  onCreateGroupGoal,
  onJoinGroupGoal,
  onRefreshGroups,
  exchangeRate,
}) => {
  const [activeSection, setActiveSection] = useState<
    "myGoals" | "availableGoals"
  >("myGoals");
  const [selectedGoal, setSelectedGoal] = useState<GroupSavingsGoal | null>(null);

  // Get featured (curated) public goals - limit to 3
  const featuredPublicGoals = groupGoals
    .filter((goal) => goal.isPublic === true)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Financial Summary */}
      <FinancialSummary
        account={account}
        myGroups={myGroups}
        loading={myGroupsLoading || groupGoalsLoading}
      />

      {/* Simplified Navigation */}
      <div className="flex bg-gray-800/20 backdrop-blur-sm rounded-lg p-1">
        <button
          onClick={() => setActiveSection("myGoals")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeSection === "myGoals"
              ? "bg-cyan-400 text-gray-900"
              : "text-gray-400 hover:text-white"
          }`}
        >
          My Goals
        </button>
        <button
          onClick={() => setActiveSection("availableGoals")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeSection === "availableGoals"
              ? "bg-cyan-400 text-gray-900"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Available Goals
        </button>
      </div>

      {/* Content based on active section */}
      {activeSection === "myGoals" && (
        <div className="space-y-6">
          {/* My Goals Content */}
          {!account?.address ? (
            // Not connected state
            <div className="text-center py-8 bg-gray-800/20 rounded-lg p-6">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-gray-400 text-sm max-w-md mx-auto mb-0">
                Connect your wallet to view and manage your savings goals
                securely.
              </p>
            </div>
          ) : myGroupsLoading || groupGoalsLoading ? (
            // Loading state
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="bg-gray-800/20 rounded-xl p-4 animate-pulse h-32"
                ></div>
              ))}
            </div>
          ) : (
            (() => {
              // User's groups logic
              const myPublicGoals = myGroups?.public?.goals || [];
              const myPrivateGoals = myGroups?.private?.goals || [];
              const allMyGoals = [...myPublicGoals, ...myPrivateGoals];

              if (allMyGoals.length === 0) {
                // Empty state - focused on financial guidance
                return (
                  <div className="text-center py-8 bg-gray-800/20 rounded-lg p-6">
                    <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Start Your Savings Journey
                    </h3>
                    <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
                      Create your first group savings goal or join an existing
                      one to start building wealth together.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <ActionButton
                        onClick={onCreateGroupGoal}
                        variant="primary"
                        size="md"
                      >
                        Create Your First Goal
                      </ActionButton>
                    </div>
                  </div>
                );
              }

              // Display user's goals with financial focus
              return (
                <div className="space-y-6">
                  {/* User's group goals */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Your Active Savings Goals
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {allMyGoals.map((goal) => (
                        <GroupGoalCard
                          key={goal.metaGoalId}
                          goal={goal}
                          isMyGroup={true}
                          onJoin={() => setSelectedGoal(goal)}
                          onView={() => setSelectedGoal(goal)}
                          exchangeRate={exchangeRate}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {activeSection === "availableGoals" && (
        <div className="space-y-6">
          <div>
          
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Available Savings Goals
              </h3>
              <button
                onClick={onRefreshGroups}
                className="text-cyan-400 hover:text-cyan-300 text-sm transition-colors"
                disabled={groupGoalsLoading}
              >
                {groupGoalsLoading ? "Updating..." : "Update"}
              </button>
            </div>

            {groupGoalsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(2)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-gray-800/20 rounded-xl p-4 animate-pulse h-32"
                  ></div>
                ))}
              </div>
            ) : featuredPublicGoals.length === 0 ? (
              <div className="text-center py-8 bg-gray-800/20 rounded-lg p-6">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  No Available Goals
                </h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
                  There are no public savings goals available to join at the
                  moment.
                </p>
                <ActionButton
                  onClick={onCreateGroupGoal}
                  variant="primary"
                  size="md"
                >
                  Create First Public Goal
                </ActionButton>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featuredPublicGoals.map((goal) => (
                  <GroupGoalCard
                    key={goal.metaGoalId}
                    goal={goal}
                    onJoin={() => onJoinGroupGoal(goal)}
                    onView={() => onJoinGroupGoal(goal)}
                    exchangeRate={exchangeRate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Goal Details Modal */}
      {selectedGoal && (
        <GoalDetailsModal
          goal={selectedGoal}
          onClose={() => setSelectedGoal(null)}
          exchangeRate={exchangeRate}
        />
      )}
    </div>
  );
};

export default ClanTab;
