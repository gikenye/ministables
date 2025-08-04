// Enhanced Offramp service for Swypt API integration - Optimized for DAP's lending protocol
import { ALL_SUPPORTED_TOKENS } from "./thirdwebService";

export interface OfframpQuoteRequest {
  amount: string;
  fiatCurrency: string;
  cryptoCurrency: string;
  network: string;
  category?: string;
  tokenAddress?: string; // Added for better token identification
  userAddress?: string; // Added for user-specific quotes
}

export interface OfframpQuoteResponse {
  success: boolean;
  data?: {
    inputAmount: string;
    outputAmount: string;
    inputCurrency: string;
    outputCurrency: string;
    exchangeRate: number;
    type: string;
    network: string;
    fee: {
      feeInInputCurrency: string;
      currency: string;
      feeInOutputCurrency: number;
      estimatedOutputKES: number;
      decimals: number;
    };
    limits: {
      min: number;
      max: number;
      currency: string;
    };
    // Enhanced fields for DAP integration
    tokenInfo?: {
      symbol: string;
      decimals: number;
      address: string;
      category: string;
    };
    estimatedGasFee?: string;
    processingTime?: string;
    slippageTolerance?: number;
  };
  error?: string;
}

export interface OfframpInitiateRequest {
  chain: string;
  hash: string;
  partyB: string; // Phone number
  tokenAddress: string;
  project?: string;
  // Enhanced fields for DAP integration
  userAddress?: string;
  loanPaymentAmount?: string; // If this is part of loan repayment
  excessWithdrawalAmount?: string; // If withdrawing excess after loan payment
  transactionType?: "withdrawal" | "loan_repayment" | "excess_withdrawal";
}

export interface OfframpInitiateResponse {
  success: boolean;
  data?: {
    orderID: string;
    estimatedCompletionTime?: string;
    transactionBreakdown?: {
      loanPayment?: string;
      excessWithdrawal?: string;
      totalProcessed?: string;
    };
  };
  error?: string;
}

export interface OfframpStatusResponse {
  success: boolean;
  data?: {
    status: "PENDING" | "SUCCESS" | "FAILED" | "PROCESSING" | "CONFIRMED";
    message: string;
    details: {
      phoneNumber: string;
      ReceiverPartyPublicName?: string;
      transactionSize: string;
      transactionSide: string;
      initiatedAt: string;
      mpesaReceipt?: string;
      completedAt?: string;
      failureReason?: string;
      resultCode?: string;
      // Enhanced fields
      transactionType?: string;
      loanPaymentProcessed?: boolean;
      excessWithdrawalProcessed?: boolean;
    };
  };
  error?: string;
}

// Enhanced supported networks with chain IDs
export const ENHANCED_OFFRAMP_NETWORKS = {
  celo: {
    name: "Celo",
    chainId: 42220,
    rpcUrl: "https://forno.celo.org",
    blockExplorer: "https://celoscan.io",
    nativeCurrency: "CELO",
  },
  lisk: {
    name: "Lisk",
    chainId: 1135,
    rpcUrl: "https://rpc.api.lisk.com",
    blockExplorer: "https://blockscout.lisk.com",
    nativeCurrency: "ETH",
  },
  base: {
    name: "Base",
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    nativeCurrency: "ETH",
  },
  polygon: {
    name: "Polygon",
    chainId: 137,
    rpcUrl: "https://polygon-rpc.com",
    blockExplorer: "https://polygonscan.com",
    nativeCurrency: "MATIC",
  },
  scroll: {
    name: "Scroll",
    chainId: 534352,
    rpcUrl: "https://rpc.scroll.io",
    blockExplorer: "https://scrollscan.com",
    nativeCurrency: "ETH",
  },
} as const;

// Enhanced crypto support with DAP token integration
export const ENHANCED_OFFRAMP_CRYPTOS = {
  // International stablecoins
  USDT: {
    networks: ["celo", "lisk", "polygon", "scroll"],
    category: "international",
    priority: 1,
  },
  USDC: {
    networks: ["celo", "base", "polygon"],
    category: "international",
    priority: 1,
  },
  USDGLO: {
    networks: ["celo"],
    category: "international",
    priority: 2,
  },

  // Celo native stablecoins
  cUSD: {
    networks: ["celo"],
    category: "stablecoin",
    priority: 1,
  },
  cEUR: {
    networks: ["celo"],
    category: "stablecoin",
    priority: 2,
  },
  cREAL: {
    networks: ["celo"],
    category: "stablecoin",
    priority: 2,
  },

  // Regional stablecoins
  cKES: {
    networks: ["celo"],
    category: "regional",
    priority: 1,
    preferredFiat: "KES",
  },
  eXOF: {
    networks: ["celo"],
    category: "regional",
    priority: 2,
    preferredFiat: "XOF",
  },
  PUSO: {
    networks: ["celo"],
    category: "regional",
    priority: 2,
    preferredFiat: "PHP",
  },
  cCOP: {
    networks: ["celo"],
    category: "regional",
    priority: 2,
    preferredFiat: "COP",
  },
  cGHS: {
    networks: ["celo"],
    category: "regional",
    priority: 2,
    preferredFiat: "GHS",
  },

  // Native tokens
  CELO: {
    networks: ["celo"],
    category: "native",
    priority: 3,
  },
  ETH: {
    networks: ["lisk", "base", "scroll"],
    category: "native",
    priority: 3,
  },
  MATIC: {
    networks: ["polygon"],
    category: "native",
    priority: 3,
  },
} as const;

// Enhanced fiat support with regional preferences
export const ENHANCED_OFFRAMP_FIAT = {
  KES: {
    name: "Kenyan Shilling",
    symbol: "KSh",
    flag: "🇰🇪",
    preferredCryptos: ["cKES", "USDT", "USDC", "cUSD"],
    limits: { min: 10, max: 300000 },
    processingTime: "1-5 minutes",
  },
  USD: {
    name: "US Dollar",
    symbol: "$",
    flag: "🇺🇸",
    preferredCryptos: ["USDT", "USDC", "cUSD"],
    limits: { min: 1, max: 10000 },
    processingTime: "5-15 minutes",
  },
} as const;

// Enhanced network token mapping with DAP integration
export const ENHANCED_NETWORK_TOKEN_ADDRESSES = {
  celo: {
    // From DAP contract
    ...Object.fromEntries(
      Object.entries(ALL_SUPPORTED_TOKENS).map(([key, token]) => [
        token.symbol,
        token.address,
      ])
    ),
  },
  lisk: {
    USDT: "0x05D032ac25d322df992303dCa074EE7392C117b9",
    ETH: "0x0000000000000000000000000000000000000000",
  },
  base: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    ETH: "0x0000000000000000000000000000000000000000",
  },
  polygon: {
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    MATIC: "0x0000000000000000000000000000000000000000",
  },
  scroll: {
    USDT: "0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df",
    ETH: "0x0000000000000000000000000000000000000000",
  },
} as const;

// Phone number validation with enhanced regional support
export const ENHANCED_PHONE_PATTERNS = {
  KES: {
    pattern: /^(?:\+254|254|0)?([17]\d{8})$/,
    format: (phone: string) => {
      const cleaned = phone.replace(/\D/g, "");
      if (cleaned.startsWith("0")) return "254" + cleaned.substring(1);
      if (!cleaned.startsWith("254")) return "254" + cleaned;
      return cleaned;
    },
    networks: ["Safaricom", "Airtel"],
  },
  USD: {
    pattern: /^(?:\+1|1)?([2-9]\d{9})$/,
    format: (phone: string) => {
      const cleaned = phone.replace(/\D/g, "");
      if (!cleaned.startsWith("1")) return "1" + cleaned;
      return cleaned;
    },
    networks: ["Various"],
  },
} as const;

class EnhancedOfframpService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = "/api/offramp";
  }

  private async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" = "POST",
    data?: any
  ): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || `HTTP error! status: ${response.status}`
        );
      }

      return result;
    } catch (error: any) {
      console.error("Enhanced Offramp API error:", error);
      throw new Error(
        error.message || "Failed to communicate with offramp service"
      );
    }
  }

  // Enhanced quote method with DAP integration
  async getOfframpQuote(
    request: OfframpQuoteRequest
  ): Promise<OfframpQuoteResponse> {
    try {
      // Enhance request with token information
      const tokenInfo = this.getTokenInfoFromAddress(
        request.tokenAddress || ""
      );
      const enhancedRequest = {
        ...request,
        tokenAddress:
          request.tokenAddress ||
          this.getTokenAddress(request.network, request.cryptoCurrency),
      };

      const result = await this.makeRequest<any>(
        "/quote",
        "POST",
        enhancedRequest
      );

      return {
        success: true,
        data: {
          ...(result.data?.data || result.data),
          tokenInfo,
          estimatedGasFee: this.estimateGasFee(request.network),
          processingTime: this.getProcessingTime(request.fiatCurrency),
          slippageTolerance: 0.5, // 0.5% default slippage
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Enhanced initiate method with transaction type support
  async initiateOfframp(
    request: OfframpInitiateRequest
  ): Promise<OfframpInitiateResponse> {
    try {
      // Add transaction breakdown for loan payments
      const enhancedRequest = {
        ...request,
        project: request.project || "ministables-dap",
      };

      const result = await this.makeRequest<any>(
        "/initiate",
        "POST",
        enhancedRequest
      );

      return {
        success: true,
        data: {
          ...result.data,
          estimatedCompletionTime: this.getEstimatedCompletionTime(
            request.chain
          ),
          transactionBreakdown: this.calculateTransactionBreakdown(request),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Enhanced status check with detailed tracking
  async getOfframpStatus(orderID: string): Promise<OfframpStatusResponse> {
    try {
      const result = await this.makeRequest<any>("/status", "POST", {
        orderID,
      });

      return {
        success: true,
        data: {
          ...result.data,
          // Add enhanced status tracking
          loanPaymentProcessed: result.data?.transactionType?.includes("loan"),
          excessWithdrawalProcessed:
            result.data?.transactionType?.includes("excess"),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Enhanced phone validation with regional support
  validatePhoneNumber(phone: string, currency: string = "KES"): boolean {
    const config =
      ENHANCED_PHONE_PATTERNS[currency as keyof typeof ENHANCED_PHONE_PATTERNS];
    if (!config) return false;
    return config.pattern.test(phone);
  }

  // Enhanced phone formatting
  formatPhoneNumber(phone: string, currency: string = "KES"): string {
    const config =
      ENHANCED_PHONE_PATTERNS[currency as keyof typeof ENHANCED_PHONE_PATTERNS];
    if (!config) return phone;
    return config.format(phone);
  }

  // Enhanced crypto support check with DAP tokens
  isCryptoSupportedForOfframp(
    crypto: string,
    network: string = "celo"
  ): boolean {
    const cryptoConfig =
      ENHANCED_OFFRAMP_CRYPTOS[crypto as keyof typeof ENHANCED_OFFRAMP_CRYPTOS];
    if (!cryptoConfig) return false;
    if (Array.isArray(cryptoConfig.networks)) {
      return cryptoConfig.networks.includes(network);
    }
    return false;
  }

  // Enhanced network support check
  isNetworkSupportedForOfframp(network: string): boolean {
    return network in ENHANCED_OFFRAMP_NETWORKS;
  }

  // Enhanced token address resolution with DAP integration
  getTokenAddress(network: string, symbol: string): string | null {
    const networkTokens =
      ENHANCED_NETWORK_TOKEN_ADDRESSES[
        network as keyof typeof ENHANCED_NETWORK_TOKEN_ADDRESSES
      ];
    if (!networkTokens) return null;
    return networkTokens[symbol as keyof typeof networkTokens] || null;
  }

  // Get token info from address using DAP contract data
  getTokenInfoFromAddress(tokenAddress: string): any {
    const token = Object.values(ALL_SUPPORTED_TOKENS).find(
      (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
    );
    return token
      ? {
          symbol: token.symbol,
          decimals: token.decimals,
          address: token.address,
          category: token.category,
        }
      : null;
  }

  // Enhanced network detection with DAP token support
  detectNetworkFromTokenAddress(tokenAddress: string): string | null {
    // First check DAP tokens (all on Celo)
    const dapToken = Object.values(ALL_SUPPORTED_TOKENS).find(
      (token) => token.address.toLowerCase() === tokenAddress.toLowerCase()
    );
    if (dapToken) return "celo";

    // Check other networks
    for (const [network, tokens] of Object.entries(
      ENHANCED_NETWORK_TOKEN_ADDRESSES
    )) {
      for (const [symbol, address] of Object.entries(tokens)) {
        if (address.toLowerCase() === tokenAddress.toLowerCase()) {
          return network;
        }
      }
    }
    return null;
  }

  // Enhanced token symbol detection
  detectTokenSymbolFromAddress(
    tokenAddress: string,
    network: string
  ): string | null {
    // First check DAP tokens
    const dapToken = Object.values(ALL_SUPPORTED_TOKENS).find(
      (token) => token.address.toLowerCase() === tokenAddress.toLowerCase()
    );
    if (dapToken) return dapToken.symbol;

    // Check network-specific tokens
    const networkTokens =
      ENHANCED_NETWORK_TOKEN_ADDRESSES[
        network as keyof typeof ENHANCED_NETWORK_TOKEN_ADDRESSES
      ];
    if (!networkTokens) return null;

    for (const [symbol, address] of Object.entries(networkTokens)) {
      if (address.toLowerCase() === tokenAddress.toLowerCase()) {
        return symbol;
      }
    }
    return null;
  }

  // Get supported tokens for network with priorities
getSupportedTokensForNetwork(
  network: string
): Array<{ symbol: string; priority: number; category: string }> {
  const tokens = [];
  for (const [symbol, config] of Object.entries(ENHANCED_OFFRAMP_CRYPTOS)) {
    if ((config.networks as any).includes(network)) {
      tokens.push({
        symbol,
        priority: config.priority,
        category: config.category,
      });
    }
  }
  return tokens.sort((a, b) => a.priority - b.priority);
}

  // Enhanced limits with currency-specific rules
  getWithdrawalLimits(currency: string): { min: number; max: number } {
    const fiatConfig =
      ENHANCED_OFFRAMP_FIAT[currency as keyof typeof ENHANCED_OFFRAMP_FIAT];
    return fiatConfig ? fiatConfig.limits : { min: 1, max: 10000 };
  }

  // Get preferred cryptocurrencies for a fiat currency
  getPreferredCryptosForFiat(currency: string): string[] {
    const fiatConfig =
      ENHANCED_OFFRAMP_FIAT[currency as keyof typeof ENHANCED_OFFRAMP_FIAT];
    return fiatConfig
      ? [...fiatConfig.preferredCryptos]
      : ["USDT", "USDC", "cUSD"];
  }

  // Get processing time estimate
  getProcessingTime(currency: string): string {
    const fiatConfig =
      ENHANCED_OFFRAMP_FIAT[currency as keyof typeof ENHANCED_OFFRAMP_FIAT];
    return fiatConfig ? fiatConfig.processingTime : "5-15 minutes";
  }

  // Estimate gas fee for network
  estimateGasFee(network: string): string {
    const gasEstimates = {
      celo: "0.001",
      lisk: "0.0001",
      base: "0.0005",
      polygon: "0.01",
      scroll: "0.0003",
    };
    return gasEstimates[network as keyof typeof gasEstimates] || "0.001";
  }

  // Get estimated completion time
  getEstimatedCompletionTime(chain: string): string {
    const completionTimes = {
      celo: "2-8 minutes",
      lisk: "1-5 minutes",
      base: "1-5 minutes",
      polygon: "2-10 minutes",
      scroll: "3-12 minutes",
    };
    return (
      completionTimes[chain as keyof typeof completionTimes] || "5-15 minutes"
    );
  }

  // Calculate transaction breakdown for complex transactions
  calculateTransactionBreakdown(request: OfframpInitiateRequest): any {
    if (!request.loanPaymentAmount && !request.excessWithdrawalAmount) {
      return undefined;
    }

    return {
      loanPayment: request.loanPaymentAmount || "0",
      excessWithdrawal: request.excessWithdrawalAmount || "0",
      totalProcessed: (
        parseFloat(request.loanPaymentAmount || "0") +
        parseFloat(request.excessWithdrawalAmount || "0")
      ).toString(),
    };
  }

  // Enhanced method to get optimal withdrawal path for DAP users
  getOptimalWithdrawalPath(
    tokenSymbol: string,
    amount: string,
    targetFiat: string = "KES"
  ): {
    recommended: boolean;
    reason: string;
    alternativeTokens?: string[];
    estimatedSavings?: string;
  } {
    const cryptoConfig =
      ENHANCED_OFFRAMP_CRYPTOS[
        tokenSymbol as keyof typeof ENHANCED_OFFRAMP_CRYPTOS
      ];
    const fiatConfig =
      ENHANCED_OFFRAMP_FIAT[targetFiat as keyof typeof ENHANCED_OFFRAMP_FIAT];

    if (!cryptoConfig || !fiatConfig) {
      return {
        recommended: false,
        reason: "Token or fiat currency not supported",
      };
    }

    // Check if this is an optimal pairing
    const isPreferred = fiatConfig.preferredCryptos.includes(
      tokenSymbol as "USDC" | "USDT" | "cUSD"
    );
    const hasDirectPairing =
      "preferredFiat" in cryptoConfig
        ? cryptoConfig.preferredFiat === targetFiat
        : false;

    if (isPreferred || hasDirectPairing) {
      return {
        recommended: true,
        reason: hasDirectPairing
          ? `${tokenSymbol} has direct pairing with ${targetFiat} for optimal rates`
          : `${tokenSymbol} is a preferred token for ${targetFiat} withdrawals`,
      };
    }

    // Suggest alternatives
    const alternatives = fiatConfig.preferredCryptos.filter(
      (crypto) =>
        crypto !== tokenSymbol &&
        ENHANCED_OFFRAMP_CRYPTOS[
          crypto as keyof typeof ENHANCED_OFFRAMP_CRYPTOS
        ]
    );

    return {
      recommended: false,
      reason: `${tokenSymbol} is supported but not optimal for ${targetFiat}`,
      alternativeTokens: alternatives,
      estimatedSavings: "0.5-2%", // Estimated savings from using preferred tokens
    };
  }

  // Method to validate withdrawal against DAP lending constraints
  validateWithdrawalConstraints(
    tokenAddress: string,
    amount: string,
    userDeposits: string,
    userBorrows: string,
    isLocked: boolean
  ): {
    valid: boolean;
    reason?: string;
    maxWithdrawable?: string;
    suggestions?: string[];
  } {
    const amountNum = parseFloat(amount);
    const depositsNum = parseFloat(userDeposits);
    const borrowsNum = parseFloat(userBorrows);

    // Check if deposits are locked
    if (isLocked) {
      return {
        valid: false,
        reason:
          "Your deposits are still locked. Please wait until the lock period ends.",
        suggestions: [
          "Wait for lock period to end",
          "Consider borrowing against collateral instead",
        ],
      };
    }

    // Check if user has outstanding loans
    if (borrowsNum > 0) {
      return {
        valid: false,
        reason:
          "You have outstanding loans. Please repay your loans before withdrawing.",
        suggestions: [
          "Repay loans first",
          'Use the "Pay & Withdraw" option to handle both in one transaction',
        ],
      };
    }

    // Check if withdrawal amount exceeds deposits
    if (amountNum > depositsNum) {
      return {
        valid: false,
        reason: "Withdrawal amount exceeds your available balance.",
        maxWithdrawable: userDeposits,
        suggestions: [
          "Reduce withdrawal amount",
          "Check your available balance",
        ],
      };
    }

    return { valid: true };
  }

  // Method to calculate optimal loan repayment + withdrawal flow
  calculateLoanRepaymentFlow(
    loanAmount: string,
    availableBalance: string,
    withdrawalAmount: string,
    tokenDecimals: number = 18
  ): {
    canRepayAndWithdraw: boolean;
    loanPayment: string;
    excessWithdrawal: string;
    totalRequired: string;
    shortfall?: string;
  } {
    const loanNum = parseFloat(loanAmount);
    const balanceNum = parseFloat(availableBalance);
    const withdrawNum = parseFloat(withdrawalAmount);
    const totalRequired = loanNum + withdrawNum;

    if (balanceNum >= totalRequired) {
      return {
        canRepayAndWithdraw: true,
        loanPayment: loanAmount,
        excessWithdrawal: withdrawalAmount,
        totalRequired: totalRequired.toString(),
      };
    } else if (balanceNum >= loanNum) {
      // Can repay loan but not full withdrawal
      const maxWithdrawal = balanceNum - loanNum;
      return {
        canRepayAndWithdraw: true,
        loanPayment: loanAmount,
        excessWithdrawal: maxWithdrawal.toString(),
        totalRequired: balanceNum.toString(),
      };
    } else {
      // Cannot even repay full loan
      return {
        canRepayAndWithdraw: false,
        loanPayment: availableBalance,
        excessWithdrawal: "0",
        totalRequired: totalRequired.toString(),
        shortfall: (totalRequired - balanceNum).toString(),
      };
    }
  }
}

// Export enhanced singleton instance
export const enhancedOfframpService = new EnhancedOfframpService();

// Enhanced helper functions
export function estimateEnhancedOfframpFee(
  amount: number,
  currency: string = "KES",
  tokenCategory: string = "stablecoin"
): number {
  // Enhanced fee structure based on token category and currency
  const baseFeeRates = {
    KES: 0.025, // 2.5%
    USD: 0.03, // 3%
  };

  // Category-based fee adjustments
  const categoryMultipliers = {
    regional: 0.8, // 20% discount for regional tokens
    stablecoin: 0.9, // 10% discount for stablecoins
    international: 1.0, // Standard rate
    native: 1.2, // 20% premium for native tokens
  };

  const baseRate = baseFeeRates[currency as keyof typeof baseFeeRates] || 0.025;
  const multiplier =
    categoryMultipliers[tokenCategory as keyof typeof categoryMultipliers] ||
    1.0;
  const adjustedRate = baseRate * multiplier;

  const minFee = currency === "KES" ? 1 : 0.1;
  return Math.max(amount * adjustedRate, minFee);
}

// Enhanced currency formatting with regional support
export function formatEnhancedCurrencyAmount(
  amount: number,
  currency: string
): string {
  const fiatConfig =
    ENHANCED_OFFRAMP_FIAT[currency as keyof typeof ENHANCED_OFFRAMP_FIAT];

  if (fiatConfig) {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: currency === "KES" ? 0 : 2,
      maximumFractionDigits: currency === "KES" ? 0 : 2,
    });

    try {
      return formatter.format(amount);
    } catch {
      return `${fiatConfig.symbol}${amount.toLocaleString()}`;
    }
  }

  return `${amount} ${currency}`;
}

// Helper to get token category from symbol
export function getTokenCategory(tokenSymbol: string): string {
  const cryptoConfig =
    ENHANCED_OFFRAMP_CRYPTOS[
      tokenSymbol as keyof typeof ENHANCED_OFFRAMP_CRYPTOS
    ];
  return cryptoConfig?.category || "unknown";
}

// Helper to check if token has preferred fiat pairing
export function hasPreferredFiatPairing(
  tokenSymbol: string,
  fiatCurrency: string
): boolean {
  const cryptoConfig =
    ENHANCED_OFFRAMP_CRYPTOS[
      tokenSymbol as keyof typeof ENHANCED_OFFRAMP_CRYPTOS
    ];
  return cryptoConfig && 'preferredFiat' in cryptoConfig ?
    cryptoConfig.preferredFiat === fiatCurrency : false;
}
