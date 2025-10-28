// Remove ObjectId import since we're using wallet address as UUID

// User preferences for savings goals
export interface UserGoalPreferences {
  defaultTokenAddress?: string; // Default token for new goals
  defaultTokenSymbol?: string; // Default token symbol
  defaultInterestRate?: number; // Default interest rate for new goals
  autoCreateQuickSave: boolean; // Whether to auto-create Quick Save on registration
  goalCreationReminders: boolean; // Whether to send goal creation reminders
  interestCalculationFrequency: "daily" | "weekly" | "monthly"; // How often to calculate interest

  // Notification preferences
  notifications: {
    goalProgress: boolean; // Notify on goal progress milestones
    interestEarned: boolean; // Notify when interest is earned
    goalCompleted: boolean; // Notify when goal is completed
    lowBalance: boolean; // Notify when goal balance is low
    autoSaveReminders: boolean; // Remind about auto-save opportunities
  };

  // Privacy settings
  privacy: {
    showGoalsToFriends: boolean; // Whether friends can see your goals
    allowGoalContributions: boolean; // Whether others can contribute to your goals
    showProgressPublicly: boolean; // Whether to show progress publicly
  };

  // Auto-save settings
  autoSave?: {
    enabled: boolean;
    amount: string; // Default auto-save amount
    frequency: "daily" | "weekly" | "monthly";
    goalId?: string; // Default goal for auto-save
  };
}

// User savings statistics
export interface UserSavingsStats {
  totalSaved: string; // Total amount saved across all goals
  totalInterestEarned: string; // Total interest earned
  totalGoals: number; // Total number of goals created
  activeGoals: number; // Number of active goals
  completedGoals: number; // Number of completed goals
  averageGoalSize: string; // Average goal target amount
  savingsStreak: number; // Days of consecutive saving activity
  longestSavingsStreak: number; // Longest savings streak achieved

  // Achievement data
  achievements: {
    firstGoal: boolean; // Created first goal
    firstDeposit: boolean; // Made first deposit
    goalCompleted: boolean; // Completed first goal
    savingsStreak30: boolean; // 30-day savings streak
    savingsStreak100: boolean; // 100-day savings streak
    interestMilestone: boolean; // Earned first interest
    groupGoalCreated: boolean; // Created first group goal
    referralMade: boolean; // Made first referral
  };
}

// Define the user data structure
export interface User {
  // Use wallet address as the primary UUID/identifier (no MongoDB ObjectId)
  address: string; // Wallet address (primary UUID identifier)
  username?: string; // Optional username for personalization
  verified: boolean; // Verification status
  verificationData?: {
    // Data from zkSelf verification
    attestationId?: string;
    credentialSubject?: any;
    verificationOptions?: any;
    verifiedAt?: Date;
  };
  identityData?: {
    // Identity data from verification
    name?: string[];
    nationality?: string;
    gender?: string;
    minimumAge?: number;
  };

  // Goal-related data
  goalPreferences: UserGoalPreferences; // User preferences for goals
  savingsStats: UserSavingsStats; // User savings statistics
  quickSaveGoalId?: string; // Reference to Quick Save goal

  // Social features
  friends: string[]; // Array of friend addresses
  referralCode?: string; // User's referral code
  referredBy?: string; // Address of user who referred this user

  // Compliance and KYC
  kycLevel: "none" | "basic" | "full"; // KYC verification level
  complianceFlags: {
    sanctionsCheck: boolean; // Passed sanctions screening
    pepCheck: boolean; // PEP (Politically Exposed Person) check
    amlCleared: boolean; // AML clearance status
  };

  // Activity tracking
  lastActiveAt: Date; // Last activity timestamp
  loginCount: number; // Number of times user has logged in

  // Settings
  settings: {
    currency: string; // Preferred fiat currency (e.g., "KES", "USD")
    language: string; // Preferred language
    timezone: string; // User's timezone
    theme: "light" | "dark" | "auto"; // UI theme preference
  };

  createdAt: Date; // When the user was first created
  updatedAt: Date; // When the user was last updated
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
  achievements: string[]; // List of earned achievement badges
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
