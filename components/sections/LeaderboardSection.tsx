"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";

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
  assetBalances: Array<{
    asset: string;
    vault: string;
    totalAmountWei: string;
    totalAmountUSD: string;
    totalSharesWei: string;
    totalSharesUSD: string;
    depositCount: number;
  }>;
}

interface LeaderboardSectionProps {
  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  leaderboardError: string | null;
  userScore: UserScore | null;
  refetchLeaderboard: () => void;
}

export function LeaderboardSection({
  leaderboard,
  leaderboardLoading,
  leaderboardError,
  userScore,
  refetchLeaderboard,
}: LeaderboardSectionProps) {
  return (
    <section
      className="px-4 py-6 space-y-4"
      role="region"
      aria-labelledby="leaderboard-heading"
    >
      {/* User Score Card - Compact Version */}
      {userScore && (
        <div
          className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl p-3 text-white"
          role="region"
          aria-label="Your leaderboard ranking"
        >
          <div className="flex items-center justify-between">
            {/* Rank Section */}
            <div className="flex items-center gap-2">
              <div className="text-2xl" aria-hidden="true"></div>
              <div>
                <div className="text-xs opacity-75">Rank</div>
                <div className="text-lg font-bold">
                  {userScore.rank != null && userScore.rank !== undefined
                    ? `#${userScore.rank}`
                    : "Not ranked"}
                </div>
              </div>
            </div>

            {/* Score Section */}
            <div className="text-right">
              <div className="text-xs opacity-75">Score</div>
              <div className="text-lg font-bold">
                ${userScore.formattedLeaderboardScore}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      <div
        className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-xl p-4"
        role="region"
        aria-labelledby="leaderboard-table-heading"
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            id="leaderboard-table-heading"
            className="text-lg font-semibold text-white flex items-center gap-2"
          >
            <BarChart3 className="w-5 h-5" aria-hidden="true" />
            Top Savers
          </h3>
          <button
            onClick={refetchLeaderboard}
            className="text-cyan-400 hover:text-cyan-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded"
            disabled={leaderboardLoading}
            aria-label={
              leaderboardLoading
                ? "Refreshing leaderboard"
                : "Refresh leaderboard"
            }
          >
            {leaderboardLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {leaderboardLoading ? (
          <div className="space-y-3" aria-label="Loading leaderboard">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 animate-pulse"
                aria-hidden="true"
              >
                <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-600 rounded w-24 mb-1"></div>
                  <div className="h-3 bg-gray-600 rounded w-32"></div>
                </div>
                <div className="h-4 bg-gray-600 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : leaderboardError ? (
          <div className="text-center py-8" role="alert">
            <div className="text-red-400 mb-2">Failed to load leaderboard</div>
            <button
              onClick={refetchLeaderboard}
              className="text-cyan-400 hover:text-cyan-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 rounded px-2 py-1"
            >
              Try again
            </button>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-8" role="status">
            <BarChart3
              className="w-12 h-12 text-gray-600 mx-auto mb-3"
              aria-hidden="true"
            />
            <div className="text-gray-400">No rankings yet</div>
          </div>
        ) : (
          <div
            className="space-y-2"
            role="table"
            aria-label="Leaderboard rankings"
          >
            <div role="rowgroup">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.userAddress}
                  role="row"
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    entry.isCurrentUser
                      ? "bg-cyan-500/10 border border-cyan-500/20"
                      : "bg-gray-700/20"
                  }`}
                  aria-label={`Rank ${entry.rank}: ${
                    entry.isCurrentUser ? "You" : "User"
                  } with score ${entry.formattedLeaderboardScore} USD`}
                >
                  {/* Rank */}
                  <div
                    role="cell"
                    className="flex items-center justify-center w-8 h-8"
                    aria-label={`Rank ${entry.rank}`}
                  >
                    {entry.rank <= 10 ? (
                      <div className="text-xl" aria-hidden="true">
                        {entry.rank === 1
                          ? "🥇"
                          : entry.rank === 2
                          ? "🥈"
                          : "🥉"}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-gray-400">
                        #{entry.rank}
                      </div>
                    )}
                  </div>

                  {/* User Info */}
                  <div role="cell" className="flex-1">
                    <div className="text-white font-medium">
                      {entry.isCurrentUser
                        ? "You"
                        : `${entry.userAddress.slice(
                            0,
                            6
                          )}...${entry.userAddress.slice(-4)}`}
                    </div>
                    {entry.isCurrentUser && (
                      <div className="text-xs text-cyan-400">Your account</div>
                    )}
                  </div>

                  {/* Score */}
                  <div role="cell" className="text-right">
                    <div className="text-white font-semibold">
                      ${entry.totalValueUSD || "0.00"}
                    </div>
                    <div className="text-xs text-gray-400">USD</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Load More Button */}
      {leaderboard.length > 0 && (
        <div className="text-center">
          <button
            onClick={() => {
              /* Load more functionality can be added here */
            }}
            className="text-cyan-400 hover:text-cyan-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded px-2 py-1"
            disabled={leaderboardLoading}
            aria-label="Load more leaderboard rankings"
          >
            View more rankings
          </button>
        </div>
      )}
    </section>
  );
}
