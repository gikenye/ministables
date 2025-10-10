// Offramp service for Pretium API integration - Mobile Money Withdrawals
import { getWebhookBaseUrl } from '@/lib/utils';

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

// Pretium API interfaces
export interface PretiumExchangeRateRequest {
  currency_code: string;
}

export interface PretiumValidationRequest {
  type: 'MOBILE' | 'PAYBILL' | 'BUY_GOODS';
  shortcode: string;
  mobile_network?: string;
  account_number?: string;
  bank_code?: string;
}

export interface PretiumPayRequest {
  transaction_hash: string;
  amount: string;
  fee?: string;
  shortcode: string;
  account_number?: string;
  type?: 'MOBILE' | 'PAYBILL' | 'BUY_GOODS';
  mobile_network?: string;
  account_name?: string;
  bank_name?: string;
  bank_code?: string;
  chain?: string;
  callback_url?: string;
}

export interface PretiumStatusRequest {
  transaction_code: string;
}

// Supported networks for offramp
export const OFFRAMP_SUPPORTED_NETWORKS = [
  'CELO',
  'BASE',
  'STELLAR'
] as const;

// Supported cryptocurrencies for offramp
export const OFFRAMP_SUPPORTED_CRYPTOS = [
  'USDT',
  'USDC', 
  'cUSD'
] as const;

// Supported fiat currencies for offramp
export const OFFRAMP_SUPPORTED_FIAT = [
  'KES',
  'NGN',
  'UGX',
  'CDF',
  'MWK',
  'ETB',
  'GHS'
] as const;

// Mobile networks supported by Pretium
export const MOBILE_NETWORKS = [
  'Safaricom',
  'Airtel',
  'MTN',
  'AirtelTigo',
  'Airtel Money',
  'Orange Money',
  'MPESA',
  'Telcel',
  'Telebirr',
  'Cbe Birr'
] as const;

// Network to token address mapping for Pretium supported tokens
export const NETWORK_TOKEN_ADDRESSES = {
  CELO: {
    cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    USDT: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e'
  },
  BASE: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  },
  STELLAR: {
    USDC: 'USDC'
  }
} as const;

// Phone number validation patterns for Pretium supported countries
export const PHONE_PATTERNS = {
  KES: /^(?:\+254|254|0)?([17]\d{8})$/,
  NGN: /^(?:\+234|234|0)?([789]\d{9})$/,
  UGX: /^(?:\+256|256|0)?(\d{9})$/,
  CDF: /^(?:\+243|243|0)?(\d{9})$/,
  MWK: /^(?:\+265|265|0)?(\d{8,9})$/,
  ETB: /^(?:\+251|251|0)?(\d{9})$/,
  GHS: /^(?:\+233|233|0)?(\d{9})$/
} as const;

class OfframpService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.PRETIUM_BASE_URL || "";
    this.apiKey = process.env.PRETIUM_API_KEY || "";
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
          "x-api-key": this.apiKey,
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

  // Get quote for offramp transaction using Pretium exchange rate
  async getOfframpQuote(request: OfframpQuoteRequest): Promise<OfframpQuoteResponse> {
    try {
      const exchangeRateData: PretiumExchangeRateRequest = {
        currency_code: request.fiatCurrency
      };
      
      const result = await this.makeRequest<any>("/v1/exchange-rate", "POST", exchangeRateData);
      
      const exchangeRate = result.rate || 1;
      const inputAmount = parseFloat(request.amount);
      const outputAmount = inputAmount * exchangeRate;
      const fee = outputAmount * 0.025; // 2.5% fee
      
      return {
        success: true,
        data: {
          inputAmount: request.amount,
          outputAmount: (outputAmount - fee).toString(),
          inputCurrency: request.cryptoCurrency,
          outputCurrency: request.fiatCurrency,
          exchangeRate,
          type: "offramp",
          network: request.network,
          fee: {
            feeInInputCurrency: (fee / exchangeRate).toString(),
            currency: request.fiatCurrency,
            feeInOutputCurrency: fee,
            estimatedOutputKES: request.fiatCurrency === 'KES' ? outputAmount - fee : 0,
            decimals: 2
          },
          limits: {
            min: this.getMinimumWithdrawalAmount(request.fiatCurrency),
            max: this.getMaximumWithdrawalAmount(request.fiatCurrency),
            currency: request.fiatCurrency
          }
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Initiate offramp transaction using Pretium pay API
  async initiateOfframp(request: OfframpInitiateRequest): Promise<OfframpInitiateResponse> {
    try {
      const payData: PretiumPayRequest = {
        transaction_hash: request.hash,
        shortcode: request.partyB,
        amount: "0", // Will be calculated from blockchain transaction
        type: "MOBILE",
        mobile_network: this.detectMobileNetwork(request.partyB),
        chain: request.chain.toUpperCase(),
        callback_url: `${getWebhookBaseUrl()}/api/pretium/callback`
      };
      
      const endpoint = request.chain === 'celo' ? '/v1/pay' : `/v1/pay/${this.getCurrencyFromChain(request.chain)}`;
      const result = await this.makeRequest<any>(endpoint, "POST", payData);
      
      return {
        success: true,
        data: {
          orderID: result.transaction_code || result.id
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Check offramp transaction status using Pretium status API
  async getOfframpStatus(orderID: string): Promise<OfframpStatusResponse> {
    try {
      const statusData: PretiumStatusRequest = {
        transaction_code: orderID
      };
      
      const result = await this.makeRequest<any>("/v1/status", "POST", statusData);
      
      return {
        success: true,
        data: {
          status: this.mapPretiumStatus(result.status),
          message: result.message || 'Transaction processed',
          details: {
            phoneNumber: result.phone_number || '',
            ReceiverPartyPublicName: result.receiver_name,
            transactionSize: result.amount || '0',
            transactionSide: 'offramp',
            initiatedAt: result.created_at || new Date().toISOString(),
            mpesaReceipt: result.receipt_number,
            completedAt: result.completed_at,
            failureReason: result.failure_reason,
            resultCode: result.result_code
          }
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Helper method to map Pretium status to our status format
  private mapPretiumStatus(status: string): 'PENDING' | 'SUCCESS' | 'FAILED' {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'SUCCESS';
      case 'failed':
      case 'error':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }

  // Helper method to get currency code from chain
  private getCurrencyFromChain(chain: string): string {
    const chainCurrencyMap: { [key: string]: string } = {
      'celo': 'KES',
      'base': 'USD',
      'stellar': 'USD'
    };
    return chainCurrencyMap[chain.toLowerCase()] || 'KES';
  }romChain(chain: string): string {
    const chainCurrencyMap: { [key: string]: string } = {
      'celo': 'KES',
      'base': 'USD',
      'stellar': 'USD'
    };
    return chainCurrencyMap[chain.toLowerCase()] || 'KES';
  }

  // Validate mobile number using Pretium validation API
  async validateMobileNumber(phone: string, mobileNetwork: string, currency: string = 'KES'): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const validationData: PretiumValidationRequest = {
        type: 'MOBILE',
        shortcode: phone,
        mobile_network: mobileNetwork
      };
      
      const endpoint = currency === 'KES' ? '/v1/validation' : `/v1/validation/${currency}`;
      const result = await this.makeRequest<any>(endpoint, "POST", validationData);
      
      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Detect mobile network from phone number
  detectMobileNetwork(phone: string, currency: string = 'KES'): string {
    const cleaned = phone.replace(/\D/g, '');
    
    if (currency === 'KES') {
      if (cleaned.startsWith('254701') || cleaned.startsWith('254702') || cleaned.startsWith('254703') || 
          cleaned.startsWith('254704') || cleaned.startsWith('254705') || cleaned.startsWith('254706') ||
          cleaned.startsWith('254707') || cleaned.startsWith('254708') || cleaned.startsWith('254709') ||
          cleaned.startsWith('254710') || cleaned.startsWith('254711') || cleaned.startsWith('254712') ||
          cleaned.startsWith('254713') || cleaned.startsWith('254714') || cleaned.startsWith('254715') ||
          cleaned.startsWith('254716') || cleaned.startsWith('254717') || cleaned.startsWith('254718') ||
          cleaned.startsWith('254719') || cleaned.startsWith('254720') || cleaned.startsWith('254721') ||
          cleaned.startsWith('254722') || cleaned.startsWith('254723') || cleaned.startsWith('254724') ||
          cleaned.startsWith('254725') || cleaned.startsWith('254726') || cleaned.startsWith('254727') ||
          cleaned.startsWith('254728') || cleaned.startsWith('254729')) {
        return 'Safaricom';
      }
      if (cleaned.startsWith('254730') || cleaned.startsWith('254731') || cleaned.startsWith('254732') ||
          cleaned.startsWith('254733') || cleaned.startsWith('254734') || cleaned.startsWith('254735') ||
          cleaned.startsWith('254736') || cleaned.startsWith('254737') || cleaned.startsWith('254738') ||
          cleaned.startsWith('254739')) {
        return 'Airtel';
      }
    }
    
    return 'Safaricom'; // Default
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

  // Helper method to get minimum withdrawal amounts by currency (Pretium limits)
  getMinimumWithdrawalAmount(currency: string): number {
    const minimums = {
      KES: 20,
      NGN: 100,
      MWK: 100,
      UGX: 500,
      GHS: 5,
      CDF: 100,
      ETB: 100
    };
    return minimums[currency as keyof typeof minimums] || 20;
  }

  // Helper method to get maximum withdrawal amounts by currency (Pretium limits)
  getMaximumWithdrawalAmount(currency: string): number {
    const maximums = {
      KES: 250000,
      NGN: 2000000,
      MWK: 5000000,
      UGX: 5000000,
      GHS: 1000,
      CDF: 5000000,
      ETB: 5000000
    };
    return maximums[currency as keyof typeof maximums] || 250000;
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
