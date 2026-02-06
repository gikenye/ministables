/**
 * Backend API Service
 * Centralized service for managing backend API endpoints
 */

// Environment variable configuration
import { logger } from "@/lib/services/logger";
import { CHAINS } from "@/config/chainConfig";

const SERVER_ALLOCATE_API_URL =
  process.env.ALLOCATE_API_URL ||
  process.env.NEXT_PUBLIC_ALLOCATE_API_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "";

const CLIENT_ALLOCATE_API_URL = process.env.NEXT_PUBLIC_ALLOCATE_API_URL || "";

if (!SERVER_ALLOCATE_API_URL) {
  logger.warn(
    "ALLOCATE_API_URL not set. Falling back to relative requests when possible.",
    { component: "backendApiService", operation: "config" }
  );
}

function resolveDefaultBaseUrl(): string {
  if (typeof window !== "undefined") {
    return CLIENT_ALLOCATE_API_URL;
  }
  return SERVER_ALLOCATE_API_URL;
}

function appendChainParams(
  params: URLSearchParams,
  chainId?: number,
  chain?: string
) {
  if (typeof chainId === "number" && Number.isFinite(chainId)) {
    params.set("chainId", String(chainId));
  }
  if (chain) {
    params.set("chain", chain);
  }
  return params;
}

// API endpoint configuration
export const API_ENDPOINTS = {
  ALLOCATE: "/api/allocate",
  USER_POSITIONS: "/api/user-positions",
  LEADERBOARD: "/api/leaderboard",
  GOALS: "/api/goals",
  XP: "/api/xp",
} as const;

// Supported assets from the backend API
export const SUPPORTED_ASSETS = ["USDC", "cUSD", "USDT", "cKES"] as const;
export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

import {
  VAULT_CONTRACTS,
  GOAL_CONTRACTS,
  LEADERBOARD_CONTRACTS,
  getTokens,
  getVaultAddress as getChainVaultAddress,
  getTokensBySymbol,
} from "@/config/chainConfig";
import { celo } from "thirdweb/chains";

// Types for API requests and responses
export interface AllocateRequest {
  asset: SupportedAsset;
  userAddress: string;
  amount: string; // Amount in wei as string
  txHash: string; // Transaction hash of the deposit
  providerPayload?: unknown;
  targetGoalId?: string; // Optional target goal ID for goal-specific deposits
  lockTier?: number; // Lock tier in days (default: 30)
  tokenSymbol?: string; // Optional token symbol for local allocation API
  chainId?: number; // Optional chain ID for local allocation API
  chain?: string; // Optional chain name for local allocation API
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

// Multi-vault goal types
export interface CreateGoalRequest {
  name: string;
  targetAmountToken: number;
  targetDate: string; // use '0'
  creatorAddress: string;
  vaults: SupportedAsset[] | "all";
  isPublic?: boolean;
  chainId?: number;
  chain?: string;
}

export interface CreateGoalResponse {
  success: boolean;
  metaGoalId: string;
  onChainGoals: Record<SupportedAsset, string>;
  onChainGoalsByChain?: Record<string, Record<SupportedAsset, string>>;
  txHashes: Record<SupportedAsset, string>;
  shareLink?: string;
}

export interface InviteLinkResponse {
  success: boolean;
  inviteToken?: string;
  shareLink?: string;
  issuedAt?: string;
  expiresAt?: string;
}

export interface AcceptInviteResponse {
  success: boolean;
  metaGoalId?: string;
  invitedAddress?: string;
}

export interface GoalDetailsResponse {
  _id: string;
  metaGoalId: string;
  name: string;
  targetAmountToken: number;
  targetDate: string;
  creatorAddress: string;
  onChainGoals: Record<SupportedAsset, string>;
  onChainGoalsByChain?: Record<string, Record<SupportedAsset, string>>;
  totalProgressUSD: number;
  progressPercent: number;
  vaultProgress: Record<
    SupportedAsset,
    {
      goalId: string;
      progressUSD: number;
      progressPercent: number;
      attachmentCount: number;
    }
  >;
  participants: string[];
  userBalance: string;
  userBalanceUSD: string;
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  inviteLink?: string;
  invitedUsers?: string[];
  cachedMembers?: {
    totalContributedUSD: number;
    progressPercent: number;
    memberCount: number;
    members: any[];
  };
  lastSync?: string;
}

// Group savings types
export interface GroupSavingsGoal {
  metaGoalId: string;
  name: string;
  targetAmountToken: number;
  targetDate: string;
  creatorAddress: string;
  isPublic: boolean;
  participantCount: number;
  createdAt: string;
  onChainGoals?: Record<SupportedAsset, string>;
  onChainGoalsByChain?: Record<string, Record<SupportedAsset, string>>;
  // Additional fields used by components
  currentAmountUSD?: number;
  totalContributedUSD?: number;
  totalContributedUsd?: number;
  category?: string;
  status?: "active" | "completed" | "paused";
  description?: string;
  // Goal IDs for different assets
  goalIds?: Record<SupportedAsset, string>;
  // Fields used by ClanTab UI
  progressPercent?: number;
  totalProgressUSD?: number;
  cachedMembers?: {
    totalContributedUSD?: number;
    progressPercent?: number;
    memberCount?: number;
    members?: any[];
  };
  participants?: string[];
  invitedUsers?: string[];
  inviteLink?: string;
}

export interface GroupSavingsResponse {
  total: number;
  goals: GroupSavingsGoal[];
}

export interface JoinGoalRequest {
  goalId: string;
  userAddress: string;
  depositTxHash: string;
  asset: SupportedAsset;
  chainId?: number;
  chain?: string;
}

export interface JoinGoalWithAllocationRequest {
  asset: SupportedAsset;
  userAddress: string;
  amount: string; // Amount in wei
  txHash: string;
  targetGoalId: string;
  tokenSymbol?: string;
  chainId?: number;
}

export interface JoinGoalResponse {
  success: boolean;
  goalId: string;
  depositId: string;
  amount: string;
  formattedAmount: string;
  attachTxHash: string;
}

export interface GroupGoalMembersResponse {
  metaGoalId: string;
  goalName: string;
  targetAmountToken: number;
  totalContributedUSD: number;
  progressPercent: number;
  memberCount: number;
  members: Array<{
    address: string;
    totalContributionUSD: number;
    contributionPercent: number;
    depositCount: number;
    joinedAt: string;
  }>;
}

export interface GroupGoalInviteChallengeResponse {
  nonce: string;
  issuedAt: string;
  alreadyInvited?: boolean;
  error?: string;
}

export interface GroupGoalInviteResponse {
  success?: boolean;
  error?: string;
}

export interface GroupGoalDetailsResponse {
  metaGoalId: string;
  goalName: string;
  targetAmountToken: number;
  balances: Record<
    SupportedAsset,
    {
      asset: SupportedAsset;
      totalBalance: string;
      formattedBalance: string;
    }
  >;
  transactions: Array<{
    asset: SupportedAsset;
    userAddress: string;
    depositId: string;
    currentValue: string;
    formattedValue: string;
    attachedAt: string;
  }>;
}

export interface UserPortfolioResponse {
  userAddress: string;
  totalValueUSD: string;
  formattedLeaderboardScore: string;
  leaderboardRank: number;
  assetBalances: Array<{
    asset: SupportedAsset;
    vault: string;
    totalAmountWei: string;
    totalAmountUSD: string;
    totalSharesWei: string;
    totalSharesUSD: string;
    depositCount: number;
  }>;
  goals?: GoalDetailsResponse[];
}

export interface UserScoreResponse {
  userAddress: string;
  score: string;
  vault: string;
  totalAmountWei: string;
  totalAmountUSD: string;
  totalSharesWei: string;
  totalSharesUSD: string;
  depositCount: number;
  formattedLeaderboardScore?: string;
  rank?: number;
  totalUsers?: string;
}

export interface LeaderboardResponse {
  totalUsers: number;
  limit: number;
  offset: number;
  users: Array<{
    rank: number;
    userAddress: string;
    totalValueUSD: string;
    leaderboardScore: string;
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
  }>;
}

export interface UserXpResponse {
  useraddress: string;
  totalXP: number;
  updatedAt: string;
  xpHistory: Array<{
    metaGoalId: string;
    goalName: string;
    contributionUSD: string;
    completedAt: string;
  }>;
}

export interface awardXPResponse {
  awarded: boolean;
  recipients: Record<string, number>;
}

export interface ActivityXPResponse {
  success: boolean;
  awarded: boolean;
  earned: number;
  totalXP: number;
}

export interface XpLeaderboardEntry {
  userAddress: string;
  totalXP: number;
  updatedAt: string;
}

export interface XpLeaderboardResponse {
  leaderboard: XpLeaderboardEntry[];
}


export interface ApiError {
  error: string;
}

// Base API client with error handling
export class BackendApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? resolveDefaultBaseUrl();
    if (!this.baseUrl) {
      logger.warn(
        "BackendApiClient: No API base URL set. Using relative requests where supported.",
        { component: "backendApiService", operation: "init" }
      );
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.baseUrl ? `${this.baseUrl}${endpoint}` : endpoint;
    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        logger.error("[BackendApiClient] API ERROR", {
          component: "backendApiService",
          operation: "response.error",
          additional: {
          url,
          status: response.status,
          statusText: response.statusText,
          errorData,
          },
        });
        const error = new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        ) as Error & { status?: number; data?: unknown };
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      return await response.json();
    } catch (error) {
      logger.error("[BackendApiClient] REQUEST FAILED", {
        component: "backendApiService",
        operation: "request.error",
        additional: {
          url,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Network error occurred while calling backend API");
    }
  }

  // Allocation API methods
  async allocateDeposit(request: AllocateRequest): Promise<AllocateResponse> {
    const result = await this.request<AllocateResponse>(
      API_ENDPOINTS.ALLOCATE,
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
    return result;
  }

  // User Portfolio API methods
  async getUserPortfolio(
    userAddress: string,
    chainId?: number
  ): Promise<UserPortfolioResponse> {
    const params = appendChainParams(
      new URLSearchParams({ userAddress }),
      chainId
    );
    return this.request<UserPortfolioResponse>(
      `${API_ENDPOINTS.USER_POSITIONS}?${params}`
    );
  }

  // Multi-vault goal creation API methods
  async createGroupGoal(
    request: CreateGoalRequest
  ): Promise<CreateGoalResponse> {
    return this.request<CreateGoalResponse>(
      `${API_ENDPOINTS.USER_POSITIONS}?action=create-group-goal`,
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
  }

  // Group savings API methods
  async getAllGroupSavings(chainId?: number): Promise<GroupSavingsResponse> {
    const params = appendChainParams(
      new URLSearchParams({ action: "all-group-savings" }),
      chainId
    );
    return this.request<GroupSavingsResponse>(
      `${API_ENDPOINTS.USER_POSITIONS}?${params}`
    );
  }

  async getPublicGoals(chainId?: number): Promise<GroupSavingsResponse> {
    const params = appendChainParams(
      new URLSearchParams({ action: "public-goals" }),
      chainId
    );
    return this.request<GroupSavingsResponse>(
      `${API_ENDPOINTS.USER_POSITIONS}?${params}`
    );
  }

  async getPrivateGoals(chainId?: number): Promise<GroupSavingsResponse> {
    const params = appendChainParams(
      new URLSearchParams({ action: "private-goals" }),
      chainId
    );
    return this.request<GroupSavingsResponse>(
      `${API_ENDPOINTS.USER_POSITIONS}?${params}`
    );
  }

  async joinGoal(request: JoinGoalRequest): Promise<JoinGoalResponse> {
    return this.request<JoinGoalResponse>(
      `${API_ENDPOINTS.USER_POSITIONS}?action=join-goal`,
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
  }

  // Join goal with allocation - allocates existing deposit to a group goal
  async joinGoalWithAllocation(
    request: JoinGoalWithAllocationRequest
  ): Promise<AllocateResponse> {
    // Use the same allocateDeposit method for consistency
    return this.allocateDeposit({
      asset: request.asset,
      userAddress: request.userAddress,
      amount: request.amount,
      txHash: request.txHash,
      targetGoalId: request.targetGoalId,
      tokenSymbol: request.tokenSymbol,
      chainId: request.chainId,
    });
  }

  async getGroupGoalMembers(
    metaGoalId: string
  ): Promise<GroupGoalMembersResponse> {
    return this.request<GroupGoalMembersResponse>(
      `${API_ENDPOINTS.USER_POSITIONS}?action=group-goal-members`,
      {
        method: "POST",
        body: JSON.stringify({ metaGoalId }),
      }
    );
  }

  async getGroupGoalDetails(
    metaGoalId: string
  ): Promise<GroupGoalDetailsResponse> {
    return this.request<GroupGoalDetailsResponse>(
      `${API_ENDPOINTS.USER_POSITIONS}?action=group-goal-details`,
      {
        method: "POST",
        body: JSON.stringify({ metaGoalId }),
      }
    );
  }

  async cancelGoal(
    metaGoalId: string,
    userAddress: string
  ): Promise<{
    success: boolean;
    metaGoalId: string;
    cancelledGoals: Record<SupportedAsset, string>;
  }> {
    return this.request(`${API_ENDPOINTS.USER_POSITIONS}?action=cancel-goal`, {
      method: "POST",
      body: JSON.stringify({ metaGoalId, userAddress }),
    });
  }

  // My Groups API - Get user's group memberships
  async getMyGroups(
    userAddress: string,
    chainId?: number
  ): Promise<{
    total: number;
    public: { total: number; goals: GroupSavingsGoal[] };
    private: { total: number; goals: GroupSavingsGoal[] };
  }> {
    const params = appendChainParams(
      new URLSearchParams({
        action: "my-groups",
        userAddress,
      }),
      chainId
    );
    return this.request<{
      total: number;
      public: { total: number; goals: GroupSavingsGoal[] };
      private: { total: number; goals: GroupSavingsGoal[] };
    }>(`${API_ENDPOINTS.USER_POSITIONS}?${params}`);
  }

  // Multi-vault Goals API methods
  async getUserGoalsByCreator(
    creatorAddress: string,
    chainId?: number
  ): Promise<GoalDetailsResponse[]> {
    const params = appendChainParams(
      new URLSearchParams({ creatorAddress }),
      chainId
    );
    return this.request<GoalDetailsResponse[]>(
      `${API_ENDPOINTS.GOALS}?${params}`
    );
  }

  // Get goals with progress data
  async getGoalsWithProgress(
    creatorAddress: string,
    chainId?: number
  ): Promise<GoalDetailsResponse[]> {
    const params = appendChainParams(
      new URLSearchParams({ creatorAddress }),
      chainId
    );
    return this.request<GoalDetailsResponse[]>(
      `${API_ENDPOINTS.GOALS}?${params}`
    );
  }

  // Invite user to group goal
  async inviteUserToGroupGoal(
    metaGoalId: string,
    invitedAddress: string,
    inviterAddress: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request(`${API_ENDPOINTS.GOALS}/invite`, {
      method: "POST",
      body: JSON.stringify({ metaGoalId, invitedAddress, inviterAddress }),
    });
  }

  async getGroupGoalInviteChallenge(
    metaGoalId: string,
    invitedAddress: string,
    inviterAddress: string
  ): Promise<GroupGoalInviteChallengeResponse> {
    return this.request(`${API_ENDPOINTS.GOALS}/invite/challenge`, {
      method: "POST",
      body: JSON.stringify({ metaGoalId, invitedAddress, inviterAddress }),
    });
  }

  async sendGroupGoalInvite(request: {
    metaGoalId: string;
    invitedAddress: string;
    inviterAddress: string;
    nonce: string;
    issuedAt: string;
    signature: string;
  }): Promise<GroupGoalInviteResponse> {
    return this.request(`${API_ENDPOINTS.GOALS}/invite`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async createGroupGoalInviteLink(
    metaGoalId: string,
    inviterAddress: string
  ): Promise<InviteLinkResponse> {
    return this.request(`${API_ENDPOINTS.GOALS}/invite-link`, {
      method: "POST",
      body: JSON.stringify({ metaGoalId, inviterAddress }),
    });
  }

  async rotateGroupGoalInviteLink(
    metaGoalId: string,
    inviterAddress: string
  ): Promise<InviteLinkResponse> {
    return this.request(`${API_ENDPOINTS.GOALS}/invite-link/revoke`, {
      method: "POST",
      body: JSON.stringify({ metaGoalId, inviterAddress }),
    });
  }

  async acceptGroupGoalInvite(request: {
    metaGoalId: string;
    inviteToken: string;
    invitedAddress: string;
    chainId?: number;
    chain?: string;
  }): Promise<AcceptInviteResponse> {
    return this.request(`${API_ENDPOINTS.GOALS}/invite/accept`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Get single goal by metaGoalId
  async getGoalByMetaId(
    metaGoalId: string,
    chainId?: number
  ): Promise<GoalDetailsResponse> {
    const params = appendChainParams(new URLSearchParams(), chainId);
    const suffix = params.toString() ? `?${params}` : "";
    return this.request<GoalDetailsResponse>(
      `${API_ENDPOINTS.GOALS}/${metaGoalId}${suffix}`
    );
  }

  // Leaderboard API methods
  async getUserScore(
    userAddress: string,
    chainId?: number
  ): Promise<UserScoreResponse> {
    const params = appendChainParams(
      new URLSearchParams({ userAddress }),
      chainId
    );
    return this.request<UserScoreResponse>(
      `${API_ENDPOINTS.LEADERBOARD}?${params}`
    );
  }

  async getLeaderboard(
    start: number = 0,
    limit: number = 10,
    chainId?: number
  ): Promise<LeaderboardResponse> {
    const params = appendChainParams(
      new URLSearchParams({
        action: "leaderboard",
        start: start.toString(),
        limit: limit.toString(),
      }),
      chainId
    );
    return this.request<LeaderboardResponse>(
      `${API_ENDPOINTS.USER_POSITIONS}?${params}`
    );
  }

  // XP API methods
  async getUserXp(userAddress: string): Promise<UserXpResponse> {
    return this.request<UserXpResponse>(
      `${API_ENDPOINTS.XP}?userAddress=${userAddress}`
    );
  }
  async getUserXpHistory(userAddress: string): Promise<UserXpResponse> {
    return this.request<UserXpResponse>(
      `${API_ENDPOINTS.XP}?action=history&userAddress=${userAddress}`
    );
  }
  //award xp

  async awardXP(metaGoalId: string): Promise<awardXPResponse> {
    return this.request<awardXPResponse>(
      `${API_ENDPOINTS.XP}`,
      {
        method: "POST",
        body: JSON.stringify({ metaGoalId }),
      }
    );
  }

  async awardActivityXP(userAddress: string): Promise<ActivityXPResponse> {
    return this.request<ActivityXPResponse>(`${API_ENDPOINTS.XP}`, {
      method: "POST",
      body: JSON.stringify({ action: "activity", userAddress }),
    });
  }

  async getXpLeaderboard(limit: number = 10): Promise<XpLeaderboardResponse> {
    return this.request<XpLeaderboardResponse>(
      `${API_ENDPOINTS.XP}?action=leaderboard&limit=${limit}`
    );
  }

  async awardVerificationXP(attestationId: string, walletAddress: string): Promise<{ success: boolean; awarded: boolean; totalXP: number }> {
    return this.request(
      `${API_ENDPOINTS.XP}`,
      {
        method: "POST",
        body: JSON.stringify({ attestationId, walletAddress }),
      }
    );
  }
}

// Default API client instance
export const backendApiClient = new BackendApiClient();

// Helper functions
export function mapTokenSymbolToAsset(symbol: string): SupportedAsset | null {
  // Handle special case for cUSD token
  if (symbol.toUpperCase() === "CUSD") {
    return "cUSD";
  }
  // Handle special case for cKES token
  if (symbol.toUpperCase() === "CKES") {
    return "cKES";
  }

  const normalizedSymbol = symbol.toUpperCase();
  if (SUPPORTED_ASSETS.includes(normalizedSymbol as SupportedAsset)) {
    return normalizedSymbol as SupportedAsset;
  }
  return null;
}

export function getVaultAddressForAsset(
  asset: SupportedAsset,
  chainId: number = celo.id
): string {
  return getChainVaultAddress(chainId, asset);
}

export function getAssetAddressForAsset(
  asset: SupportedAsset,
  chainId: number = celo.id
): string {
  const tokens = getTokensBySymbol(chainId);
  const tokenInfo = tokens[asset];
  if (!tokenInfo) {
    throw new Error(`Token ${asset} not found for chain ${chainId}`);
  }
  return tokenInfo.address;
}

export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidTransactionHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}
