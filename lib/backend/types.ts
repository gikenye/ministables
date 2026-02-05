// Type definitions for API requests and responses

export interface AllocateRequest {
  asset: keyof typeof import("./constants").VAULTS;
  userAddress: string;
  amount: string; // Must be a raw integer string (e.g., "1000000"), no decimals or formatting
  txHash: string;
  providerPayload: Record<string, unknown>;
  targetGoalId?: string;
}

export interface AllocateResponse {
  success: boolean;
  depositId: string;
  goalId: string;
  shares: string;
  formattedShares: string;
  allocationTxHash: string;
  goalCompleted?: boolean;
  metaGoalId?: string;
}

export interface GoalAttachment {
  owner: string;
  depositId: string;
  attachedAt: string;
  pledged: boolean;
}

export interface Goal {
  id: string;
  creator: string;
  vault: string;
  targetAmount: string;
  targetDate: string;
  metadataURI: string;
  createdAt: string;
  cancelled: boolean;
  completed: boolean;
  totalValue: string;
  percentBps: string;
  attachments: GoalAttachment[];
}

export interface QuicksaveGoalResponse {
  quicksaveGoalId: string;
}

export interface UserScore {
  userAddress: string;
  score: string;
  formattedScore: string;
  rank: number | null; // null if user not in top list
  totalUsers: string;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  score: string;
  formattedScore: string;
}

export interface LeaderboardResponse {
  total: string;
  start: number;
  limit: number;
  data: LeaderboardEntry[];
}

export interface JoinGoalRequest {
  goalId: string;
  userAddress: string;
  depositTxHash: string;
  asset: keyof typeof import("./constants").VAULTS;
}

export interface JoinGoalResponse {
  success: boolean;
  goalId: string;
  depositId: string;
  amount: string;
  formattedAmount: string;
  attachTxHash: string;
}

export interface CreateGoalRequest {
  vaultAddress: string;
  targetAmount: string;
  targetDate?: string;
  name: string;
  creatorAddress: string;
}

export interface CreateGoalResponse {
  success: boolean;
  goalId: string;
  creator: string;
  txHash: string;
  shareLink: string;
}

export interface ErrorResponse {
  error: string;
}

// User positions types
export interface UserDeposit {
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
}

export interface UserGoal {
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
}

export interface AssetBalance {
  asset: string;
  vault: string;
  totalAmountWei: string;
  totalAmountUSD: string;
  totalSharesWei: string;
  totalSharesUSD: string;
  depositCount: number;
}

export interface UserPositionsResponse {
  userAddress: string;
  totalValueUSD: string;
  leaderboardScore: string;
  formattedLeaderboardScore: string;
  leaderboardRank: number | null;
  assetBalances: AssetBalance[];
  deposits: UserDeposit[];
  goals: UserGoal[];
}

export type ActivityType =
  | "deposit"
  | "goal_created"
  | "deposit_attached"
  | "deposit_detached"
  | "attachment_pledged"
  | "member_invited"
  | "invite_revoked"
  | "member_joined"
  | "member_removed";

export interface ActivityItemBase {
  id: string;
  type: ActivityType;
  txHash: string;
  blockNumber: number;
  timestamp: string;
}

export interface DepositActivity extends ActivityItemBase {
  type: "deposit";
  vault: string;
  asset: VaultAsset | string;
  depositId: string;
  amountWei: string;
  amountUSD: string;
  sharesWei: string;
  sharesUSD: string;
  lockTier?: string;
  source: "onramp" | "direct";
  onrampTxHash?: string;
}

export interface GoalCreatedActivity extends ActivityItemBase {
  type: "goal_created";
  goalId: string;
  vault: string;
  asset: VaultAsset | string | null;
  targetAmountWei: string;
  targetAmountToken: string;
  targetDate: string;
  metadataURI: string;
}

export interface DepositAttachmentActivity extends ActivityItemBase {
  type: "deposit_attached" | "deposit_detached" | "attachment_pledged";
  goalId: string;
  depositId: string;
  attachedAt?: string;
  detachedAt?: string;
}

export interface MemberInviteActivity extends ActivityItemBase {
  type: "member_invited" | "invite_revoked";
  goalId: string;
  inviter: string;
  invitee: string;
  role: "inviter" | "invitee";
}

export interface MemberStatusActivity extends ActivityItemBase {
  type: "member_joined" | "member_removed";
  goalId: string;
  member: string;
}

export type ActivityItem =
  | DepositActivity
  | GoalCreatedActivity
  | DepositAttachmentActivity
  | MemberInviteActivity
  | MemberStatusActivity;

export interface ActivityResponse {
  userAddress: string;
  startBlock: number;
  endBlock: number;
  limit: number;
  activities: ActivityItem[];
}

// Utility types
export type ApiResponse<T> = T | ErrorResponse;

export type VaultAsset = "USDC" | "cUSD" | "USDT" | "cKES";

// Multi-vault goal types
export interface MetaGoal {
  metaGoalId: string;
  name: string;
  targetAmountToken: number;
  targetDate: string;
  creatorAddress: string;
  onChainGoals: Partial<Record<VaultAsset, string>>; // asset -> goalId mapping
  isPublic?: boolean;
  participants?: string[];
  invitedUsers?: string[]; // For private goals
  xpAwarded?: boolean; // Track if XP has been awarded for completed goal
  createdAt: string;
  updatedAt: string;
}

export interface UserXP {
  userAddress: string;
  totalXP: number;
  xpHistory: Array<{
    metaGoalId: string;
    goalName: string;
    xpEarned: number;
    contributionUSD: number;
    completedAt: string;
  }>;
  updatedAt: string;
}

export interface MetaGoalWithProgress extends MetaGoal {
  totalProgressUSD: number;
  progressPercent: number;
  vaultProgress: Partial<Record<
    VaultAsset,
    {
      goalId: string;
      progressUSD: number;
      progressPercent: number;
      attachmentCount: number;
    }
  >>;
  participants: string[];
  userBalance: string;
  userBalanceUSD: string;
}

export interface CreateMultiVaultGoalRequest {
  name: string;
  targetAmountToken: number;
  targetDate?: string;
  creatorAddress: string;
  vaults: VaultAsset[] | "all";
}

export interface CreateMultiVaultGoalResponse {
  success: boolean;
  metaGoalId: string;
  onChainGoals: Record<VaultAsset, string>;
  txHashes: Record<VaultAsset, string>;
  shareLink?: string;
}

export interface AttachDepositRequest {
  metaGoalId: string;
  depositVault: string;
  depositId: string;
  userAddress: string;
}

export interface AttachDepositResponse {
  success: boolean;
  metaGoalId: string;
  attachedToGoalId: string;
  vault: string;
  attachTxHash: string;
}

export interface SelfVerification {
  selfId: string;
  walletAddress: string;
  sessionId: string;
  attestationId: string;
  userIdentifier: string;
  nullifier: string;
  nationality?: string;
  olderThan?: number;
  ofac: boolean[];
  forbiddenCountriesListPacked: string[];
  userData?: string;
  verifiedAt: Date;
  chainId: number;
  endpoint: string;
  createdAt: Date;
  updatedAt: Date;
}
