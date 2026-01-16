"use client";

import React from "react";
import { motion } from "framer-motion";
import { BarChart3, RefreshCcw } from "lucide-react";
import { theme } from "@/lib/theme";

interface UserScore {
  rank: number;
  formattedLeaderboardScore: string;
}

export interface LeaderboardEntry {
  rank: number;
  userAddress: string;
  totalValueUSD: string;
  leaderboardScore: string;
  formattedLeaderboardScore: string;
  leaderboardRank: number;
  isCurrentUser?: boolean;
  assetBalances: Array<any>;
}

interface LeaderboardSectionProps {
  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  leaderboardError: string | null;
  userScore: UserScore | null;
  refetchLeaderboard: () => void;
}

const getEmojiAvatar = (address: string) => {
  const emojis = ["🍣", "🎈", "🌶️", "🎉", "🐧", "🐱", "☀️", "🐲", "🤖", "🍕"];
  const index = parseInt(address.slice(-1), 16) % emojis.length;
  return emojis[index];
};

export function LeaderboardSection({
  leaderboard,
  leaderboardLoading,
  leaderboardError,
  userScore,
  refetchLeaderboard,
}: LeaderboardSectionProps) {
  return (
    <section 
      className="px-4 py-8 space-y-6 max-w-md mx-auto min-h-screen pb-24 transition-colors duration-300"
      style={{ backgroundColor: theme.colors.background }}
    >
      <header className="px-2">
        <h2 
          className="text-3xl font-black tracking-tight"
          style={{ color: theme.colors.text }}
        >
          Leaderboard
        </h2>
      </header>

      {/* 1. Current User "Rainbow Border" Card */}
      {userScore && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative p-[1.5px] rounded-[24px] overflow-hidden shadow-lg"
          style={{ 
            background: `linear-gradient(to right, #ffcf3d, #ff6b6b, ${theme.colors.accent}, #4d9eff)` 
          }}
        >
          <div 
            className="rounded-[23px] p-5 flex items-center justify-between"
            style={{ backgroundColor: theme.colors.backgroundDark }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl border"
                style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.borderLight }}
              >
                🐼
              </div>
              <div>
                <div 
                  className="text-sm font-bold tracking-wide"
                  style={{ color: theme.colors.text }}
                >
                  {userScore.rank ? `Rank #${userScore.rank}` : "Unranked"}
                </div>
                <div 
                  className="text-[10px] uppercase font-black tracking-widest opacity-70"
                  style={{ color: theme.colors.text }} 
                >
                  Your Account
                </div>
              </div>
            </div>
            <div className="text-right">
              <div 
                className="text-xl font-black"
                style={{ color: theme.colors.text }}
              >
                ${userScore.formattedLeaderboardScore}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 2. Main Leaderboard Card */}
      <div 
        className="rounded-[32px] overflow-hidden shadow-2xl border backdrop-blur-md"
        style={{ 
          backgroundColor: theme.colors.backgroundSecondary,
          borderColor: theme.colors.borderLight 
        }}
      >
        <div 
          className="px-6 py-5 flex items-center justify-between border-b"
          style={{ borderBottomColor: theme.colors.borderLight }}
        >
          <h3 
            className="text-sm font-bold uppercase tracking-widest flex items-center gap-2"
            style={{ color: theme.colors.text }}
          >
            <BarChart3 size={16} style={{ color: theme.colors.accent }} />
            Top Savers
          </h3>
          <button 
            onClick={refetchLeaderboard}
            className={`p-2 rounded-full transition-all hover:bg-white/5`}
            style={{ color: theme.colors.accent }}
          >
            <RefreshCcw size={16} className={leaderboardLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="" style={{ divideColor: theme.colors.borderLight }}>
          {leaderboardLoading ? (
            <SkeletonLoader />
          ) : leaderboardError ? (
            <div className="p-10 text-center space-y-3">
               <p className="font-medium text-red-400">Failed to load data</p>
               <button 
                onClick={refetchLeaderboard} 
                className="text-sm font-bold underline"
                style={{ color: theme.colors.accent }}
              >
                Try again
              </button>
            </div>
          ) : (
            leaderboard.map((entry) => (
              <LeaderboardRow key={entry.userAddress} entry={entry} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const isTopThree = entry.rank <= 3;
  
  return (
    <motion.div 
      whileTap={{ backgroundColor: "rgba(255,255,255,0.03)" }}
      className="flex items-center justify-between p-5 transition-colors"
      style={{ 
        backgroundColor: entry.isCurrentUser ? `${theme.colors.accent}11` : 'transparent' 
      }}
    >
      <div className="flex items-center gap-4 flex-1">
        <div 
          className="w-11 h-11 rounded-full flex items-center justify-center text-2xl border"
          style={{ 
            backgroundColor: theme.colors.backgroundDark, 
            borderColor: theme.colors.borderLight 
          }}
        >
          {getEmojiAvatar(entry.userAddress)}
        </div>
        
        <div className="flex flex-col">
          <span 
            className="text-sm font-bold truncate max-w-[120px]"
            style={{ color: theme.colors.text }}
          >
            {entry.isCurrentUser ? "You" : `${entry.userAddress.slice(0, 6)}...${entry.userAddress.slice(-4)}`}
          </span>
          {entry.isCurrentUser && (
            <span 
              className="text-[10px] font-black uppercase tracking-tighter"
              style={{ color: theme.colors.accent }}
            >
              Current User
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-right">
          <div 
            className="text-[15px] font-black"
            style={{ color: isTopThree ? '#ffcf3d' : theme.colors.text }}
          >
            {entry.formattedLeaderboardScore}
          </div>
          <div 
            className="text-[10px] font-bold uppercase"
            style={{ color: theme.colors.text, opacity: 0.5 }}
          >
            Points
          </div>
        </div>

        <div className="w-8 text-right">
          {entry.rank === 1 ? <span className="text-xl">🥇</span> :
           entry.rank === 2 ? <span className="text-xl">🥈</span> :
           entry.rank === 3 ? <span className="text-xl">🥉</span> :
           <span className="text-xs font-black opacity-40" style={{ color: theme.colors.text }}>
             #{entry.rank}
           </span>}
        </div>
      </div>
    </motion.div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-1 p-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
          <div className="w-11 h-11 rounded-full" style={{ backgroundColor: theme.colors.border }} />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded w-1/2" style={{ backgroundColor: theme.colors.border }} />
            <div className="h-2 rounded w-1/4" style={{ backgroundColor: theme.colors.border }} />
          </div>
          <div className="w-16 h-4 rounded" style={{ backgroundColor: theme.colors.border }} />
        </div>
      ))}
    </div>
  );
}