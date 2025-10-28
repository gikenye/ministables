import { ObjectId } from "mongodb";
import { GoalCategory, GoalStatus } from "./goal";

// Group goal visibility
export type GroupVisibility =
  | "public" // Anyone can find and join
  | "private" // Invite only
  | "friends" // Only friends can see and join
  | "unlisted"; // Not searchable but joinable with link

// Member role in group goal
export type MemberRole =
  | "owner" // Creator of the group goal
  | "admin" // Can manage members and settings
  | "member" // Regular participant
  | "viewer"; // Can view but not contribute

// Member status
export type MemberStatus =
  | "active" // Active participant
  | "pending" // Invitation pending
  | "suspended" // Temporarily suspended
  | "left" // Left the group
  | "removed"; // Removed by admin

// Group goal member
export interface GroupGoalMember {
  userId: string; // Member's wallet address
  username?: string; // Member's display name
  role: MemberRole;
  status: MemberStatus;

  // Contribution tracking
  targetContribution?: string; // Individual target contribution
  currentContribution: string; // Current amount contributed
  contributionPercentage: number; // Percentage of total contributions

  // Timeline
  joinedAt: Date;
  lastActiveAt: Date;
  leftAt?: Date;

  // Settings
  isPublic: boolean; // Whether contribution is visible to others
  notifications: boolean; // Whether to receive notifications
}

// Group savings rules
export interface GroupSavingsRules {
  // Contribution rules
  minimumContribution?: string; // Minimum amount to contribute
  maximumContribution?: string; // Maximum amount to contribute
  equalContributions: boolean; // Whether all members must contribute equally

  // Timeline rules
  contributionDeadline?: Date; // Deadline for contributions
  penaltyForEarlyWithdrawal?: number; // Penalty percentage for early withdrawal

  // Withdrawal rules
  withdrawalRequiresVote: boolean; // Whether withdrawals need group approval
  minimumVotePercentage?: number; // Minimum vote percentage for approval

  // Auto-save rules
  autoSaveFrequency?: "daily" | "weekly" | "monthly";
  autoSaveAmount?: string; // Auto-save amount per member
}

// Group goal voting
export interface GroupGoalVote {
  _id?: ObjectId;
  groupGoalId: string;
  proposalId: string; // Unique proposal identifier
  proposalType:
    | "withdrawal"
    | "rule_change"
    | "member_removal"
    | "goal_modification";

  // Proposal details
  proposedBy: string; // User who made the proposal
  title: string;
  description: string;
  proposalData: Record<string, any>; // Specific data for the proposal

  // Voting
  votes: {
    userId: string;
    vote: "yes" | "no" | "abstain";
    votedAt: Date;
    reason?: string;
  }[];

  // Status
  status: "active" | "passed" | "failed" | "cancelled";
  requiredVotes: number; // Number of votes needed

  // Timeline
  createdAt: Date;
  votingDeadline: Date;
  resolvedAt?: Date;
}

// Define the group goal data structure
export interface GroupGoal {
  _id?: ObjectId;

  // Basic information
  title: string; // Group goal title
  description?: string; // Group goal description
  category: GoalCategory; // Type of group goal
  status: GoalStatus;
  visibility: GroupVisibility;

  // Creator information
  ownerId: string; // Creator's wallet address

  // Financial data
  targetAmount: string; // Total target amount for the group
  currentAmount: string; // Current total amount saved
  tokenAddress: string; // Token being saved
  tokenSymbol: string; // Token symbol
  tokenDecimals: number; // Token decimals

  // Progress and statistics
  progress: number; // Overall progress percentage
  totalMembers: number; // Total number of members
  activeMembers: number; // Number of active members

  // Members
  members: GroupGoalMember[]; // Array of group members
  maxMembers?: number; // Maximum number of members allowed

  // Rules and settings
  rules: GroupSavingsRules;

  // Interest and rewards
  interestRate: number; // Annual interest rate
  totalInterestEarned: string; // Total interest earned by the group

  // Timeline
  createdAt: Date;
  updatedAt: Date;
  targetDate?: Date; // Target completion date
  completedAt?: Date; // When the goal was completed

  // Distribution settings (for when goal is completed)
  distributionMethod: "proportional" | "equal" | "custom";
  customDistribution?: {
    // For custom distribution
    userId: string;
    percentage: number;
  }[];

  // Social features
  isPublic: boolean; // Whether the group is publicly visible
  allowInvites: boolean; // Whether members can invite others
  requireApproval: boolean; // Whether joining requires approval

  // Communication
  chatEnabled: boolean; // Whether group chat is enabled
  updatesChannel?: string; // Channel for updates and notifications

  // Metadata
  tags?: string[]; // Tags for categorization
  icon?: string; // Group icon/emoji
  coverImage?: string; // Cover image URL

  // Analytics
  analytics: {
    totalContributions: number;
    averageContributionAmount: string;
    contributionFrequency: number;
    memberRetentionRate: number;
    goalCompletionRate: number;
  };
}

// Type for creating a new group goal
export type NewGroupGoal = Omit<
  GroupGoal,
  | "_id"
  | "currentAmount"
  | "progress"
  | "totalMembers"
  | "activeMembers"
  | "totalInterestEarned"
  | "createdAt"
  | "updatedAt"
  | "completedAt"
  | "analytics"
>;

// Type for updating a group goal
export type GroupGoalUpdate = Partial<
  Omit<GroupGoal, "_id" | "ownerId" | "createdAt" | "members">
>;

// Group goal summary for listing
export interface GroupGoalSummary {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  targetAmount: string;
  currentAmount: string;
  progress: number;
  totalMembers: number;
  activeMembers: number;
  tokenSymbol: string;
  visibility: GroupVisibility;
  status: GoalStatus;
  ownerId: string;
  createdAt: Date;
  targetDate?: Date;
  icon?: string;
}

// Group goal invitation
export interface GroupGoalInvitation {
  _id?: ObjectId;
  groupGoalId: string;
  invitedBy: string; // User who sent the invitation
  invitedUser: string; // User being invited
  invitationCode: string; // Unique invitation code
  message?: string; // Optional invitation message

  status: "pending" | "accepted" | "declined" | "expired";
  expiresAt: Date;
  createdAt: Date;
  respondedAt?: Date;
}

// Group goal leaderboard entry
export interface GroupGoalLeaderboard {
  userId: string;
  username?: string;
  totalContributions: string;
  contributionCount: number;
  contributionPercentage: number;
  rank: number;
  badges?: string[]; // Achievement badges
}

// Group goal statistics
export interface GroupGoalStats {
  totalGroupGoals: number;
  activeGroupGoals: number;
  completedGroupGoals: number;
  totalMembers: number;
  averageGroupSize: number;
  totalAmountSaved: string;
  totalInterestEarned: string;
  completionRate: number;
  popularCategories: { category: GoalCategory; count: number }[];
}
