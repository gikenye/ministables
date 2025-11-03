import React from "react";
import { TrendingUp, Target, Flame, Calendar } from "lucide-react";

interface StatsBarProps {
  totalSaved: string;
  goalsCompleted: number;
  savingsStreak: number;
  memberSince: string;
  showBalance: boolean;
  className?: string;
}

export const StatsBar = ({
  totalSaved,
  goalsCompleted,
  savingsStreak,
  memberSince,
  showBalance,
  className = "",
}: StatsBarProps) => {
  const stats = [
    {
      label: "Total Saved",
      value: showBalance ? totalSaved : "••••",
      icon: <TrendingUp className="w-4 h-4" />,
      color: "text-green-400",
    },
    {
      label: "Goals Completed",
      value: goalsCompleted.toString(),
      icon: <Target className="w-4 h-4" />,
      color: "text-blue-400",
    },
    {
      label: "Savings Streak",
      value: `${savingsStreak}d`,
      icon: <Flame className="w-4 h-4" />,
      color: "text-orange-400",
    },
    {
      label: "Member Since",
      value: memberSince,
      icon: <Calendar className="w-4 h-4" />,
      color: "text-purple-400",
    },
  ];

  return (
    <div className={`${className}`}>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={stat.color}>{stat.icon}</div>
              <span className="text-xs text-gray-400 font-medium">
                {stat.label}
              </span>
            </div>
            <div className="text-lg font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
