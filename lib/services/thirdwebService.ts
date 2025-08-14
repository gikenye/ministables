import { getContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "../thirdweb/client";
import { readContract } from "thirdweb";
// Removed unused imports that were causing linting errors

// Contract configuration
export const MINILEND_ADDRESS = "0x4e1B2f1b9F5d871301D41D7CeE901be2Bd97693c";
// Use env-configured oracle for Celo; default to the provided BackendPriceOracle
export const ORACLE_ADDRESS =
  (process.env.NEXT_PUBLIC_BACKEND_ORACLE_ADDRESS as string | undefined)?.trim() ||
  "0x66b2Ed926b810ca5296407d0fE8F1dB73dFe5924";

// All supported stablecoins from contract
export const NEW_SUPPORTED_TOKENS = {
   USDC: {
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
    USDT: {
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
  },
  cUSD: {
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    symbol: "cUSD",
    name: "Celo Dollar",
    decimals: 18,
  },
    cKES: {
    address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0",
    symbol: "cKES",
    name: "Celo Kenyan Shilling",
    decimals: 18,
  },
    cNGN: {
    address: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71",
    symbol: "cNGN",
    name: "Celo Nigerian Naira",
    decimals: 18,
  },
  CELO: {
    address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
    symbol: "CELO",
    name: "Celo",
    decimals: 18,
  },
  
  // cEUR: {
  //   address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  //   symbol: "cEUR",
  //   name: "Celo Euro",
  //   decimals: 18,
  // },
  // cREAL: {
  //   address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
  //   symbol: "cREAL",
  //   name: "Celo Real",
  //   decimals: 18,
  // },
  // eXOF: {
  //   address: "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08",
  //   symbol: "eXOF",
  //   name: "West African CFA Franc",
  //   decimals: 18,
  // },

  // PUSO: {
  //   address: "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B",
  //   symbol: "PUSO",
  //   name: "Philippine Peso",
  //   decimals: 18,
  // },
  // cCOP: {
  //   address: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA",
  //   symbol: "cCOP",
  //   name: "Celo Colombian Peso",
  //   decimals: 18,
  // },
  // cGHS: {
  //   address: "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313",
  //   symbol: "cGHS",
  //   name: "Celo Ghanaian Cedi",
  //   decimals: 18,
  // },

 
  // USDGLO: {
  //   address: "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3",
  //   symbol: "USDGLO",
  //   name: "Glo Dollar",
  //   decimals: 18,
  // },

} as const;

// Oracle fallback rates
const ORACLE_FALLBACK_RATES: Record<string, string> = {
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": "1000000000000000000", // USDC
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": "1000000000000000000", // USDT
  "0x471EcE3750Da237f93B8E339c536989b8978a438": "300000000000000000", // CELO
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": "1000000000000000000", // cUSD
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": "7700000000000000", // cKES
  "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71": "654000000000000", // cNGN




  // "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": "1100000000000000000", // cEUR
  // "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": "200000000000000000", // cREAL
  // "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": "1700000000000000", // eXOF
  // "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": "18000000000000000", // PUSO
  // "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": "250000000000000", // cCOP
  // "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": "63000000000000000", // cGHS
  // "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": "1000000000000000000", // USDGLO
};

class ThirdwebService {
  private contract;
  private oracleContract;
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 150; // Minimum delay between requests in ms

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

  private async rateLimitedRequest<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.REQUEST_DELAY) {
      await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
    return fn();
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.rateLimitedRequest(fn);
      } catch (error: any) {
        if (error.message?.includes('429') && i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
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
      return Object.values(NEW_SUPPORTED_TOKENS).map((t) => t.address);
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
      return Object.values(NEW_SUPPORTED_TOKENS).map((t) => t.address);
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
      const balance = await this.retryWithBackoff(() => readContract({
        contract: this.contract,
        method: "function getUserBalance(address user, address token) returns (uint256)",
        params: [user, token],
      }));
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

  async getBorrowStartTime(user: string, token: string): Promise<string> {
    try {
      const startTime = await readContract({
        contract: this.contract,
        method: "function borrowStartTime(address, address) view returns (uint256)",
        params: [user, token],
      });
      return startTime.toString();
    } catch {
      return "0";
    }
  }

  async getTotalSupply(token: string): Promise<string> {
    try {
      const supply = await readContract({
        contract: this.contract,
        method: "function totalSupply(address) view returns (uint256)",
        params: [token],
      });
      return supply.toString();
    } catch {
      return "0";
    }
  }

  async getOracleRate(token: string): Promise<{ rate: string; timestamp: string }> {
    try {
      const result = await readContract({
        contract: this.oracleContract,
        method: "function getMedianRate(address) view returns (uint256, uint256)",
        params: [token],
      });
      return {
        rate: result[0].toString(),
        timestamp: result[1].toString(),
      };
    } catch {
      return {
        rate: ORACLE_FALLBACK_RATES[token] || "1000000000000000000",
        timestamp: Math.floor(Date.now() / 1000).toString(),
      };
    }
  }

  async getAllUserDeposits(user: string, token: string): Promise<Array<{ amount: string; lockEnd: number }>> {
    const deposits = [];
    let index = 0;
    
    try {
      while (index < 50) {
        try {
          const result = await readContract({
            contract: this.contract,
            method: "function userDeposits(address, address, uint256) view returns (uint256 amount, uint256 lockEnd)",
            params: [user, token, BigInt(index)],
          });
          
          if (result[0] === BigInt(0)) break;
          
          deposits.push({
            amount: result[0].toString(),
            lockEnd: Number(result[1]),
          });
          index++;
        } catch {
          break;
        }
      }
    } catch (error) {
      console.error(`Error fetching deposits for ${token.replace(/[\r\n]/g, '')}:`, error);
    }
    
    return deposits;
  }

  async getWithdrawableAmount(user: string, token: string): Promise<string> {
    try {
      const deposits = await this.getAllUserDeposits(user, token);
      const currentTime = Math.floor(Date.now() / 1000);
      
      let withdrawableAmount = BigInt(0);
      
      for (const deposit of deposits) {
        if (currentTime >= deposit.lockEnd) {
          withdrawableAmount += BigInt(deposit.amount);
        }
      }
      
      return withdrawableAmount.toString();
    } catch (error) {
      console.error(`Error calculating withdrawable amount for ${token.replace(/[\r\n]/g, '')}:`, error);
      return "0";
    }
  }

  getContract() {
    return this.contract;
  }

  getOracleContract() {
    return this.oracleContract;
  }
}

export const thirdwebService = new ThirdwebService();
export default thirdwebService;

// Re-export for backward compatibility
export const ALL_SUPPORTED_TOKENS = NEW_SUPPORTED_TOKENS;
