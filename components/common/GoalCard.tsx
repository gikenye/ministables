import React from "react";
import { FrontendGoal } from "@/lib/utils/goalTransforms";
import { theme } from "@/lib/theme";

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
  onCardClick,
  exchangeRate,
}: GoalCardProps) => {
  const formatAmount = (amount: string) => {
    if (!showBalance) return "••••";
    const usdAmount = Number(amount) || 0;
    if (isNaN(usdAmount)) return "0";
    if (exchangeRate && exchangeRate > 0) {
      const kesAmount = usdAmount * exchangeRate;
      return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(kesAmount);
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(usdAmount);
  };

  const currentAmount = Number(goal.currentAmount) || 0;
  const targetAmount = Number(goal.targetAmount) || 0;
  const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
  const remaining = targetAmount > 0 ? Math.max(targetAmount - currentAmount, 0) : 0;

  return (
    <div
      className="rounded-2xl p-5 cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-95"
      style={{
        backgroundImage: `linear-gradient(to bottom right, ${theme.colors.cardGradientFrom}, ${theme.colors.cardGradientTo})`,
      }}
      onClick={onCardClick}
    >
      <div className="space-y-3">
        <div className="text-sm font-medium" style={{ color: theme.colors.cardTextSecondary }}>
          {goal.title}
        </div>
        
        <div className="text-3xl font-bold" style={{ color: theme.colors.cardText }}>
          {exchangeRate ? "KES" : "$"} {formatAmount(goal.currentAmount)}
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
                <>{exchangeRate ? "KES" : "$"} {formatAmount(remaining.toString())} to go</>
              ) : (
                "Goal reached!"
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
