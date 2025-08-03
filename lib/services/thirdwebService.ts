import { getContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "../thirdweb/client";
import { readContract } from "thirdweb";
import {
  useSupportedStablecoins,
  useSupportedCollateral,
  useDefaultLockPeriods,
  useGetUserBalance,
  useUserDeposits,
  useUserBorrows,
  useUserCollateral,
  useBorrowStartTime,
  useTotalSupply,
} from "../thirdweb/minilend-contract";
import { oracleService } from "./oracleService";

// Contract configuration
export const MINILEND_ADDRESS = "0x4e1B2f1b9F5d871301D41D7CeE901be2Bd97693c";
export const ORACLE_ADDRESS = "0x96D7E17a4Af7af46413A7EAD48f01852C364417A";

// All supported tokens from your existing contract
export const ALL_SUPPORTED_TOKENS = {
  USDC: {
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    category: "international",
  },
  cUSD: {
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    symbol: "cUSD",
    name: "Celo Dollar",
    decimals: 18,
    category: "stablecoin",
  },
  cEUR: {
    address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
    symbol: "cEUR",
    name: "Celo Euro",
    decimals: 18,
    category: "stablecoin",
  },
  cREAL: {
    address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
    symbol: "cREAL",
    name: "Celo Real",
    decimals: 18,
    category: "stablecoin",
  },
  USDT: {
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    category: "international",
  },
  cKES: {
    address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0",
    symbol: "cKES",
    name: "Celo Kenyan Shilling",
    decimals: 18,
    category: "regional",
  },
  USDGLO: {
    address: "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3",
    symbol: "USDGLO",
    name: "Glo Dollar",
    decimals: 18,
    category: "international",
  },
} as const;

// Oracle fallback rates from MockSortedOracles.sol
const ORACLE_FALLBACK_RATES: Record<string, string> = {
  "0x471EcE3750Da237f93B8E339c536989b8978a438": "1000000000000000000", // CELO
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": "1428571428571428571", // cUSD
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": "1571428571428571428", // cEUR
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": "285714285714285714", // cREAL
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": "10989010989010989", // cKES
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": "1428571428571428571", // USDT
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": "1428571428571428571", // USDC
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": "1428571428571428571", // USDGLO
};

class ThirdwebService {
  private contract;
  private oracleContract;

  constructor() {
    this.contract = getContract({
      client,
      chain: celo,
      address: MINILEND_ADDRESS,
    });

    this.oracleContract = getContract({
      client,
      chain: celo,
      address: ORACLE_ADDRESS,
    });
  }

  // Read functions
  async getSupportedStablecoins(): Promise<string[]> {
    try {
      const tokens = [];
      let index = 0;
      while (true) {
        try {
          const token = await readContract({
            contract: this.contract,
            method:
              "function supportedStablecoins(uint256) view returns (address)",
            params: [BigInt(index)],
          });
          tokens.push(token);
          index++;
        } catch {
          break;
        }
      }
      return tokens;
    } catch {
      return Object.values(ALL_SUPPORTED_TOKENS).map((t) => t.address);
    }
  }

  async getSupportedCollateral(): Promise<string[]> {
    try {
      const tokens = [];
      let index = 0;
      while (true) {
        try {
          const token = await readContract({
            contract: this.contract,
            method:
              "function supportedCollateral(uint256) view returns (address)",
            params: [BigInt(index)],
          });
          tokens.push(token);
          index++;
        } catch {
          break;
        }
      }
      return tokens;
    } catch {
      return Object.values(ALL_SUPPORTED_TOKENS).map((t) => t.address);
    }
  }

  async getDefaultLockPeriods(): Promise<string[]> {
    try {
      const periods = [];
      for (let i = 0; i < 5; i++) {
        try {
          const period = await readContract({
            contract: this.contract,
            method:
              "function defaultLockPeriods(uint256) view returns (uint256)",
            params: [BigInt(i)],
          });
          periods.push(period.toString());
        } catch {
          break;
        }
      }
      return periods.length > 0
        ? periods
        : ["86400", "604800", "2592000", "7776000", "31536000"];
    } catch {
      return ["86400", "604800", "2592000", "7776000", "31536000"];
    }
  }

  async getUserBalance(user: string, token: string): Promise<string> {
    try {
      const balance = await readContract({
        contract: this.contract,
        method:
          "function getUserBalance(address user, address token) view returns (uint256)",
        params: [user, token],
      });
      return balance.toString();
    } catch {
      return "0";
    }
  }

  async getUserDeposits(
    user: string,
    token: string
  ): Promise<{ amount: string; lockEnd: number }> {
    try {
      const result = await readContract({
        contract: this.contract,
        method:
          "function userDeposits(address, address, uint256) view returns (uint256 amount, uint256 lockEnd)",
        params: [user, token, BigInt(0)],
      });
      return {
        amount: result[0].toString(),
        lockEnd: Number(result[1]),
      };
    } catch {
      return { amount: "0", lockEnd: 0 };
    }
  }

  async getUserBorrows(user: string, token: string): Promise<string> {
    try {
      const borrows = await readContract({
        contract: this.contract,
        method: "function userBorrows(address, address) view returns (uint256)",
        params: [user, token],
      });
      return borrows.toString();
    } catch {
      return "0";
    }
  }

  async getUserCollateral(user: string, token: string): Promise<string> {
    try {
      const collateral = await readContract({
        contract: this.contract,
        method:
          "function userCollateral(address, address) view returns (uint256)",
        params: [user, token],
      });
      return collateral.toString();
    } catch {
      return "0";
    }
  }

  async getDepositLockEnd(user: string, token: string): Promise<number> {
    try {
      const result = await readContract({
        contract: this.contract,
        method:
          "function userDeposits(address, address, uint256) view returns (uint256 amount, uint256 lockEnd)",
        params: [user, token, BigInt(0)],
      });
      return Number(result[1]);
    } catch {
      return 0;
    }
  }

  async getBorrowStartTime(user: string, token: string): Promise<number> {
    try {
      const startTime = await readContract({
        contract: this.contract,
        method:
          "function borrowStartTime(address, address) view returns (uint256)",
        params: [user, token],
      });
      return Number(startTime);
    } catch {
      return 0;
    }
  }

  async getTotalSupply(token: string): Promise<string> {
    try {
      // Validate Oracle price before reading supply data
      const isOracleValid = await oracleService.validatePriceData(token);
      if (!isOracleValid) {
        console.warn(`Oracle price validation failed for token ${token}`);
      }
      
      const supply = await readContract({
        contract: this.contract,
        method: "function totalSupply(address) view returns (uint256)",
        params: [token],
      });
      return supply.toString();
    } catch (error) {
      console.error(`Failed to get total supply for ${token}:`, error);
      return "0";
    }
  }

  async getTokenBalance(token: string, user: string): Promise<string> {
    try {
      const tokenContract = getContract({
        client,
        chain: celo,
        address: token,
      });
      const balance = await readContract({
        contract: tokenContract,
        method: "function balanceOf(address) view returns (uint256)",
        params: [user],
      });
      return balance.toString();
    } catch {
      return "0";
    }
  }

  async getTokenInfo(
    token: string
  ): Promise<{ symbol: string; decimals: number }> {
    const tokenInfo = Object.values(ALL_SUPPORTED_TOKENS).find(
      (t) => t.address.toLowerCase() === token.toLowerCase()
    );

    if (tokenInfo) {
      return { symbol: tokenInfo.symbol, decimals: tokenInfo.decimals };
    }

    try {
      const tokenContract = getContract({
        client,
        chain: celo,
        address: token,
      });

      const [symbol, decimals] = await Promise.all([
        readContract({
          contract: tokenContract,
          method: "function symbol() view returns (string)",
          params: [],
        }),
        readContract({
          contract: tokenContract,
          method: "function decimals() view returns (uint8)",
          params: [],
        }),
      ]);

      return { symbol, decimals: Number(decimals) };
    } catch {
      return { symbol: "UNKNOWN", decimals: 18 };
    }
  }

  async getOracleRate(
    token: string
  ): Promise<{ rate: string; timestamp: number }> {
    try {
      const result = await oracleService.getMedianRate(token);
      return {
        rate: result.rate.toString(),
        timestamp: Number(result.timestamp),
      };
    } catch (error) {
      console.error(`Failed to get oracle rate for ${token}:`, error);
      const fallbackRate = ORACLE_FALLBACK_RATES[token] || "1428571428571428571";
      return { rate: fallbackRate, timestamp: Math.floor(Date.now() / 1000) };
    }
  }

  async batchGetUserData(user: string, tokens: string[]): Promise<any[]> {
    const results = await Promise.all(
      tokens.map(async (token) => {
        const [deposits, borrows, collateral, lockEnd, totalSupply] =
          await Promise.all([
            this.getUserDeposits(user, token),
            this.getUserBorrows(user, token),
            this.getUserCollateral(user, token),
            this.getDepositLockEnd(user, token),
            this.getTotalSupply(token),
          ]);

        return {
          token,
          deposits: deposits.amount,
          borrows,
          collateral,
          lockEnd,
          totalSupply,
        };
      })
    );

    return results;
  }

  // Contract constants
  getSupportedStablecoinsStatic(): string[] {
    return Object.values(ALL_SUPPORTED_TOKENS).map((t) => t.address);
  }

  getSupportedCollateralStatic(): string[] {
    return Object.values(ALL_SUPPORTED_TOKENS).map((t) => t.address);
  }

  getDefaultLockPeriodsStatic(): string[] {
    return ["86400", "604800", "2592000", "7776000", "31536000"];
  }
}

export const thirdwebService = new ThirdwebService();
