import { getContract, readContract } from "thirdweb";
import { client } from "@/lib/thirdweb/client";
import { Chain } from "thirdweb/chains";
import {
  getVaultAddress,
  getStrategyAddress,
  getTokenInfo,
  hasVaultContracts,
  getTokens,
} from "@/config/chainConfig";

// Enhanced interfaces for goal integration
export interface VaultDepositGoalIntegration {
  chainId: number;
  vaultAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  lockTierId: number;
  lockPeriod: number; // in seconds
  userId: string;
  goalId?: string;
  transactionHash?: string;
  depositId?: number; // From vault contract
}

export interface VaultWithdrawalGoalIntegration {
  chainId: number;
  vaultAddress: string;
  userId: string;
  depositId: number;
  goalId?: string;
  transactionHash?: string;
  withdrawnAmount?: string;
  yieldEarned?: string;
}

export interface VaultDeposit {
  depositId: number;
  principal: string;
  currentValue: string;
  yieldEarned: string;
  canWithdraw: boolean;
  lockEnd: number;
}

export interface VaultPosition {
  tokenSymbol: string;
  tokenAddress: string;
  decimals: number;
  walletBalance: string;
  deposits: VaultDeposit[];
  totalPrincipal: string;
  totalCurrentValue: string;
  totalYield: string;
  aaveDeployed: string;
  aaveHarvested: string;
}

export const vaultService = {
  async getVaultPosition(
    chain: Chain,
    userAddress: string,
    tokenSymbol: string
  ): Promise<VaultPosition> {
    const vaultAddress = getVaultAddress(chain.id, tokenSymbol);

    const vault = getContract({
      client,
      chain,
      address: vaultAddress,
    });

    // Get asset address from vault
    const assetAddress = await readContract({
      contract: vault,
      method: "function asset() view returns (address)",
      params: [],
    });

    // Get token info using the asset address
    const tokenInfo = getTokenInfo(chain.id, assetAddress);

    const asset = getContract({
      client,
      chain,
      address: assetAddress,
    });

    // Get wallet balance
    const walletBalance = await readContract({
      contract: asset,
      method: "function balanceOf(address) view returns (uint256)",
      params: [userAddress],
    });

    // Get deposit count
    const depositCount = await readContract({
      contract: vault,
      method: "function depositCount(address) view returns (uint256)",
      params: [userAddress],
    });

    const deposits: VaultDeposit[] = [];
    let totalPrincipal = BigInt(0);
    let totalCurrentValue = BigInt(0);
    let totalYield = BigInt(0);

    // Fetch all deposits
    for (let i = 0; i < Number(depositCount); i++) {
      try {
        const deposit = (await readContract({
          contract: vault,
          method:
            "function getUserDeposit(address user, uint256 index) view returns (uint256, uint256, uint256, uint256, bool)",
          params: [userAddress, BigInt(i)],
        })) as [bigint, bigint, bigint, bigint, boolean];

        const [principal, currentValue, yieldEarned, lockEnd, canWithdraw] =
          deposit;

        if (principal > BigInt(0)) {
          deposits.push({
            depositId: i,
            principal: principal.toString(),
            currentValue: currentValue.toString(),
            yieldEarned: yieldEarned.toString(),
            canWithdraw,
            lockEnd: Number(lockEnd),
          });

          totalPrincipal += principal;
          totalCurrentValue += currentValue;
          totalYield += yieldEarned;
        }
      } catch (e) {
        console.warn(`Failed to fetch deposit ${i} for ${tokenSymbol}:`, e);
      }
    }

    // Get Aave strategy data if available
    let aaveDeployed = "0";
    let aaveHarvested = "0";
    try {
      const strategyAddress = getStrategyAddress(chain.id, tokenSymbol);
      const strategy = getContract({
        client,
        chain,
        address: strategyAddress,
      });

      aaveDeployed = (
        await readContract({
          contract: strategy,
          method: "function totalDeployed() view returns (uint256)",
          params: [],
        })
      ).toString();

      aaveHarvested = (
        await readContract({
          contract: strategy,
          method: "function totalYieldHarvested() view returns (uint256)",
          params: [],
        })
      ).toString();
    } catch (e) {
      // Strategy might not exist for this token
    }

    return {
      tokenSymbol,
      tokenAddress: assetAddress,
      decimals: tokenInfo.decimals,
      walletBalance: walletBalance.toString(),
      deposits,
      totalPrincipal: totalPrincipal.toString(),
      totalCurrentValue: totalCurrentValue.toString(),
      totalYield: totalYield.toString(),
      aaveDeployed,
      aaveHarvested,
    };
  },

  async getAllVaultPositions(
    chain: Chain,
    userAddress: string,
    tokenSymbols: string[]
  ): Promise<VaultPosition[]> {
    const positions = await Promise.all(
      tokenSymbols.map((symbol) =>
        this.getVaultPosition(chain, userAddress, symbol).catch((err) => {
          console.warn(`Failed to fetch vault position for ${symbol}:`, err);
          return null;
        })
      )
    );

    return positions.filter((p): p is VaultPosition => p !== null);
  },

  // Goal Integration Methods

  /**
   * Get vault contract address for a given chain and token (goal integration)
   */
  getGoalVaultAddress(chainId: number, tokenSymbol: string): string {
    if (!hasVaultContracts(chainId)) {
      throw new Error(`Chain ${chainId} does not support vault contracts`);
    }
    return getVaultAddress(chainId, tokenSymbol);
  },

  /**
   * Get supported tokens for vault operations on a given chain
   */
  getSupportedVaultTokens(
    chainId: number
  ): Array<{ address: string; symbol: string; decimals: number }> {
    try {
      const tokenConfig = getTokens(chainId);

      // Filter to only tokens that have vault contracts
      const vaultTokens = [];
      for (const token of tokenConfig) {
        try {
          this.getGoalVaultAddress(chainId, token.symbol);
          vaultTokens.push(token);
        } catch {
          // Token doesn't have a vault, skip it
        }
      }

      return vaultTokens;
    } catch (error) {
      throw new Error(
        `Failed to get supported tokens for chain ${chainId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },

  /**
   * Map lock period (in seconds) to lock tier ID based on vault contract configuration
   */
  getLockTierId(lockPeriodSeconds: number): number {
    const lockTierMap: Record<number, number> = {
      0: 0, // No lock
      2592000: 1, // 30 days
      7776000: 2, // 90 days
      15552000: 3, // 180 days
    };

    return lockTierMap[lockPeriodSeconds] ?? 0;
  },

  /**
   * Get lock period in seconds from tier ID
   */
  getLockPeriodFromTier(lockTierId: number): number {
    const lockPeriods = [0, 2592000, 7776000, 15552000];
    return lockPeriods[lockTierId] || 0;
  },

  /**
   * Validate deposit parameters before vault interaction
   */
  validateGoalDepositParams(deposit: Partial<VaultDepositGoalIntegration>): {
    valid: boolean;
    error?: string;
  } {
    if (!deposit.chainId) {
      return { valid: false, error: "Chain ID is required" };
    }

    if (!hasVaultContracts(deposit.chainId)) {
      return {
        valid: false,
        error: `Chain ${deposit.chainId} does not support vault contracts`,
      };
    }

    if (!deposit.tokenSymbol) {
      return { valid: false, error: "Token symbol is required" };
    }

    if (!deposit.amount || parseFloat(deposit.amount) <= 0) {
      return { valid: false, error: "Valid amount is required" };
    }

    if (!deposit.userId) {
      return { valid: false, error: "User ID is required" };
    }

    try {
      this.getGoalVaultAddress(deposit.chainId, deposit.tokenSymbol);
    } catch (error) {
      return {
        valid: false,
        error: `Token ${deposit.tokenSymbol} not supported on chain ${deposit.chainId}`,
      };
    }

    return { valid: true };
  },

  /**
   * Prepare vault deposit data for contract interaction (goal integration)
   * This mirrors the logic from SaveMoneyModal.tsx
   */
  prepareGoalVaultDeposit(params: {
    chainId: number;
    tokenSymbol: string;
    amount: string;
    lockPeriod?: number; // Made optional, defaults to 30 days
    userId: string;
    goalId?: string;
  }): VaultDepositGoalIntegration {
    const validation = this.validateGoalDepositParams(params);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const vaultAddress = this.getGoalVaultAddress(
      params.chainId,
      params.tokenSymbol
    );
    const tokenInfo = getTokenInfo(
      params.chainId,
      this.getTokenAddressBySymbol(params.chainId, params.tokenSymbol)
    );
    const lockPeriod = params.lockPeriod ?? 2592000; // Default to 30 days (2592000 seconds)
    const lockTierId = this.getLockTierId(lockPeriod);

    return {
      chainId: params.chainId,
      vaultAddress,
      tokenAddress: tokenInfo.address,
      tokenSymbol: params.tokenSymbol,
      amount: params.amount,
      lockTierId,
      lockPeriod,
      userId: params.userId,
      goalId: params.goalId,
    };
  },

  /**
   * Get token address by symbol for a given chain
   */
  getTokenAddressBySymbol(chainId: number, symbol: string): string {
    const tokens = getTokens(chainId);
    const token = tokens.find(
      (t: any) => t.symbol.toLowerCase() === symbol.toLowerCase()
    );
    if (!token) {
      throw new Error(`Token ${symbol} not found on chain ${chainId}`);
    }
    return token.address;
  },

  /**
   * Calculate estimated APY for a vault deposit
   * This should integrate with your existing aave rates service
   */
  async getEstimatedVaultAPY(
    chainId: number,
    tokenSymbol: string,
    lockPeriod: number
  ): Promise<number> {
    try {
      // This would integrate with your existing aaveRatesService
      // For now, return a placeholder based on contract logic
      const baseAPY = 5.0; // 5% base APY
      const lockTierId = this.getLockTierId(lockPeriod);

      // Apply yield boost based on lock tier (matches contract logic)
      const yieldBoosts = [0, 0.5, 2.0, 5.0]; // 0%, 0.5%, 2%, 5% boost
      const boost = yieldBoosts[lockTierId] || 0;

      return baseAPY + boost;
    } catch (error) {
      console.error("Failed to get estimated APY:", error);
      return 0;
    }
  },

  /**
   * Format vault deposit for transaction record
   * This creates the data structure needed for SavingsTransaction
   */
  formatVaultDepositTransaction(deposit: VaultDepositGoalIntegration): {
    type: "deposit";
    paymentMethod: "blockchain";
    tokenAddress: string;
    tokenSymbol: string;
    amount: string;
    metadata: Record<string, any>;
  } {
    return {
      type: "deposit",
      paymentMethod: "blockchain",
      tokenAddress: deposit.tokenAddress,
      tokenSymbol: deposit.tokenSymbol,
      amount: deposit.amount,
      metadata: {
        vaultAddress: deposit.vaultAddress,
        lockTierId: deposit.lockTierId,
        lockPeriod: deposit.lockPeriod,
        chainId: deposit.chainId,
        contractType: "SupplierVault",
        depositId: deposit.depositId,
        goalIntegration: true,
      },
    };
  },

  /**
   * Format vault withdrawal for transaction record
   */
  formatVaultWithdrawalTransaction(
    withdrawal: VaultWithdrawalGoalIntegration
  ): {
    type: "withdrawal";
    paymentMethod: "blockchain";
    amount: string;
    metadata: Record<string, any>;
  } {
    return {
      type: "withdrawal",
      paymentMethod: "blockchain",
      amount: withdrawal.withdrawnAmount || "0",
      metadata: {
        vaultAddress: withdrawal.vaultAddress,
        depositId: withdrawal.depositId,
        chainId: withdrawal.chainId,
        contractType: "SupplierVault",
        yieldEarned: withdrawal.yieldEarned,
        goalIntegration: true,
      },
    };
  },

  /**
   * Check if a chain supports vault operations
   */
  isVaultChainSupported(chainId: number): boolean {
    return hasVaultContracts(chainId);
  },

  /**
   * Get vault contract configuration for display
   */
  getVaultConfig(chainId: number) {
    const supportedTokens = this.getSupportedVaultTokens(chainId);
    const lockTiers = [
      {
        id: 0,
        duration: 0,
        durationText: "No lock",
        yieldBoostBps: 0,
        yieldBoostPercent: 0,
      },
      {
        id: 1,
        duration: 2592000,
        durationText: "30 days",
        yieldBoostBps: 50,
        yieldBoostPercent: 0.5,
      },
      {
        id: 2,
        duration: 7776000,
        durationText: "90 days",
        yieldBoostBps: 200,
        yieldBoostPercent: 2.0,
      },
      {
        id: 3,
        duration: 15552000,
        durationText: "180 days",
        yieldBoostBps: 500,
        yieldBoostPercent: 5.0,
      },
    ];

    return {
      chainId,
      supportedTokens,
      lockTiers,
      maxDepositsPerUser: 128, // From contract MAX_DEPOSITS_PER_USER
    };
  },
};
