import React from "react";
import { Eye, EyeOff } from "lucide-react";

interface SavingsStatsCardProps {
  allTimeSavings: string;
  currentSavings: string;
  groupSavings: string;
  showBalance: boolean;
  onToggleBalance: () => void;
}

export const SavingsStatsCard = ({
  allTimeSavings,
  currentSavings,
  groupSavings,
  showBalance,
  onToggleBalance,
}: SavingsStatsCardProps) => {
  const formatAmount = (amount: string) => {
    if (!showBalance) return "****";
    return new Intl.NumberFormat("en-KE").format(Number(amount));
  };

  return (
    <div className="bg-gray-800/20 backdrop-blur-sm rounded-lg p-3 mx-4 mt-3 border border-gray-700/30">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-white">Your Savings</h2>
        <button
          onClick={onToggleBalance}
          className="p-1.5 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700"
        >
          {showBalance ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="grid gap-2">
        {/* All time savings */}
        <div className="bg-gray-800/20 backdrop-blur-sm rounded-lg p-2.5 border border-gray-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-white">
                KES {formatAmount(allTimeSavings)}
              </p>
              <p className="text-xs text-gray-400">All time savings</p>
            </div>
          </div>
        </div>

        {/* Current and Group savings */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-800/20 backdrop-blur-sm rounded-lg p-2.5 border border-gray-700/30">
            <p className="text-base font-semibold text-white">
              KES {formatAmount(currentSavings)}
            </p>
            <p className="text-xs text-gray-400">Current savings</p>
          </div>
          <div className="bg-gray-800/20 backdrop-blur-sm rounded-lg p-2.5 border border-gray-700/30">
            <p className="text-base font-semibold text-white">
              KES {formatAmount(groupSavings)}
            </p>
            <p className="text-xs text-gray-400">All time group savings</p>
          </div>
        </div>
      </div>
    </div>
  );
};
