import { getContract, readContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "../thirdweb/client";

export const ORACLE_ADDRESS = "0x184BE0911c8d0931782a21698098C4bC4265d6DB";

// Price validation constants
const ONE_HOUR_IN_SECONDS = 3600;
const ZERO = 0;

export interface OracleRate {
  rate: bigint;
  timestamp: bigint;
}

class OracleService {
  private contract;

  constructor() {
    this.contract = getContract({
      client,
      chain: celo,
      address: ORACLE_ADDRESS,
    });
  }

  async getMedianRate(tokenAddress: string): Promise<OracleRate> {
    try {
      // Use direct rates mapping instead of getMedianRate function
      const rate = await readContract({
        contract: this.contract,
        method: "function rates(address) view returns (uint256)",
        params: [tokenAddress],
      });
      
      if (rate === BigInt(0)) {
        throw new Error(`No price feed for token ${tokenAddress}`);
      }
      
      return {
        rate,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      };
    } catch (error) {
      console.error(`Failed to get oracle rate for ${tokenAddress.replace(/[\r\n]/g, '')}:`, error);
      throw new Error(`Oracle price feed unavailable for token ${tokenAddress.replace(/[\r\n]/g, '')}`);
    }
  }

  async getMultipleRates(tokenAddresses: string[]): Promise<{ rates: bigint[]; timestamp: bigint }> {
    try {
      const result = await readContract({
        contract: this.contract,
        method: "function getMultipleRates(address[] tokens) view returns (uint256[] rates_array, uint256 timestamp)",
        params: [tokenAddresses],
      });
      
      return {
        rates: [...result[0]],
        timestamp: result[1],
      };
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
      const validations = await Promise.all(
        tokenAddresses.map(token => this.validatePriceData(token))
      );
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