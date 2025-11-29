import { getVaultAddress } from "@/config/chainConfig";

interface VaultRates {
  [tokenSymbol: string]: {
    baseAPY: number;
    lastUpdated: number;
  };
}

class AaveRatesService {
  private rates: VaultRates = {};
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  private readonly VAULT_ABI = ["function getSupplyAPY() external view returns (uint256)"];

  async getAPY(chainId: number, tokenSymbol: string): Promise<number> {
    const cacheKey = `${chainId}-${tokenSymbol}`;
    const cached = this.rates[cacheKey];
    
    if (cached && Date.now() - cached.lastUpdated < this.CACHE_DURATION) {
      // console.log(`[AaveRates] Using cached APY for ${tokenSymbol}:`, cached.baseAPY);
      return cached.baseAPY;
    }

    try {
      const apy = await this.fetchVaultAPY(chainId, tokenSymbol);
      // console.log(`[AaveRates] Raw APY from Aave for ${tokenSymbol}:`, apy);
      this.rates[cacheKey] = {
        baseAPY: apy,
        lastUpdated: Date.now(),
      };
      return apy;
    } catch (error) {
      console.error(`Failed to fetch APY for ${tokenSymbol}:`, error);
      return cached?.baseAPY || 0;
    }
  }

  private async fetchVaultAPY(chainId: number, tokenSymbol: string): Promise<number> {
    if (chainId !== 42220) return 0; // Only Celo has Aave
    
    // CORRECT Aave Pool address
    const AAVE_POOL = "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402";
    
    // Token addresses
    const tokens: Record<string, string> = {
      USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
      USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
      CUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    };
    
    const tokenAddress = tokens[tokenSymbol.toUpperCase()];
    if (!tokenAddress) return 0;
    
    // getReserveData(address) selector
    const selector = "0x35ea6a75";
    const paddedAddress = tokenAddress.slice(2).padStart(64, "0");
    const callData = selector + paddedAddress;
    
    const response = await fetch('https://forno.celo.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: AAVE_POOL,
          data: callData
        }, 'latest'],
        id: 1
      })
    });

    const data = await response.json();
    // console.log(`[AaveRates] RPC response for ${tokenSymbol}:`, data);
    
    if (data.result && data.result !== "0x" && data.result.length > 194) {
      const hex = data.result;
      // currentLiquidityRate is at position 130-194 (after 0x + 64 chars config + 64 chars liquidityIndex)
      const liquidityRateHex = "0x" + hex.slice(130, 194);
      const liquidityRate = BigInt(liquidityRateHex);
      const apy = Number(liquidityRate) / 1e25; // Ray to percentage
      
      // console.log(`[AaveRates] ${tokenSymbol} - Raw APY: ${apy.toFixed(4)}%`);
      return Math.max(0, apy);
    }
    
    return 0;
  }

  getAPYWithBoost(chainId: number, tokenSymbol: string, lockPeriod: string, baseAPY: number): string {
    // Lock tier boosts from deployed contracts (in basis points converted to percentage)
    const boosts: Record<string, number> = {
      "0": 0,        // Tier 0: 0 bps (0%)
      "2592000": 0.5,  // Tier 1: 50 bps (0.5%)
      "7776000": 2,    // Tier 2: 200 bps (2%)
      "15552000": 5,   // Tier 3: 500 bps (5%)
    };
    
    const boost = boosts[lockPeriod] || 0;
    const totalAPY = baseAPY + boost;
    // console.log(`[AaveRates] ${tokenSymbol} - Base: ${baseAPY}%, Boost: ${boost}%, Total: ${totalAPY}%`);
    
    return totalAPY.toFixed(2) + '%';
  }
}

export const aaveRatesService = new AaveRatesService();