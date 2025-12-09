/**
 * Backend API Service
 * Centralized service for managing backend API endpoints
 */

// Environment variable configuration
const ALLOCATE_API_URL = process.env.ALLOCATE_API_URL || process.env.NEXT_PUBLIC_ALLOCATE_API_URL || "";

if (!process.env.ALLOCATE_API_URL && !process.env.NEXT_PUBLIC_ALLOCATE_API_URL) {
  console.warn(
    "ALLOCATE_API_URL environment variable not set. Using fallback URL for development."
  );
}

// API endpoint configuration
export const API_ENDPOINTS = {
  ALLOCATE: "/api/allocate",
  USER_POSITIONS: "/api/user-balances",
  LEADERBOARD: "/api/leaderboard",
  GOALS: "/api/goals",
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
  targetGoalId?: string; // Optional target goal ID for goal-specific deposits
  lockTier?: number; // Lock tier in days (default: 30)
}

export interface AllocateResponse {
  success: boolean;
  depositId: string;
  goalId: string;
  shares: string;
  formattedShares: string;
  allocationTxHash: string;
}

// Multi-vault goal types
export interface CreateGoalRequest {
  name: string;
  targetAmountUSD: number;
  targetDate: string; // use '0' 
  creatorAddress: string;
  vaults: SupportedAsset[] | "all";
  isPublic?: boolean;
}

export interface CreateGoalResponse {
  success: boolean;
  metaGoalId: string;
  onChainGoals: Record<SupportedAsset, string>;
  txHashes: Record<SupportedAsset, string>;
  shareLink?: string;
}

export interface GoalDetailsResponse {
  _id: string;
  metaGoalId: string;
  name: string;
  targetAmountUSD: number;
  targetDate: string;
  creatorAddress: string;
  onChainGoals: Record<SupportedAsset, string>;
  totalProgressUSD: number;
  progressPercent: number;
  vaultProgress: Record<SupportedAsset, {
    goalId: string;
    progressUSD: number;
    progressPercent: number;
    attachmentCount: number;
  }>;
  participants: string[];
  userBalance: string;
  userBalanceUSD: string;
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
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
  targetAmountUSD: number;
  targetDate: string;
  creatorAddress: string;
  isPublic: boolean;
  participantCount: number;
  createdAt: string;
  // Additional fields used by components
  currentAmountUSD?: number;
  category?: string;
  status?: 'active' | 'completed' | 'paused';
  description?: string;
  // Goal IDs for different assets
  goalIds?: Record<SupportedAsset, string>;
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
}

export interface JoinGoalWithAllocationRequest {
  asset: SupportedAsset;
  userAddress: string;
  amount: string; // Amount in wei
  txHash: string;
  targetGoalId: string;
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
  targetAmountUSD: number;
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

export interface GroupGoalDetailsResponse {
  metaGoalId: string;
  goalName: string;
  targetAmountUSD: number;
  balances: Record<SupportedAsset, {
    asset: SupportedAsset;
    totalBalance: string;
    formattedBalance: string;
  }>;
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
  leaderboardScore: string;
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
  formattedScore?: string;
  rank?: number;
  totalUsers?: string;
}

export interface LeaderboardResponse {
  total: string;
  start: number;
  limit: number;
  data: Array<{
    rank: number;
    address: string;
    score: string;
    formattedScore?: string;
  }>;
}

export interface ApiError {
  error: string;
}

// Base API client with error handling
export class BackendApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || ALLOCATE_API_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {

    const url = `${this.baseUrl}${endpoint}`;
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
        console.error("[BackendApiClient] API ERROR:", {
          url,
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("[BackendApiClient] REQUEST FAILED:", {
        url,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Network error occurred while calling backend API");
    }
  }

  // Allocation API methods
  async allocateDeposit(request: AllocateRequest): Promise<AllocateResponse> {
    const result = await this.request<AllocateResponse>(`${API_ENDPOINTS.USER_POSITIONS}?action=allocate`, {
      method: "POST",
      body: JSON.stringify(request),
    });
    return result;
  }

  // User Portfolio API methods
  async getUserPortfolio(userAddress: string): Promise<UserPortfolioResponse> {
    const params = new URLSearchParams({ userAddress });
    return this.request<UserPortfolioResponse>(`${API_ENDPOINTS.USER_POSITIONS}?${params}`);
  }

  // Multi-vault goal creation API methods
  async createGroupGoal(request: CreateGoalRequest): Promise<CreateGoalResponse> {
    return this.request<CreateGoalResponse>(`${API_ENDPOINTS.USER_POSITIONS}?action=create-group-goal`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Group savings API methods
  async getAllGroupSavings(): Promise<GroupSavingsResponse> {
    return this.request<GroupSavingsResponse>(`${API_ENDPOINTS.USER_POSITIONS}?action=all-group-savings`);
  }

  async getPublicGoals(): Promise<GroupSavingsResponse> {
    return this.request<GroupSavingsResponse>(`${API_ENDPOINTS.USER_POSITIONS}?action=public-goals`);
  }

  async getPrivateGoals(): Promise<GroupSavingsResponse> {
    return this.request<GroupSavingsResponse>(`${API_ENDPOINTS.USER_POSITIONS}?action=private-goals`);
  }

  async joinGoal(request: JoinGoalRequest): Promise<JoinGoalResponse> {
    return this.request<JoinGoalResponse>(`${API_ENDPOINTS.USER_POSITIONS}?action=join-goal`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Join goal with allocation - allocates existing deposit to a group goal
  async joinGoalWithAllocation(request: {
    asset: SupportedAsset;
    userAddress: string;
    amount: string;
    txHash: string;
    targetGoalId: string;
  }): Promise<AllocateResponse> {
    // Use the same allocateDeposit method for consistency
    return this.allocateDeposit({
      asset: request.asset,
      userAddress: request.userAddress,
      amount: request.amount,
      txHash: request.txHash,
      targetGoalId: request.targetGoalId,
    });
  }

  async getGroupGoalMembers(metaGoalId: string): Promise<GroupGoalMembersResponse> {
    return this.request<GroupGoalMembersResponse>(`${API_ENDPOINTS.USER_POSITIONS}?action=group-goal-members`, {
      method: "POST",
      body: JSON.stringify({ metaGoalId }),
    });
  }

  async getGroupGoalDetails(metaGoalId: string): Promise<GroupGoalDetailsResponse> {
    return this.request<GroupGoalDetailsResponse>(`${API_ENDPOINTS.USER_POSITIONS}?action=group-goal-details`, {
      method: "POST",
      body: JSON.stringify({ metaGoalId }),
    });
  }

  async cancelGoal(metaGoalId: string, userAddress: string): Promise<{ success: boolean; metaGoalId: string; cancelledGoals: Record<SupportedAsset, string> }> {
    return this.request(`${API_ENDPOINTS.USER_POSITIONS}?action=cancel-goal`, {
      method: "POST",
      body: JSON.stringify({ metaGoalId, userAddress }),
    });
  }

  // My Groups API - Get user's group memberships
  async getMyGroups(userAddress: string): Promise<{
    total: number;
    public: { total: number; goals: GroupSavingsGoal[] };
    private: { total: number; goals: GroupSavingsGoal[] };
  }> {
    const params = new URLSearchParams({ action: "my-groups", userAddress });
    return this.request(`${API_ENDPOINTS.USER_POSITIONS}?${params}`);
  }

  // Multi-vault Goals API methods
  async getUserGoalsByCreator(creatorAddress: string): Promise<GoalDetailsResponse[]> {
    const params = new URLSearchParams({ creatorAddress });
    return this.request<GoalDetailsResponse[]>(`${API_ENDPOINTS.GOALS}?${params}`);
  }

  // Get goals with progress data
  async getGoalsWithProgress(creatorAddress: string): Promise<GoalDetailsResponse[]> {
    const params = new URLSearchParams({ creatorAddress });
    return this.request<GoalDetailsResponse[]>(`${API_ENDPOINTS.GOALS}?${params}`);
  }

  // Leaderboard API methods
  async getUserScore(userAddress: string): Promise<UserScoreResponse> {
    const params = new URLSearchParams({ userAddress });
    return this.request<UserScoreResponse>(
      `${API_ENDPOINTS.LEADERBOARD}?${params}`
    );
  }

  async getLeaderboard(
    start: number = 0,
    limit: number = 10
  ): Promise<LeaderboardResponse> {
    const params = new URLSearchParams({
      action: "leaderboard",
      start: start.toString(),
      limit: limit.toString(),
    });
    return this.request<LeaderboardResponse>(
      `${API_ENDPOINTS.USER_POSITIONS}?${params}`
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