// Hardcoded exchange rates (USD per token)
const HARDCODED_USD_RATES: Record<string, number> = {
  "0x471EcE3750Da237f93B8E339c536989b8978a438": 0.3, // CELO
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": 1.0, // cUSD
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": 1.1, // cEUR
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": 0.2, // cREAL
  "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": 0.00167, // eXOF
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": 0.0077, // cKES
  "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": 0.0172, // PUSO
  "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": 0.00025, // cCOP
  "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": 0.000667, // cGHS
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": 1.0, // USDT
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": 1.0, // USDC
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": 1.0, // USDGLO
  "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71": 0.000458, // cNGN
};

export interface OracleRate {
  rate: bigint;
  timestamp: bigint;
}

class OracleService {
  // Always return true for validation since we use hardcoded rates
  async validatePriceData(tokenAddress: string): Promise<boolean> {
    return HARDCODED_USD_RATES[tokenAddress] !== undefined;
  }

  async validateMultipleTokens(tokenAddresses: string[]): Promise<boolean> {
    return tokenAddresses.every(
      (token) => HARDCODED_USD_RATES[token] !== undefined
    );
  }

  // Get USD price for a token
  getTokenUSDPrice(tokenAddress: string): number {
    return HARDCODED_USD_RATES[tokenAddress] || 0;
  }

  // Convert token amount to USD value
  convertToUSD(tokenAddress: string, amount: string, decimals: number): number {
    const usdPrice = this.getTokenUSDPrice(tokenAddress);
    const tokenAmount = Number(amount) / Math.pow(10, decimals);
    return tokenAmount * usdPrice;
  }

  // Get all supported tokens with their USD rates
  getAllRates(): Record<string, number> {
    return { ...HARDCODED_USD_RATES };
  }

  // Legacy methods for compatibility
  async getMedianRate(tokenAddress: string): Promise<OracleRate> {
    const usdPrice = HARDCODED_USD_RATES[tokenAddress];
    if (!usdPrice) {
      throw new Error(`No price feed for token ${tokenAddress}`);
    }

    return {
      rate: BigInt(Math.floor(usdPrice * 1e18)), // Convert to wei
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
    };
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    return this.getTokenUSDPrice(tokenAddress);
  }
}

export const oracleService = new OracleService();
