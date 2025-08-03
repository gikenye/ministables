import { getContract, readContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "../thirdweb/client";

export const ORACLE_ADDRESS = "0x96D7E17a4Af7af46413A7EAD48f01852C364417A";

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
        method: "function medianRate(address token) view returns (uint256 rate, uint256 timestamp)",
        params: [tokenAddress],
      });
      
      return {
        rate: result[0],
        timestamp: result[1],
      };
    } catch (error) {
      console.error(`Failed to get oracle rate for ${tokenAddress}:`, error);
      throw new Error(`Oracle price feed unavailable for token ${tokenAddress}`);
    }
  }

  async validatePriceData(tokenAddress: string): Promise<boolean> {
    try {
      const { rate, timestamp } = await this.getMedianRate(tokenAddress);
      const currentTime = BigInt(Math.floor(Date.now() / 1000));
      const oneHour = BigInt(3600);
      
      // Check if price is valid (> 0) and not stale (< 1 hour old)
      return rate > 0n && (currentTime - timestamp) <= oneHour;
    } catch {
      return false;
    }
  }

  async validateMultipleTokens(tokenAddresses: string[]): Promise<boolean> {
    try {
      const validations = await Promise.all(
        tokenAddresses.map(token => this.validatePriceData(token))
      );
      return validations.every(isValid => isValid);
    } catch {
      return false;
    }
  }
}

export const oracleService = new OracleService();