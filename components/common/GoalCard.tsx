import React from "react";
import { Eye, EyeOff, ChevronRight } from "lucide-react";
import { InfoCard } from "../ui/InfoCard";
import { ProgressBar } from "../ui/ProgressBar";
import { FrontendGoal } from "@/lib/utils/goalTransforms";

interface GoalCardProps {
  goal: FrontendGoal;
  showBalance?: boolean;
  onToggleBalance?: () => void;
  onCardClick?: () => void;
  exchangeRate?: number;
}

export const GoalCard = ({
  goal,
  showBalance = true,
  onToggleBalance,
  onCardClick,
  exchangeRate,
}: GoalCardProps) => {
  const formatAmount = (amount: string) => {
    if (!showBalance) return "****";
    const usdAmount = Number(amount) || 0;
    if (isNaN(usdAmount)) return "0";
    if (exchangeRate && exchangeRate > 0) {
      const kesAmount = usdAmount * exchangeRate;
      return new Intl.NumberFormat("en-KE").format(kesAmount);
    }
    return new Intl.NumberFormat("en-KE").format(usdAmount);
  };

  const formatTargetAmount = (amount: string) => {
    if (!showBalance) return "****";
    const usdAmount = Number(amount) || 0;
    if (isNaN(usdAmount)) return "0";
    if (exchangeRate && exchangeRate > 0) {
      const kesAmount = usdAmount * exchangeRate;
      return new Intl.NumberFormat("en-KE").format(kesAmount);
    }
    return new Intl.NumberFormat("en-KE").format(usdAmount);
  };

  // Special styling for Quick Save card
  if (goal.category === "quick") {
    return (
      <div
        className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg overflow-hidden relative cursor-pointer hover:scale-[1.01] transition-transform duration-200 border-0"
        onClick={onCardClick}
      >
        {/* Header Section */}
        <div className="p-3 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <h3 className="text-base font-bold text-white mb-0.5">
                {goal.title}
              </h3>
              <div className="text-xs text-white/70">Current Balance</div>
            </div>
            <div className="text-xl opacity-80">🐷</div>
          </div>

          {/* Balance Display */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-lg font-bold text-white">
              KES {formatAmount(goal.currentAmount)}
            </div>
            {onToggleBalance && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBalance();
                }}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-1.5 py-1 rounded-full text-xs font-medium transition-all duration-200 min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                {showBalance ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
              </button>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCardClick?.();
              }}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 min-h-[28px] flex items-center justify-center"
            >
              Save Now
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Handle withdraw action
              }}
              className="bg-transparent border border-white/40 text-white hover:bg-white/10 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 min-h-[28px] flex items-center justify-center"
            >
              Withdraw
            </button>
          </div>
        </div>

        {/* Description Section */}
        {goal.description && (
          <div className="bg-black/20 p-2 backdrop-blur-sm">
            <p className="text-xs text-white/90 leading-relaxed">
              {goal.description}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Regular goal cards
  const getCardBackground = () => {
    if (goal.category === "personal") {
      return "bg-gray-800/20 backdrop-blur-sm border border-gray-700/30";
    }
    if (goal.category === "retirement") {
      return "bg-gray-800/20 backdrop-blur-sm border border-gray-700/30";
    }
    return "bg-gray-800/20 backdrop-blur-sm border border-gray-700/30";
  };

  return (
    <div
      className={`rounded-lg overflow-hidden relative cursor-pointer hover:scale-[1.01] transition-transform duration-200 ${getCardBackground()}`}
      onClick={onCardClick}
    >
      {/* Background pattern for personal goals */}
      {goal.category === "personal" && (
        <div className="absolute inset-0 opacity-20">
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-teal-500/30">
            {/* Chart-like dots pattern */}
            <div className="flex items-end justify-center space-x-1 h-full p-3">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-teal-400 rounded-full"
                  style={{ height: `${Math.random() * 60 + 20}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Background for retirement goals */}
      {goal.category === "retirement" && (
        <div className="absolute inset-0 opacity-30">
          <div className="absolute bottom-0 right-0 text-4xl p-3">☂️</div>
        </div>
      )}

      <div className="p-2.5 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-1.5">
              <span>{goal.title}</span>
              <div className="w-2.5 h-2.5 border border-gray-400 rounded-sm flex items-center justify-center">
                <ChevronRight className="w-1.5 h-1.5 text-gray-400" />
              </div>
            </h3>
          </div>
          <span className="text-xs font-bold text-cyan-400">
            {isNaN(goal.progress || 0) ? '0.0' : (goal.progress || 0).toFixed(1)}%
          </span>
        </div>

        {/* Amount Section */}
        <InfoCard variant="stats" className="mb-0">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-gray-300">Amount saved (KES)</div>
            {onToggleBalance && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBalance();
                }}
                className="text-gray-400 hover:text-white p-0.5 rounded transition-colors duration-200"
              >
                {showBalance ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
              </button>
            )}
          </div>

          <div className="text-lg font-bold text-white mb-2">
            {formatAmount(goal.currentAmount)} of{" "}
            {formatTargetAmount(goal.targetAmount)}
          </div>

          {/* Progress bar */}
          <ProgressBar progress={isNaN(goal.progress || 0) ? 0 : (goal.progress || 0)} />
        </InfoCard>
      </div>
    </div>
  );
};
