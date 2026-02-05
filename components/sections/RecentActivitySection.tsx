"use client";

import { Activity } from "lucide-react";
import { ActivityFeed } from "@/components/common/ActivityFeed";

interface RecentActivitySectionProps {
  account?: any;
}

export function RecentActivitySection({ account }: RecentActivitySectionProps) {
  return (
    <section className="mb-24 px-1" aria-labelledby="activity-heading">
      <div className="flex items-center gap-2 mb-6 px-2">
        <Activity className="w-4 h-4 text-white/40" />
        <h2 id="activity-heading" className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
          Recent Activity
        </h2>
      </div>

      {account?.address ? (
        <ActivityFeed userAddress={account.address} limit={20} />
      ) : (
        <div className="text-center py-12 bg-white/5 rounded-[2rem] border border-white/5">
          <Activity className="w-8 h-8 text-white/10 mx-auto mb-3" />
          <p className="text-sm font-medium text-white/40 tracking-tight">Connect wallet to view activities</p>
        </div>
      )}
    </section>
  );
}