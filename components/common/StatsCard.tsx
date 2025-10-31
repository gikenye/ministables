import React from "react";
import { Eye, EyeOff } from "lucide-react";

interface StatItem {
  label: string;
  value: string;
  subValue?: string;
}

interface StatsCardProps {
  title: string;
  showValues?: boolean;
  onToggleVisibility?: () => void;
  stats: StatItem[];
  gradient?: string;
  className?: string;
}

export const StatsCard = ({
  title,
  showValues = true,
  onToggleVisibility,
  stats,
  gradient = "bg-gradient-to-r from-teal-500 to-cyan-500",
  className = "",
}: StatsCardProps) => {
  const formatValue = (value: string) => {
    if (!showValues) return "****";
    return value;
  };

  return (
    <div className={`rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className={`${gradient} p-4`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {onToggleVisibility && (
            <button
              onClick={onToggleVisibility}
              className="p-2 text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/10"
            >
              {showValues ? (
                <Eye className="w-5 h-5" />
              ) : (
                <EyeOff className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="bg-gray-800 p-4">
        <div className="grid gap-3">
          {stats.length === 1 ? (
            // Single stat - full width
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="text-center">
                <div className="text-sm text-gray-300 mb-1">
                  {stats[0].label}
                </div>
                <div className="text-xl font-bold text-white">
                  KES {formatValue(stats[0].value)}
                </div>
                {stats[0].subValue && (
                  <div className="text-xs text-gray-400 mt-1">
                    {formatValue(stats[0].subValue)}
                  </div>
                )}
              </div>
            </div>
          ) : stats.length === 2 ? (
            // Two stats - side by side
            <div className="grid grid-cols-2 gap-3">
              {stats.map((stat, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-3">
                  <div className="text-center">
                    <div className="text-xs text-gray-300 mb-1">
                      {stat.label}
                    </div>
                    <div className="text-lg font-bold text-white">
                      KES {formatValue(stat.value)}
                    </div>
                    {stat.subValue && (
                      <div className="text-xs text-gray-400 mt-1">
                        {formatValue(stat.subValue)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Three or more stats - first one full width, rest in grid
            <>
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="text-center">
                  <div className="text-sm text-gray-300 mb-1">
                    {stats[0].label}
                  </div>
                  <div className="text-xl font-bold text-white">
                    KES {formatValue(stats[0].value)}
                  </div>
                  {stats[0].subValue && (
                    <div className="text-xs text-gray-400 mt-1">
                      {formatValue(stats[0].subValue)}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {stats.slice(1).map((stat, index) => (
                  <div key={index + 1} className="bg-gray-700 rounded-lg p-3">
                    <div className="text-center">
                      <div className="text-xs text-gray-300 mb-1">
                        {stat.label}
                      </div>
                      <div className="text-lg font-bold text-white">
                        KES {formatValue(stat.value)}
                      </div>
                      {stat.subValue && (
                        <div className="text-xs text-gray-400 mt-1">
                          {formatValue(stat.subValue)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
