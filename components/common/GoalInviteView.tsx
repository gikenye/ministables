"use client";

import type { ReactNode } from "react";
import { Users, Calendar, TrendingUp, Loader2, Shield } from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import type { GroupSavingsGoal } from "@/lib/services/backendApiService";

const ScreenShell = ({
  children,
  center = false,
}: {
  children: ReactNode;
  center?: boolean;
}) => (
  <div className="min-h-screen px-5 pb-20 pt-10 text-white">
    <div
      className={`mx-auto w-full max-w-md ${
        center ? "flex min-h-[70vh] flex-col justify-center" : ""
      }`}
    >
      {children}
    </div>
  </div>
);

interface GoalInviteViewProps {
  goal: GroupSavingsGoal
  isAuthenticated: boolean
  inviterAddress?: string
}

export const GoalInviteView = ({
  goal,
  isAuthenticated,
  inviterAddress,
}: GoalInviteViewProps) => {
  const formatAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <ScreenShell>
      <div className="rounded-[28px] border border-emerald-400/25 bg-emerald-500/10 p-5 text-center shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-200/70">
          Group Invite
        </p>
        <h1 className="mt-3 text-2xl font-black text-white">
          {goal?.name || "Group Savings Goal"}
        </h1>
        <p className="mt-2 text-sm text-emerald-100/80">
          Join this goal and start building wealth together.
        </p>
        {inviterAddress && (
          <div className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200/60">
            Invited by {formatAddress(inviterAddress)}
          </div>
        )}
      </div>

      <div className="mt-5 space-y-4">
        {goal.targetAmountToken && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[24px] border border-white/5 bg-black/40 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  Target
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  ${goal.targetAmountToken.toLocaleString()}
                </div>
              </div>
              <div className="rounded-[24px] border border-white/5 bg-black/40 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                  Progress
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-300">
                  {(goal.progressPercent || 0).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/5 bg-black/40 p-4">
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${Math.min(goal.progressPercent || 0, 100)}%` }}
                />
              </div>
              <div className="mt-3 flex justify-between text-xs font-bold text-white/40">
                <span>${(goal.totalProgressUSD || 0).toLocaleString()} raised</span>
                <span>{goal.participants?.length || 0} members</span>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/5 bg-black/40 p-4 space-y-3">
              <div className="flex items-center gap-3 text-white/70">
                <Users className="h-5 w-5 text-emerald-300" />
                <span className="text-xs font-black uppercase tracking-[0.2em]">
                  {goal.isPublic ? "Public Goal" : "Private Goal"}
                </span>
              </div>
              {goal.targetDate && goal.targetDate !== "0" && (
                <div className="flex items-center gap-3 text-white/70">
                  <Calendar className="h-5 w-5 text-emerald-300" />
                  <span className="text-xs font-black uppercase tracking-[0.2em]">
                    Target {new Date(goal.targetDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {goal.createdAt && (
                <div className="flex items-center gap-3 text-white/70">
                  <TrendingUp className="h-5 w-5 text-emerald-300" />
                  <span className="text-xs font-black uppercase tracking-[0.2em]">
                    Created {new Date(goal.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {!isAuthenticated && (
          <div className="rounded-[28px] border border-white/5 bg-black/40 p-5 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15">
              <Shield className="h-7 w-7 text-emerald-300" />
            </div>
            <h3 className="text-lg font-black text-white">Sign In to Join</h3>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-white/40">
              Connect your wallet to join
            </p>
            <div className="mt-4">
              <ConnectWallet className="w-full" />
            </div>
          </div>
        )}
      </div>
    </ScreenShell>
  );
};

interface LoadingViewProps {
  message?: string
}

export const LoadingView = ({ message = "Loading..." }: LoadingViewProps) => (
  <ScreenShell center>
    <div className="rounded-[28px] border border-white/10 bg-black/40 p-6 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15">
        <Loader2 className="h-7 w-7 text-emerald-300 animate-spin" />
      </div>
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/60">
        {message}
      </p>
    </div>
  </ScreenShell>
);

interface ProcessingViewProps {
  title: string
  message: string
}

export const ProcessingView = ({ title, message }: ProcessingViewProps) => (
  <ScreenShell center>
    <div className="rounded-[28px] border border-white/10 bg-black/40 p-6 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15">
        <Loader2 className="h-7 w-7 text-emerald-300 animate-spin" />
      </div>
      <h2 className="text-xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm text-white/60">{message}</p>
    </div>
  </ScreenShell>
);

interface ErrorViewProps {
  title: string
  message: string
  onAction: () => void
  actionLabel?: string
}

export const ErrorView = ({ title, message, onAction, actionLabel = "Go to Home" }: ErrorViewProps) => (
  <ScreenShell center>
    <div className="rounded-[28px] border border-white/10 bg-black/40 p-6 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <h1 className="text-xl font-black text-white">{title}</h1>
      <p className="mt-2 text-sm text-white/60">{message}</p>
      <button
        onClick={onAction}
        className="mt-5 w-full rounded-[20px] bg-white py-3 text-sm font-black text-black"
      >
        {actionLabel}
      </button>
    </div>
  </ScreenShell>
);
