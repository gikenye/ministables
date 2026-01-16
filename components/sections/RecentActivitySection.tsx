"use client";

import { useState, useEffect } from "react";
import { Activity, ArrowUpRight, ArrowDownLeft, Clock, ExternalLink, Repeat } from "lucide-react";
import { activityService, type ActivityItem } from "@/lib/services/activityService";
import { theme } from "@/lib/theme";

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
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getActivityIcon = (type: ActivityItem["type"]) => {
    const iconBase = "w-5 h-5 p-1 rounded-full bg-white/10";
    switch (type) {
      case "deposit": return <ArrowDownLeft className={`${iconBase} text-green-400`} />;
      case "withdrawal": return <ArrowUpRight className={`${iconBase} text-red-400`} />;
      case "transfer": return <ArrowUpRight className={`${iconBase} text-blue-400`} />;
      case "goal_creation": return <Activity className={`${iconBase} text-purple-400`} />;
      case "goal_join": return <Activity className={`${iconBase} text-cyan-400`} />;
      case "swap": return <Repeat className={`${iconBase} text-orange-400`} />;
      default: return <Activity className={`${iconBase} text-gray-400`} />;
    }
  };

  const getStatusBadge = (status: ActivityItem["status"]) => {
    const baseStyle = "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full";
    switch (status) {
      case "completed": return <span className={`${baseStyle} bg-green-500/10 text-green-400`}>completed</span>;
      case "pending": return <span className={`${baseStyle} bg-yellow-500/10 text-yellow-400`}>pending</span>;
      case "failed": return <span className={`${baseStyle} bg-red-500/10 text-red-400`}>failed</span>;
      default: return <span className={`${baseStyle} bg-gray-500/10 text-gray-400`}>{status}</span>;
    }
  };

  const formatAmount = (amount: number) => {
    if (amount === 0) return null;
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <section className="mb-24 px-1" aria-labelledby="activity-heading">
      <div className="flex items-center gap-2 mb-6 px-2">
        <Activity className="w-4 h-4 text-white/40" />
        <h2 id="activity-heading" className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
          Recent Activity
        </h2>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-50">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span className="text-xs font-bold tracking-widest uppercase">Fetching Vault History</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-[2rem] border border-white/5">
            <Clock className="w-8 h-8 text-white/10 mx-auto mb-3" />
            <p className="text-sm font-medium text-white/40 tracking-tight">Your activity history is empty</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="relative group overflow-hidden rounded-[1.5rem] border border-white/10 p-4 transition-all active:scale-[0.98]"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                backgroundImage: `radial-gradient(circle at top left, ${theme.colors.cardGradientFrom}10, transparent)`,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="relative">
                    {getActivityIcon(activity.type)}
                    <div className="absolute -inset-1 bg-white/5 rounded-full blur-md -z-10" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white truncate tracking-tight">
                        {activity.description}
                      </p>
                      {getStatusBadge(activity.status)}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-tighter text-white/30">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                      {activity.goalName && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-white/10" />
                          <span className="text-[10px] font-bold text-cyan-400/60 uppercase truncate tracking-tighter">
                             {activity.goalName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {activity.amount > 0 && (
                    <p className="text-sm font-black text-white tracking-tighter">
                      {formatAmount(activity.amount)}
                    </p>
                  )}
                  {activity.txHash && (
                    <a
                      href={`https://celoscan.io/tx/${activity.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-[10px] font-black uppercase text-cyan-400/80 hover:text-cyan-300 transition-colors"
                    >
                      View <ExternalLink className="w-2 h-2" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}