import { ObjectId } from "mongodb";

// Goal categories - now supports user-defined categories
export type GoalCategory = "quick" | string;

// Goal status
export type GoalStatus = "active" | "completed" | "paused" | "cancelled";

// Define the goal data structure
export interface Goal {
  _id?: ObjectId;
  userId: string; // Wallet address of the goal owner
  title: string; // Goal title (e.g., "Quick Save", "Soma plan")
  description?: string; // Optional goal description
  category: GoalCategory; // Type of goal
  status: GoalStatus; // Current status of the goal

  // Financial data
  currentAmount: string; // Current amount saved (in token units)
  targetAmount: string; // Target amount to save (in token units)
  tokenAddress: string; // Address of the token being saved
  tokenSymbol: string; // Symbol of the token (e.g., "USDC", "USDT")
  tokenDecimals: number; // Decimals of the token

  // Progress tracking
  progress: number; // Progress percentage (0-100)

  // Interest and rewards
  interestRate: number; // Annual interest rate (e.g., 5.0 for 5%)
  totalInterestEarned: string; // Total interest earned so far

  // Timeline
  createdAt: Date; // When the goal was created
  updatedAt: Date; // When the goal was last updated
  targetDate?: Date; // Optional target completion date
  completedAt?: Date; // When the goal was completed (if applicable)

  // Settings
  isPublic: boolean; // Whether the goal is visible to others
  allowContributions: boolean; // Whether others can contribute to this goal
  autoSave?: {
    // Auto-save settings
    enabled: boolean;
    amount: string; // Amount to auto-save
    frequency: "daily" | "weekly" | "monthly";
    nextSaveDate: Date;
  };

  // Quick Save specific fields
  isQuickSave: boolean; // Whether this is the auto-generated quick save goal
  businessNumber?: string; // M-Pesa business number for deposits
  accountNumber?: string; // Account number for deposits

  // Metadata
  icon?: string; // Optional emoji or icon for the goal
  tags?: string[]; // Optional tags for categorization
  
  // Blockchain integration
  blockchainGoalId?: string; // Goal ID on the smart contract
  blockchainSynced?: boolean; // Whether this goal is synced with blockchain
  lastBlockchainSync?: Date; // Last time blockchain data was synced
}

// Define a type for goal updates
export type GoalUpdate = Partial<
  Omit<Goal, "_id" | "userId" | "createdAt" | "isQuickSave">
>;

// Define a type for creating a new goal
export type NewGoal = Omit<
  Goal,
  | "_id"
  | "progress"
  | "totalInterestEarned"
  | "createdAt"
  | "updatedAt"
  | "completedAt"
>;

// Goal summary interface for dashboard display
export interface GoalSummary {
  id: string;
  title: string;
  category: GoalCategory;
  currentAmount: string;
  targetAmount: string;
  progress: number;
  tokenSymbol: string;
  icon?: string;
  status: GoalStatus;
}

// Interface for goal statistics
export interface GoalStats {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalSaved: string; // Total amount saved across all goals
  totalInterestEarned: string; // Total interest earned across all goals
  averageProgress: number; // Average progress across active goals
}

// Interface for goal contribution (when others contribute to a goal)
export interface GoalContribution {
  _id?: ObjectId;
  goalId: string; // Goal being contributed to
  contributorAddress: string; // Address of the contributor
  amount: string; // Amount contributed
  transactionHash: string; // Blockchain transaction hash
  message?: string; // Optional message from contributor
  createdAt: Date;
}

// Interface for goal milestones/achievements
export interface GoalMilestone {
  _id?: ObjectId;
  goalId: string;
  title: string; // Milestone title (e.g., "25% Complete")
  description?: string; // Optional description
  targetAmount: string; // Amount needed to reach this milestone
  achievedAt?: Date; // When the milestone was achieved
  rewardAmount?: string; // Optional reward for reaching milestone
}
