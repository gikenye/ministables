"use client";

import React, { useState } from "react";
import { Plus, Shield, DollarSign, Users, Calendar } from "lucide-react";
import { ActionButton } from "@/components/ui";
import { GroupSavingsGoal } from "@/lib/services/backendApiService";
import { Account, MyGroups } from "@/lib/types/shared";
import { theme } from "@/lib/theme";

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

const GroupGoalDetailsModal = ({
  goal,
  onClose,
  onJoin,
  exchangeRate,
  isMyGoal,
}: {
  goal: GroupSavingsGoal;
  onClose: () => void;
  onJoin?: () => void;
  exchangeRate?: number;
  isMyGoal?: boolean;
}) => {
  const formatAmount = (usdAmount: number) => {
    if (exchangeRate) {
      return `KES ${(usdAmount * exchangeRate).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
    }
    return `$${usdAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  };

  const currentAmount = goal.totalProgressUSD || 0;
  const targetAmount = goal.targetAmountUSD || 0;
  const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
  const remaining = targetAmount > 0 ? Math.max(targetAmount - currentAmount, 0) : 0;
  const participants = goal.participants?.length || 0;

  const shareOnWhatsApp = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteLink = `${baseUrl}/goals/${goal.metaGoalId}?inviter=${goal.creatorAddress}`;
    const message = `Join my savings goal "${goal.name}"!\n\nTarget: ${formatAmount(targetAmount)}\nProgress: ${progress.toFixed(1)}%\nParticipants: ${participants}\n\n${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ backgroundImage: 'linear-gradient(to bottom right, #1e3a8a, #0d9488)' }} onClick={(e) => e.stopPropagation()}>
        <div className="p-4 flex justify-between items-center border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}>
          <h2 className="text-lg font-semibold" style={{ color: theme.colors.cardText }}>{goal.name}</h2>
          <button onClick={onClose} className="p-2 transition-colors" style={{ color: theme.colors.cardTextSecondary }}>
            <span className="text-xl">×</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center space-y-4">
            <div className="text-sm" style={{ color: theme.colors.cardTextSecondary }}>
              Total Raised
            </div>
            <div className="text-4xl font-bold" style={{ color: theme.colors.cardText }}>
              {formatAmount(currentAmount)}
            </div>

            {targetAmount > 0 && (
              <>
                <div className="w-full rounded-full h-2" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                  <div 
                    className="h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${progress}%`,
                      backgroundColor: theme.colors.cardText,
                    }}
                  />
                </div>
                
                <div className="text-sm" style={{ color: theme.colors.cardTextSecondary }}>
                  {remaining > 0 ? (
                    <>{formatAmount(remaining)} to go</>
                  ) : (
                    "🎉 Goal reached!"
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-xl backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
              <Users className="w-4 h-4 mx-auto mb-1" style={{ color: theme.colors.cardTextSecondary }} />
              <div className="text-lg font-bold" style={{ color: theme.colors.cardText }}>{participants}</div>
              <div className="text-xs" style={{ color: theme.colors.cardTextSecondary }}>Members</div>
            </div>
            <div className="text-center p-3 rounded-xl backdrop-blur-sm" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
              <DollarSign className="w-4 h-4 mx-auto mb-1" style={{ color: theme.colors.cardTextSecondary }} />
              <div className="text-lg font-bold" style={{ color: theme.colors.cardText }}>{formatAmount(targetAmount)}</div>
              <div className="text-xs" style={{ color: theme.colors.cardTextSecondary }}>Target</div>
            </div>
          </div>

          {goal.targetDate && goal.targetDate !== '0' && goal.targetDate !== '' && (
            <div className="flex items-center justify-center gap-2 text-sm" style={{ color: theme.colors.cardTextSecondary }}>
              <Calendar className="w-4 h-4" />
              <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>
            </div>
          )}

          <div className="space-y-3">
            {!isMyGoal && onJoin && (
              <ActionButton onClick={onJoin} variant="primary" size="md" className="w-full">
                Join Goal
              </ActionButton>
            )}
            
            <button
              onClick={shareOnWhatsApp}
              className="w-full py-3 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: theme.colors.cardText,
              }}
            >
              <img width="20" height="20" src="https://img.icons8.com/3d-fluency/94/whatsapp.png" alt="whatsapp" />
              Share with Friends
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const GroupGoalCard = ({
  goal,
  onClick,
  exchangeRate,
  isMyGoal,
}: {
  goal: GroupSavingsGoal;
  onClick: () => void;
  exchangeRate?: number;
  isMyGoal?: boolean;
}) => {
  const formatAmount = (usdAmount: number) => {
    if (exchangeRate) {
      return `KES ${(usdAmount * exchangeRate).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
    }
    return `$${usdAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  };

  const currentAmount = goal.totalProgressUSD || 0;
  const targetAmount = goal.targetAmountUSD || 0;
  const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
  const remaining = targetAmount > 0 ? Math.max(targetAmount - currentAmount, 0) : 0;

  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-5 cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-95"
      style={{
        backgroundImage: 'linear-gradient(to bottom right, #1e3a8a, #0d9488)',
      }}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium" style={{ color: theme.colors.cardTextSecondary }}>
            {goal.name}
          </div>
          {isMyGoal && (
            <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: theme.colors.cardText }}>
              Your Goal
            </div>
          )}
        </div>
        
        <div className="text-3xl font-bold" style={{ color: theme.colors.cardText }}>
          {formatAmount(currentAmount)}
        </div>

        {targetAmount > 0 && (
          <>
            <div className="w-full rounded-full h-2" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
              <div 
                className="h-2 rounded-full transition-all duration-300" 
                style={{ 
                  width: `${progress}%`,
                  backgroundColor: theme.colors.cardText,
                }}
              />
            </div>
            
            <div className="text-xs" style={{ color: theme.colors.cardTextSecondary }}>
              {remaining > 0 ? (
                <>{formatAmount(remaining)} to go • {goal.participants?.length || 0} members</>
              ) : (
                "🎉 Goal reached!"
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const ClanTab: React.FC<ClanTabProps> = ({
  account,
  groupGoals,
  myGroups,
  myGroupsLoading,
  groupGoalsLoading,
  onCreateGroupGoal,
  onJoinGroupGoal,
  exchangeRate,
}) => {
  const [selectedGoal, setSelectedGoal] = useState<GroupSavingsGoal | null>(null);
  const [selectedGoalIsMyGoal, setSelectedGoalIsMyGoal] = useState(false);
  const [activeTab, setActiveTab] = useState<"my" | "available">("my");

  if (!account?.address) {
    return (
      <div className="py-8">
        <div className="text-center py-12 rounded-2xl" style={{ backgroundImage: 'linear-gradient(to bottom right, #1e3a8a, #0d9488)' }}>
          <Shield className="w-12 h-12 mx-auto mb-4" style={{ color: theme.colors.cardText }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.cardText }}>
            Connect Your Wallet
          </h3>
          <p className="text-sm max-w-md mx-auto" style={{ color: theme.colors.cardTextSecondary }}>
            Connect your wallet to view and manage group savings goals
          </p>
        </div>
      </div>
    );
  }

  if (myGroupsLoading || groupGoalsLoading) {
    return (
      <div className="py-8 space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-2xl p-5 animate-pulse h-32" style={{ backgroundColor: theme.colors.cardButton }}></div>
        ))}
      </div>
    );
  }

  const myPublicGoals = myGroups?.public?.goals || [];
  const myPrivateGoals = myGroups?.private?.goals || [];
  const allMyGoals = [...myPublicGoals, ...myPrivateGoals];
  const availableGoals = groupGoals.filter(g => g.isPublic && !allMyGoals.find(mg => mg.metaGoalId === g.metaGoalId));

  return (
    <div className="py-8 space-y-6">
      <div className="flex gap-2 p-1 rounded-xl backdrop-blur-sm" style={{ backgroundColor: theme.colors.cardButton, border: `1px solid ${theme.colors.cardButtonBorder}` }}>
        <button
          onClick={() => setActiveTab("my")}
          className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all"
          style={{
            backgroundColor: activeTab === "my" ? theme.colors.cardText : 'transparent',
            color: activeTab === "my" ? theme.colors.cardGradientFrom : theme.colors.cardText,
          }}
        >
          My Goals ({allMyGoals.length})
        </button>
        <button
          onClick={() => setActiveTab("available")}
          className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all"
          style={{
            backgroundColor: activeTab === "available" ? theme.colors.cardText : 'transparent',
            color: activeTab === "available" ? theme.colors.cardGradientFrom : theme.colors.cardText,
          }}
        >
          Available ({availableGoals.length})
        </button>
      </div>

      {activeTab === "my" && (
        <>
          {allMyGoals.length === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ backgroundImage: 'linear-gradient(to bottom right, #1e3a8a, #0d9488)' }}>
              <DollarSign className="w-12 h-12 mx-auto mb-4" style={{ color: theme.colors.cardText }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.cardText }}>
                Start Saving Together
              </h3>
              <p className="text-sm max-w-md mx-auto mb-6" style={{ color: theme.colors.cardTextSecondary }}>
                Create a group savings goal and invite friends to save together
              </p>
              <ActionButton onClick={onCreateGroupGoal} variant="primary" size="md">
                <Plus className="w-4 h-4 mr-2" />
                Create Group Goal
              </ActionButton>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold" style={{ color: theme.colors.cardText }}>
                  Your Group Goals
                </h2>
                <ActionButton onClick={onCreateGroupGoal} variant="primary" size="sm">
                  <Plus className="w-4 h-4" />
                </ActionButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allMyGoals.map((goal) => (
                  <GroupGoalCard
                    key={goal.metaGoalId}
                    goal={goal}
                    onClick={() => {
                      setSelectedGoal(goal);
                      setSelectedGoalIsMyGoal(true);
                    }}
                    exchangeRate={exchangeRate}
                    isMyGoal={true}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === "available" && (
        <>
          {availableGoals.length === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ backgroundImage: 'linear-gradient(to bottom right, #1e3a8a, #0d9488)' }}>
              <Users className="w-12 h-12 mx-auto mb-4" style={{ color: theme.colors.cardText }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.cardText }}>
                No Available Goals
              </h3>
              <p className="text-sm max-w-md mx-auto" style={{ color: theme.colors.cardTextSecondary }}>
                Be the first to create a public goal for others to join
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold" style={{ color: theme.colors.cardText }}>
                Join a Group Goal
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableGoals.map((goal) => (
                  <GroupGoalCard
                    key={goal.metaGoalId}
                    goal={goal}
                    onClick={() => {
                      setSelectedGoal(goal);
                      setSelectedGoalIsMyGoal(false);
                    }}
                    exchangeRate={exchangeRate}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {selectedGoal && (
        <GroupGoalDetailsModal
          goal={selectedGoal}
          onClose={() => {
            setSelectedGoal(null);
            setSelectedGoalIsMyGoal(false);
          }}
          onJoin={!selectedGoalIsMyGoal ? () => onJoinGroupGoal(selectedGoal) : undefined}
          exchangeRate={exchangeRate}
          isMyGoal={selectedGoalIsMyGoal}
        />
      )}
    </div>
  );
};

export default ClanTab;
