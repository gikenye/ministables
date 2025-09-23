// Offramp service for Swypt API integration - Mobile Money Withdrawals
export interface OfframpQuoteRequest {
  amount: string;
  fiatCurrency: string;
  cryptoCurrency: string;
  network: string;
  category?: string;
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
  };
  error?: string;
}

export interface OfframpInitiateRequest {
  chain: string;
  hash: string;
  partyB: string; // Phone number
  tokenAddress: string;
  project?: string;
}

export interface OfframpInitiateResponse {
  success: boolean;
  data?: {
    orderID: string;
  };
  error?: string;
}

export interface OfframpStatusResponse {
  success: boolean;
  data?: {
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
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
    };
  };
  error?: string;
}

// Supported networks for offramp
export const OFFRAMP_SUPPORTED_NETWORKS = [
  'celo',
  'lisk', 
  'base',
  'polygon',
  'scroll'
] as const;

// Supported cryptocurrencies for offramp
export const OFFRAMP_SUPPORTED_CRYPTOS = [
  'USDT',
  'USDC', 
  'cKES',
  'CELO',
  'ETH',
  'MATIC'
] as const;

// Supported fiat currencies for offramp
export const OFFRAMP_SUPPORTED_FIAT = [
  'KES',
  'USD'
] as const;

// Network to token address mapping for common tokens
import { CHAINS, TOKENS } from '@/config/chainConfig';

// Build network token address mapping from central TOKENS config
const NETWORK_TOKEN_ADDRESSES: Record<string, Record<string, string>> = {};
for (const chain of CHAINS) {
  const tokenList = (TOKENS as any)[chain.id] || [];
  NETWORK_TOKEN_ADDRESSES[chain.name.toLowerCase()] = {};
  for (const t of tokenList) {
    NETWORK_TOKEN_ADDRESSES[chain.name.toLowerCase()][(t.symbol || '').toUpperCase()] = t.address;
  }
}

// Phone number validation patterns
export const PHONE_PATTERNS = {
  KES: /^(?:\+254|254|0)?([17]\d{8})$/,
  USD: /^(?:\+1|1)?([2-9]\d{9})$/
} as const;

class OfframpService {
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
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      return result;
    } catch (error: any) {
      console.error("Offramp API error:", error);
      throw new Error(error.message || "Failed to communicate with offramp service");
    }
  }

  // Get quote for offramp transaction
  async getOfframpQuote(request: OfframpQuoteRequest): Promise<OfframpQuoteResponse> {
    try {
      const result = await this.makeRequest<any>("/quote", "POST", request);
      return {
        success: true,
        data: result.data?.data || result.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Initiate offramp transaction (after blockchain withdrawal)
  async initiateOfframp(request: OfframpInitiateRequest): Promise<OfframpInitiateResponse> {
    try {
      const result = await this.makeRequest<any>("/initiate", "POST", request);
      return {
        success: true,
        data: result.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Check offramp transaction status
  async getOfframpStatus(orderID: string): Promise<OfframpStatusResponse> {
    try {
      const result = await this.makeRequest<any>("/status", "POST", { orderID });
      return {
        success: true,
        data: result.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Helper method to validate phone number format
  validatePhoneNumber(phone: string, currency: string = 'KES'): boolean {
    const pattern = PHONE_PATTERNS[currency as keyof typeof PHONE_PATTERNS];
    if (!pattern) return false;
    return pattern.test(phone);
  }

  // Helper method to format phone number for API
  formatPhoneNumber(phone: string, currency: string = 'KES'): string {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, "");
    
    if (currency === 'KES') {
      // Kenya: Convert to 254XXXXXXXXX format
      if (cleaned.startsWith("0")) {
        cleaned = "254" + cleaned.substring(1);
      } else if (!cleaned.startsWith("254")) {
        cleaned = "254" + cleaned;
      }
    }
    
    return cleaned;
  }

  // Helper method to check if crypto is supported for offramp
  isCryptoSupportedForOfframp(crypto: string): boolean {
    return OFFRAMP_SUPPORTED_CRYPTOS.includes(crypto as any);
  }

  // Helper method to check if network is supported for offramp
  isNetworkSupportedForOfframp(network: string): boolean {
    return OFFRAMP_SUPPORTED_NETWORKS.includes(network as any);
  }

  // Helper method to get token address for network and symbol
  getTokenAddress(network: string, symbol: string): string | null {
    const networkTokens = NETWORK_TOKEN_ADDRESSES[network as keyof typeof NETWORK_TOKEN_ADDRESSES];
    if (!networkTokens) return null;
    return networkTokens[symbol as keyof typeof networkTokens] || null;
  }

  // Helper method to get supported tokens for a network
  getSupportedTokensForNetwork(network: string): string[] {
    const networkTokens = NETWORK_TOKEN_ADDRESSES[network as keyof typeof NETWORK_TOKEN_ADDRESSES];
    return networkTokens ? Object.keys(networkTokens) : [];
  }

  // Helper method to detect network from token address
  detectNetworkFromTokenAddress(tokenAddress: string): string | null {
    for (const [network, tokens] of Object.entries(NETWORK_TOKEN_ADDRESSES)) {
      for (const [symbol, address] of Object.entries(tokens)) {
        if (address.toLowerCase() === tokenAddress.toLowerCase()) {
          return network;
        }
      }
    }
    return null;
  }

  // Helper method to detect token symbol from address and network
  detectTokenSymbolFromAddress(tokenAddress: string, network: string): string | null {
    const networkTokens = NETWORK_TOKEN_ADDRESSES[network as keyof typeof NETWORK_TOKEN_ADDRESSES];
    if (!networkTokens) return null;
    
    for (const [symbol, address] of Object.entries(networkTokens)) {
      if (address.toLowerCase() === tokenAddress.toLowerCase()) {
        return symbol;
      }
    }
    return null;
  }

  // Helper method to get minimum withdrawal amounts by currency
  getMinimumWithdrawalAmount(currency: string): number {
    const minimums = {
      KES: 10,
      USD: 1
    };
    return minimums[currency as keyof typeof minimums] || 1;
  }

  // Helper method to get maximum withdrawal amounts by currency
  getMaximumWithdrawalAmount(currency: string): number {
    const maximums = {
      KES: 30000,
      USD: 1000
    };
    return maximums[currency as keyof typeof maximums] || 1000;
  }
}

// Export singleton instance
export const offrampService = new OfframpService();

// Helper function to estimate fees (simplified)
export function estimateOfframpFee(amount: number, currency: string = 'KES'): number {
  // Basic fee structure - in real implementation this would come from the quote
  const feeRates = {
    KES: 0.025, // 2.5%
    USD: 0.03   // 3%
  };
  
  const rate = feeRates[currency as keyof typeof feeRates] || 0.025;
  return Math.max(amount * rate, currency === 'KES' ? 1 : 0.1);
}

// Helper function to format currency amounts
export function formatCurrencyAmount(amount: number, currency: string): string {
  const formatters = {
    KES: new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }),
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
  };
  
  const formatter = formatters[currency as keyof typeof formatters];
  return formatter ? formatter.format(amount) : `${amount} ${currency}`;
}
