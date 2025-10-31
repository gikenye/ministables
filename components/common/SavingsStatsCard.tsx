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
    <div className="bg-gray-800 rounded-lg p-4 mx-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-white">Your Savings</h2>
        <button
          onClick={onToggleBalance}
          className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700"
        >
          {showBalance ? (
            <Eye className="w-5 h-5" />
          ) : (
            <EyeOff className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="grid gap-3">
        {/* All time savings */}
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-white">
                KES {formatAmount(allTimeSavings)}
              </p>
              <p className="text-sm text-gray-400">All time savings</p>
            </div>
          </div>
        </div>

        {/* Current and Group savings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-700 rounded-lg p-3">
            <p className="text-lg font-semibold text-white">
              KES {formatAmount(currentSavings)}
            </p>
            <p className="text-sm text-gray-400">Current savings</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <p className="text-lg font-semibold text-white">
              KES {formatAmount(groupSavings)}
            </p>
            <p className="text-sm text-gray-400">All time group savings</p>
          </div>
        </div>
      </div>
    </div>
  );
};
