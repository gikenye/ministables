import { getContract, readContract } from "thirdweb";
import { client } from "@/lib/thirdweb/client";
import { Chain } from "thirdweb/chains";
import { getVaultAddress, getStrategyAddress, getTokenInfo } from "@/config/chainConfig";

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
        const deposit = await readContract({
          contract: vault,
          method: "function getUserDeposit(address user, uint256 index) view returns (uint256, uint256, uint256, uint256, bool)",
          params: [userAddress, BigInt(i)],
        }) as [bigint, bigint, bigint, bigint, boolean];

        const [principal, currentValue, yieldEarned, lockEnd, canWithdraw] = deposit;

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

      aaveDeployed = (await readContract({
        contract: strategy,
        method: "function totalDeployed() view returns (uint256)",
        params: [],
      })).toString();

      aaveHarvested = (await readContract({
        contract: strategy,
        method: "function totalYieldHarvested() view returns (uint256)",
        params: [],
      })).toString();
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
};
