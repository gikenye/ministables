/**
 * Shared types for the application
 */

import { GroupSavingsGoal } from '@/lib/services/backendApiService';

// Account interface for wallet connection
export interface Account {
  address: string;
  chainId?: number;
}

// My Groups structure from backend API
export interface MyGroups {
  total: number;
  public: {
    total: number;
    goals: GroupSavingsGoal[];
  };
  private: {
    total: number;
    goals: GroupSavingsGoal[];
  };
}