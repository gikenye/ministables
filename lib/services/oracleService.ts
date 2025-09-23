import { getContract, readContract } from "thirdweb";
import { client } from "../thirdweb/client";
import { CHAINS, CONTRACTS } from "@/config/chainConfig";

// Resolve oracle address from env for multi-chain readiness (client-safe)
// NEXT_PUBLIC_BACKEND_ORACLE_ADDRESS should be set for the active chain (Celo)
export const ORACLE_ADDRESS =
  (process.env.NEXT_PUBLIC_BACKEND_ORACLE_ADDRESS as string | undefined)?.trim() ||
  "0x66b2Ed926b810ca5296407d0fE8F1dB73dFe5924";

// Price validation constants
const ONE_HOUR_IN_SECONDS = 3600;
const ZERO = 0;

export interface OracleRate {
  rate: bigint;
  timestamp: bigint;
}

class OracleService {
  private contract: any;

  // Allow constructing the service with an explicit chain, otherwise default
  // to the first chain from the app's `CHAINS` config to avoid hardcoding.
  constructor(chain?: any, oracleAddress?: string) {
    const activeChain = chain || (CHAINS && CHAINS.length > 0 ? CHAINS[0] : undefined);
    const address = oracleAddress || ORACLE_ADDRESS || (CONTRACTS && activeChain ? CONTRACTS[activeChain.id] : undefined);

    if (!activeChain || !address) {
      // Defer contract creation if config is missing; throw on usage if necessary.
      this.contract = undefined;
    } else {
      this.contract = getContract({ client, chain: activeChain, address });
    }
  }

  async getMedianRate(tokenAddress: string): Promise<OracleRate> {
    try {
      if (!this.contract) {
        throw new Error("Oracle contract not initialized for the active chain");
      }
      // Prefer canonical getter to also retrieve timestamp
      const result = await readContract({
        contract: this.contract,
        method: "function getMedianRate(address) view returns (uint256 rate, uint256 timestamp)",
        params: [tokenAddress],
      });

      const rate = (result as any)[0] as bigint;
      const timestamp = (result as any)[1] as bigint;

      if (!rate || rate === BigInt(0)) {
        throw new Error(`No price feed for token ${tokenAddress}`);
      }

      return { rate, timestamp: timestamp ?? BigInt(0) };
    } catch (error) {
      console.error(`Failed to get oracle rate for ${tokenAddress.replace(/[\r\n]/g, '')}:`, error);
      throw new Error(`Oracle price feed unavailable for token ${tokenAddress.replace(/[\r\n]/g, '')}`);
    }
  }

  async getMultipleRates(tokenAddresses: string[]): Promise<{ rates: bigint[]; timestamp: bigint }> {
    try {
      if (!this.contract) throw new Error("Oracle contract not initialized for the active chain");
      const results = await Promise.all(tokenAddresses.map((addr) => this.getMedianRate(addr)));

      const rates = results.map((r) => r.rate);
      // Use the oldest timestamp among the set for conservatism
      const timestamp = results.reduce<bigint>((minTs, r) => (minTs === BigInt(0) || r.timestamp < minTs ? r.timestamp : minTs), BigInt(0));

      return { rates, timestamp };
    } catch (error) {
      console.error(`Failed to get multiple oracle rates:`, error);
      throw new Error(`Oracle price feed unavailable for multiple tokens`);
    }
  }

  async validatePriceData(tokenAddress: string): Promise<boolean> {
    try {
      const { rate, timestamp } = await this.getMedianRate(tokenAddress);
      const currentTime = BigInt(Math.floor(Date.now() / 1000));
      const oneHour = BigInt(ONE_HOUR_IN_SECONDS);
      const zero = BigInt(ZERO);
      // Check if price is valid (> 0) and not stale (< 1 hour old)
      return rate > zero && (currentTime - timestamp) <= oneHour;
    } catch (error) {
      console.error(`Failed to validate price data for ${tokenAddress.replace(/[\r\n]/g, '')}:`, error);
      return false;
    }
  }

  async validateMultipleTokens(tokenAddresses: string[]): Promise<boolean> {
    try {
      if (!this.contract) {
        console.error('Oracle contract not initialized for validateMultipleTokens');
        return false;
      }
      const validations = await Promise.all(tokenAddresses.map(token => this.validatePriceData(token)));
      return validations.every(isValid => isValid);
    } catch (error) {
      console.error('Failed to validate multiple tokens:', error);
      return false;
    }
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    try {
      const { rate } = await this.getMedianRate(tokenAddress);
      // Convert from wei (1e18) to decimal
      return Number(rate) / 1e18;
    } catch (error) {
      console.error(`Failed to get token price for ${tokenAddress}:`, error);
      throw error;
    }
  }
}

export const oracleService = new OracleService();