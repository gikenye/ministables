import { ObjectId } from 'mongodb';

export interface UserGoal {
  _id?: ObjectId;
  userAddress: string;
  goalId: string;
  vault: string;
  asset: string;
  name: string;
  creator: string;
  targetAmountWei: string;
  targetAmountUSD: string;
  targetDate: string;
  totalValueWei: string;
  totalValueUSD: string;
  percentBps: string;
  progressPercent: string;
  isQuicksave: boolean;
  attachmentCount: string;
  userBalance: string;
  userBalanceUSD: string;
  createdAt: string;
  completed: boolean;
  cancelled: boolean;
  lastSyncedAt: Date;
}

export interface UserGoalsResponse {
  userAddress: string;
  totalGoals: number;
  totalValueUSD: string;
  goals: Omit<UserGoal, '_id' | 'userAddress' | 'lastSyncedAt'>[];
}