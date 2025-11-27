// User preferences for savings goals
export interface UserGoalPreferences {
  defaultTokenAddress?: string;
  defaultTokenSymbol?: string;
  defaultInterestRate?: number;
  autoCreateQuickSave: boolean;
  goalCreationReminders: boolean;
  interestCalculationFrequency: "daily" | "weekly" | "monthly";

  notifications: {
    goalProgress: boolean;
    interestEarned: boolean;
    goalCompleted: boolean;
    lowBalance: boolean;
    autoSaveReminders: boolean;
  };

  privacy: {
    showGoalsToFriends: boolean;
    allowGoalContributions: boolean;
    showProgressPublicly: boolean;
  };

  autoSave?: {
    enabled: boolean;
    amount: string;
    frequency: "daily" | "weekly" | "monthly";
    goalId?: string;
  };
}

// User savings statistics
export interface UserSavingsStats {
  totalSaved: string;
  totalInterestEarned: string;
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  averageGoalSize: string;
  savingsStreak: number;
  longestSavingsStreak: number;

  achievements: {
    firstGoal: boolean;
    firstDeposit: boolean;
    goalCompleted: boolean;
    savingsStreak30: boolean;
    savingsStreak100: boolean;
    interestMilestone: boolean;
    groupGoalCreated: boolean;
    referralMade: boolean;
  };
}

// Define the user data structure
export interface User {
  _id: string;
  address: string;
  username?: string;
  verified: boolean;
  verificationData?: {
    attestationId?: string;
    credentialSubject?: any;
    verificationOptions?: any;
    verifiedAt?: Date;
  };
  identityData?: {
    name?: string[];
    nationality?: string;
    gender?: string;
    minimumAge?: number;
  };

  goalPreferences: UserGoalPreferences;
  savingsStats: UserSavingsStats;
  quickSaveGoalId?: string;

  friends: string[];
  referralCode?: string;
  referredBy?: string;

  kycLevel: "none" | "basic" | "full";
  complianceFlags: {
    sanctionsCheck: boolean;
    pepCheck: boolean;
    amlCleared: boolean;
  };

  lastActiveAt: Date;
  loginCount: number;

  settings: {
    currency: string;
    language: string;
    timezone: string;
    theme: "light" | "dark" | "auto";
  };

  createdAt: Date;
  updatedAt: Date;
}

// Define a type for user updates (exclude address since it's the primary key)
export type UserUpdate = Partial<Omit<User, "address" | "createdAt">>;

// Define a type for creating a new user
export type NewUser = Omit<
  User,
  | "savingsStats"
  | "friends"
  | "lastActiveAt"
  | "loginCount"
  | "createdAt"
  | "updatedAt"
>;

// User profile for public display
export interface UserProfile {
  address: string;
  username?: string;
  verified: boolean;
  joinedAt: Date;
  goalsCount: number;
  completedGoalsCount: number;
  publicGoals: {
    id: string;
    title: string;
    progress: number;
    category: string;
  }[];
  achievements: string[];
}

// User dashboard summary
export interface UserDashboard {
  user: Pick<User, "address" | "username" | "verified" | "goalPreferences">;
  stats: UserSavingsStats;
  recentGoals: {
    id: string;
    title: string;
    currentAmount: string;
    targetAmount: string;
    progress: number;
    category: string;
  }[];
  recentTransactions: {
    id: string;
    type: string;
    amount: string;
    goalTitle: string;
    timestamp: Date;
  }[];
  notifications: {
    id: string;
    type: string;
    message: string;
    read: boolean;
    timestamp: Date;
  }[];
}
