"use client";

import { useState, useEffect } from "react";
import { Activity, ArrowUpRight, ArrowDownLeft, Clock, ExternalLink, Repeat } from "lucide-react";
import { activityService, type ActivityItem } from "@/lib/services/activityService";

interface RecentActivitySectionProps {
  account?: any;
  exchangeRate?: number;
}

export function RecentActivitySection({ account, exchangeRate }: RecentActivitySectionProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async () => {
    if (!account?.address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const userActivities = await activityService.fetchUserActivity(account.address, 10);
      setActivities(userActivities);
    } catch (err) {
      setError("Failed to load recent activity");
      console.error("Error fetching activities:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [account?.address]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "deposit":
        return <ArrowDownLeft className="w-4 h-4 text-green-400" />;
      case "withdrawal":
        return <ArrowUpRight className="w-4 h-4 text-red-400" />;
      case "transfer":
        return <ArrowUpRight className="w-4 h-4 text-blue-400" />;
      case "goal_creation":
        return <Activity className="w-4 h-4 text-purple-400" />;
      case "goal_join":
        return <Activity className="w-4 h-4 text-cyan-400" />;
      case "swap":
        return <Repeat className="w-4 h-4 text-orange-400" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ActivityItem["status"]) => {
    switch (status) {
      case "completed":
        return "text-green-400";
      case "pending":
        return "text-yellow-400";
      case "failed":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    if (amount === 0) return "";
    
    const usdAmount = `$${amount.toFixed(2)} ${currency}`;
    
    if (exchangeRate && exchangeRate > 0) {
      const kesAmount = amount * exchangeRate;
      return `${usdAmount} (≈ Ksh${kesAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })})`;
    }
    
    return usdAmount;
  };

  if (!account) {
    return (
      <section className="mb-20 pb-4">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-400">Connect your wallet to view recent activity</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-20 pb-4" aria-labelledby="activity-heading">
      <div className="flex items-center space-x-2 mb-4">
        <Activity className="w-5 h-5 text-gray-400" aria-hidden="true" />
        <h2 id="activity-heading" className="text-lg font-semibold text-white">
          Recent Activity
        </h2>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400 mr-3"></div>
          <span className="text-gray-400">Loading activity...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchActivities}
            className="text-red-300 hover:text-red-200 text-sm mt-2 underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No recent activity</p>
              <p className="text-gray-500 text-sm">
                Your transactions and goal activities will appear here
              </p>
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="mt-1">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-white font-medium truncate">
                          {activity.description}
                        </p>
                        <span className={`text-xs px-2 py-1 rounded-full bg-gray-700 ${getStatusColor(activity.status)}`}>
                          {activity.status}
                        </span>
                      </div>
                      {activity.goalName && (
                        <p className="text-gray-400 text-sm mt-1">
                          Goal: {activity.goalName}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-gray-500 text-sm">
                          {formatTimestamp(activity.timestamp)}
                        </span>
                        {activity.txHash && (
                          <a
                            href={`https://celoscan.io/tx/${activity.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center space-x-1"
                          >
                            <span>View</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  {activity.amount > 0 && (
                    <div className="text-right">
                      <p className="text-white font-medium">
                        {formatAmount(activity.amount, activity.currency)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}