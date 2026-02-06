"use client";

import { useState, useEffect } from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, ExternalLink, Target, Wallet } from "lucide-react";
import { theme } from "@/lib/theme";
import { getTransactionUrl } from "@/config/chainConfig";
import { base, celo, scroll } from "thirdweb/chains";

interface ActivityItem {
  id: string;
  type: "deposit_attached" | "goal_created" | "onramp_completed" | "offramp_initiated";
  txHash: string;
  blockNumber: number;
  timestamp: string;
  chain: string;
  goalId?: string;
  depositId?: string;
  vault?: string;
  metadataURI?: string;
  asset?: string;
  amount?: string;
}

interface ActivityFeedProps {
  userAddress: string;
  limit?: number;
}

const CHAIN_IDS: Record<string, number> = {
  BASE: base.id,
  CELO: celo.id,
  SCROLL: scroll.id,
};

export function ActivityFeed({ userAddress, limit = 20 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userAddress) return;

    const fetchActivities = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/activity?userAddress=${userAddress}&limit=${limit}`);
        if (!response.ok) throw new Error("Failed to fetch activities");
        const data = await response.json();
        setActivities(data.activities || []);
      } catch (err) {
        setError("Failed to load activities");
        console.error("Error fetching activities:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [userAddress, limit]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getExplorerUrl = (chain: string, txHash: string) => {
    const chainId = CHAIN_IDS[chain];
    if (!chainId) return "#";
    return getTransactionUrl(chainId, txHash);
  };

  const getActivityIcon = (type: ActivityItem["type"]) => {
    if (type === "goal_created") {
      return <Target className="w-5 h-5 p-1 rounded-full bg-white/10 text-purple-400" />;
    }
    if (type === "onramp_completed") {
      return <ArrowUpRight className="w-5 h-5 p-1 rounded-full bg-white/10 text-emerald-400" />;
    }
    if (type === "offramp_initiated") {
      return <ArrowDownLeft className="w-5 h-5 p-1 rounded-full bg-white/10 text-cyan-400" />;
    }
    return <Wallet className="w-5 h-5 p-1 rounded-full bg-white/10 text-green-400" />;
  };

  const getActivityDescription = (activity: ActivityItem) => {
    if (activity.type === "goal_created") {
      const name = activity.metadataURI?.trim();
      return name ? `Created ${name}` : "Created Goal";
    }
    if (activity.type === "onramp_completed") {
      return "Onramp completed";
    }
    if (activity.type === "offramp_initiated") {
      return "Offramp initiated";
    }
    return "Deposit to Goal";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-50">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        <span className="text-xs font-bold tracking-widest uppercase">Loading Activities</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-white/5 rounded-[2rem] border border-white/5">
        <Activity className="w-8 h-8 text-red-400/50 mx-auto mb-3" />
        <p className="text-sm font-medium text-red-400/60 tracking-tight">{error}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 bg-white/5 rounded-[2rem] border border-white/5">
        <Activity className="w-8 h-8 text-white/10 mx-auto mb-3" />
        <p className="text-sm font-medium text-white/40 tracking-tight">No activities found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
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
                <p className="text-sm font-bold text-white truncate tracking-tight">
                  {getActivityDescription(activity)}
                </p>
                
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-white/30">
                    {formatTimestamp(activity.timestamp)}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-white/10" />
                  <span className="text-[10px] font-bold text-cyan-400/60 uppercase tracking-tighter">
                    {activity.chain}
                  </span>
                </div>
              </div>
            </div>

            {activity.txHash && /^0x[0-9a-fA-F]{64}$/.test(activity.txHash) ? (
              <a
                href={getExplorerUrl(activity.chain, activity.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-cyan-400/80 hover:text-cyan-300 transition-colors"
              >
                View <ExternalLink className="w-3 h-3" />
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
