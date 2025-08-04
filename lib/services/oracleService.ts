import { getContract, readContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "../thirdweb/client";

export const ORACLE_ADDRESS = "0x6c844bF2c73Ab4230a09FaACfe6e6e05765f1031";

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
      const result = await readContract({
        contract: this.contract,
        method: "function getMedianRate(address token) view returns (uint256 rate, uint256 timestamp)",
        params: [tokenAddress],
      });
      
      // Debug logging only in development
      if (process.env.NODE_ENV === 'development') {
        console.debug(`Oracle data for ${tokenAddress.replace(/[\r\n]/g, '')}:`, {
          rate: result[0].toString(),
          timestamp: result[1].toString(),
          currentTime: Math.floor(Date.now() / 1000)
        });
      }
      
      return {
        rate: result[0],
        timestamp: result[1],
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
}

export const oracleService = new OracleService();