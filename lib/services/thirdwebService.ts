import { getContract } from "thirdweb";
import { client } from "../thirdweb/client";
import { readContract } from "thirdweb";
import { CHAINS, CONTRACTS, TOKENS } from "@/config/chainConfig";
// Removed unused imports that were causing linting errors

// Contract configuration
// Provide a default minilend address derived from the chain config to avoid
// relying on legacy constants. This keeps backwards compatibility but prefers
// the configured CONTRACTS mapping when available.
const defaultChain = CHAINS && CHAINS.length > 0 ? CHAINS[0] : undefined;
export const MINILEND_CELO = (CONTRACTS && defaultChain) ? CONTRACTS[defaultChain.id] : undefined;
// Use env-configured oracle for Celo; default to the provided BackendPriceOracle
export const ORACLE_ADDRESS =
  (process.env.NEXT_PUBLIC_BACKEND_ORACLE_ADDRESS as string | undefined)?.trim() ||
  "0x66b2Ed926b810ca5296407d0fE8F1dB73dFe5924";

// All supported stablecoins from contract
// Build a default supported tokens map from config TOKENS for the default chain
const buildSupportedTokens = () => {
  const result: Record<string, any> = {};
  try {
    if (defaultChain && TOKENS && TOKENS[defaultChain.id]) {
      TOKENS[defaultChain.id].forEach((t: any) => {
        const key = (t.symbol || t.symbol || t.address).toString();
        result[key] = {
          address: t.address,
          symbol: t.symbol,
          name: t.name || t.symbol,
          decimals: t.decimals ?? t.decimal ?? 18,
        };
      });
    }
  } catch (e) {
    // ignore and fallback to empty
  }
  return result;
};

export const NEW_SUPPORTED_TOKENS = buildSupportedTokens();


// Oracle fallback rates
// Build a sensible set of oracle fallback rates based on token symbols where available
const ORACLE_FALLBACK_RATES: Record<string, string> = {};
try {
  const base = NEW_SUPPORTED_TOKENS;
  Object.values(base).forEach((t: any) => {
    const addr = (t.address || "").toString();
    const sym = (t.symbol || "").toUpperCase();
    if (sym === "USDC" || sym === "USDT" || sym === "CUSD") {
      ORACLE_FALLBACK_RATES[addr] = "1000000000000000000";
    } else if (sym === "CELO") {
      ORACLE_FALLBACK_RATES[addr] = "300000000000000000";
    } else if (sym === "CKES") {
      ORACLE_FALLBACK_RATES[addr] = "7700000000000000";
    } else if (sym === "CNGN") {
      ORACLE_FALLBACK_RATES[addr] = "654000000000000";
    } else {
      ORACLE_FALLBACK_RATES[addr] = "1000000000000000000";
    }
  });
} catch (e) {
  // fallback to a minimal set if config parsing fails
  ORACLE_FALLBACK_RATES["0xcebA9300f2b948710d2653dD7B07f33A8B32118C"] = "1000000000000000000";
}




  // "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": "1100000000000000000", // cEUR
  // "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": "200000000000000000", // cREAL
  // "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": "1700000000000000", // eXOF
  // "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": "18000000000000000", // PUSO
  // "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": "250000000000000", // cCOP
  // "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": "63000000000000000", // cGHS
  // "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": "1000000000000000000", // USDGLO

class ThirdwebService {
  private contract: any;
  private oracleContract: any;
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY = 150; // Minimum delay between requests in ms

  constructor(chain?: any, minilendAddress?: string) {
    // Default to first chain in config to maintain backwards compatibility
    const defaultChain = chain || (CHAINS && CHAINS.length > 0 ? CHAINS[0] : undefined);
    const defaultAddress = minilendAddress || (CONTRACTS && defaultChain ? CONTRACTS[defaultChain.id] : undefined);

    if (defaultChain && defaultAddress) {
      this.contract = getContract({ client, chain: defaultChain, address: defaultAddress });
    } else {
      this.contract = undefined;
    }

    if (defaultChain && ORACLE_ADDRESS) {
      this.oracleContract = getContract({ client, chain: defaultChain, address: ORACLE_ADDRESS });
    } else {
      this.oracleContract = undefined;
    }
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
      if (!this.contract) {
        return Object.values(NEW_SUPPORTED_TOKENS).map((t) => t.address);
      }
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
      if (!this.contract) {
        return Object.values(NEW_SUPPORTED_TOKENS).map((t) => t.address);
      }
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
      if (!this.contract) return ["86400", "604800", "2592000", "7776000", "31536000"];
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
      if (!this.contract) return "0";
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
      if (!this.contract) return { amount: "0", lockEnd: 0 };
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
      if (!this.contract) return "0";
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
      if (!this.contract) return "0";
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
      if (!this.contract) return 0;
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
      if (!this.contract) return "0";
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
      if (!this.contract) return "0";
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
      if (!this.oracleContract) {
        return {
          rate: ORACLE_FALLBACK_RATES[token] || "1000000000000000000",
          timestamp: Math.floor(Date.now() / 1000).toString(),
        };
      }
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
    const deposits: Array<{ amount: string; lockEnd: number }> = [];
    let index = 0;
    
    try {
      if (!this.contract) return deposits;
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
