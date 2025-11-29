/**
 * Backend API Service
 * Centralized service for managing backend API endpoints
 */

// Environment variable configuration
const ALLOCATE_API_URL = process.env.ALLOCATE_API_URL;

if (!ALLOCATE_API_URL) {
  console.warn(
    "ALLOCATE_API_URL environment variable not set. Backend API calls may fail."
  );
}

// API endpoint configuration
export const API_ENDPOINTS = {
  ALLOCATE: "/api/allocate",
  GOALS: "/api/goals",
  LEADERBOARD: "/api/leaderboard",
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
}

export interface AllocateResponse {
  success: boolean;
  depositId: string;
  quicksaveGoalId: string;
  shares: string;
  allocationTxHash: string;
}

export interface CreateGoalRequest {
  vaultAddress: string;
  targetAmount: string;
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

export interface GoalDetailsResponse {
  id: string;
  creator: string;
  vault: string;
  targetAmount: string;
  targetDate: string; // Unix timestamp as string
  metadataURI: string;
  createdAt: string; // Unix timestamp as string
  cancelled: boolean;
  completed: boolean;
  totalValue: string;
  percentBps: string;
  attachments: Array<{
    owner: string;
    depositId: string;
    attachedAt: string; // Unix timestamp as string
    pledged: boolean;
  }>;
}

export interface QuicksaveGoalResponse {
  quicksaveGoalId: string;
}

export interface UserScoreResponse {
  userAddress: string;
  score: string;
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
    this.baseUrl = baseUrl || ALLOCATE_API_URL || "";
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.baseUrl) {
      throw new Error(
        "Backend API URL not configured. Please set ALLOCATE_API_URL environment variable."
      );
    }

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
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Network error occurred while calling backend API");
    }
  }

  // Allocation API methods
  async allocateDeposit(request: AllocateRequest): Promise<AllocateResponse> {
    return this.request<AllocateResponse>(API_ENDPOINTS.ALLOCATE, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Goal creation API methods
  async createGoal(request: CreateGoalRequest): Promise<CreateGoalResponse> {
    return this.request<CreateGoalResponse>("/api/create-goal", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  // Goals API methods
  async getGoalDetails(goalId: string): Promise<GoalDetailsResponse> {
    // Validate goalId - must be a positive integer (goal IDs start from 1 in the contract)
    const goalIdNum = parseInt(goalId, 10);
    if (isNaN(goalIdNum) || goalIdNum <= 0) {
      throw new Error(
        `Invalid goal ID: ${goalId}. Goal ID must be a positive integer.`
      );
    }

    const params = new URLSearchParams({ goalId });
    return this.request<GoalDetailsResponse>(
      `${API_ENDPOINTS.GOALS}?${params}`
    );
  }

  async getQuicksaveGoal(
    userAddress: string,
    vaultAddress: string
  ): Promise<QuicksaveGoalResponse> {
    const params = new URLSearchParams({ userAddress, vaultAddress });
    return this.request<QuicksaveGoalResponse>(
      `${API_ENDPOINTS.GOALS}?${params}`
    );
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
      start: start.toString(),
      limit: limit.toString(),
    });
    return this.request<LeaderboardResponse>(
      `${API_ENDPOINTS.LEADERBOARD}?${params}`
    );
  }
}

// Default API client instance
export const backendApiClient = new BackendApiClient();

// Helper functions
export function mapTokenSymbolToAsset(symbol: string): SupportedAsset | null {
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
