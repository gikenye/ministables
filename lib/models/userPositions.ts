export interface UserPositions {
  userAddress: string;
  data: {
    userAddress: string;
    totalValueUSD: string;
    formattedLeaderboardScore: string;
    leaderboardRank: number;
    assetBalances: Array<{
      asset: string;
      vault: string;
      totalAmountWei: string;
      totalAmountUSD: string;
      totalSharesWei: string;
      totalSharesUSD: string;
      depositCount: number;
    }>;
    deposits: Array<{
      depositId: string;
      vault: string;
      asset: string;
      amountWei: string;
      amountUSD: string;
      sharesWei: string;
      sharesUSD: string;
      lockTier: string;
      lockedUntil: string;
      unlocked: boolean;
      timeRemaining: number | null;
    }>;
    goals: Array<{
      goalId: string;
      vault: string;
      asset: string;
      targetAmountWei: string;
      targetAmountToken: string;
      targetDate: string;
      totalValueWei: string;
      totalValueUSD: string;
      percentBps: string;
      progressPercent: string;
      isQuicksave: boolean;
      attachmentCount: string;
    }>;
  };
  lastUpdated: Date;
}
