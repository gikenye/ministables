import { Goal as ApiGoal } from "@/lib/models/goal";

/**
 * Frontend-compatible Goal interface for components
 */
export interface FrontendGoal {
  id: string;
  title: string;
  description?: string;
  currentAmount: string;
  targetAmount: string;
  progress: number;
  icon?: string;
  category: "personal" | "retirement" | "quick";
  status: "active" | "completed" | "paused" | "cancelled";
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  interestRate: number;
  totalInterestEarned: string;
  createdAt: Date;
  updatedAt: Date;
  targetDate?: Date;
  completedAt?: Date;
  isPublic: boolean;
  allowContributions: boolean;
  isQuickSave: boolean;
}

/**
 * Convert API Goal to Frontend Goal
 */
export function apiGoalToFrontend(apiGoal: ApiGoal): FrontendGoal {
  return {
    id: apiGoal._id?.toString() || "",
    title: apiGoal.title,
    description: apiGoal.description,
    currentAmount: apiGoal.currentAmount,
    targetAmount: apiGoal.targetAmount,
    progress: apiGoal.progress,
    icon: apiGoal.icon,
    category: apiGoal.category,
    status: apiGoal.status,
    tokenSymbol: apiGoal.tokenSymbol,
    tokenAddress: apiGoal.tokenAddress,
    tokenDecimals: apiGoal.tokenDecimals,
    interestRate: apiGoal.interestRate,
    totalInterestEarned: apiGoal.totalInterestEarned,
    createdAt: apiGoal.createdAt,
    updatedAt: apiGoal.updatedAt,
    targetDate: apiGoal.targetDate,
    completedAt: apiGoal.completedAt,
    isPublic: apiGoal.isPublic,
    allowContributions: apiGoal.allowContributions,
    isQuickSave: apiGoal.isQuickSave,
  };
}

/**
 * Convert multiple API Goals to Frontend Goals
 */
export function apiGoalsToFrontend(apiGoals: ApiGoal[]): FrontendGoal[] {
  return apiGoals.map(apiGoalToFrontend);
}
