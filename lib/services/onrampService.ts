// Onramp service for Pretium API integration
export interface OnrampRequest {
  shortcode: string;
  amount: number;
  fee?: number;
  mobile_network: string;
  chain: string;
  asset: string;
  address: string;
  callback_url?: string;
  type?: string;
  callback_metadata?: {
    auto_deposit?: boolean;
    minilend_contract?: string;
    user_address?: string;
    lock_period?: string;
  };
}

export interface OnrampResponse {
  success: boolean;
  transaction_code?: string;
  message?: string;
  error?: string;
}

export interface ValidationRequest {
  type: "MOBILE" | "PAYBILL" | "BUY_GOODS";
  shortcode: string;
  mobile_network: string;
  account_number?: string;
  currency?: string;
}

export interface ValidationResponse {
  success: boolean;
  name?: string;
  message?: string;
  error?: string;
}

export interface ExchangeRateRequest {
  currency_code: string;
}

export interface ExchangeRateResponse {
  success: boolean;
  rate?: number;
  currency_code?: string;
  error?: string;
}

// Supported mobile networks
export const MOBILE_NETWORKS = [
  "Safaricom",
  "Airtel",
  "MTN",
  "AirtelTigo",
  "Telcel"
] as const;

// Supported countries and their currency codes
export const SUPPORTED_COUNTRIES = {
  KES: { name: "Kenya", flag: "🇰🇪", networks: ["Safaricom"] },
  UGX: { name: "Uganda", flag: "🇺🇬", networks: ["MTN"] },
  CDF: { name: "Congo", flag: "🇨🇩", networks: ["MTN"] },
} as const;

// Import chain configuration
import { CHAINS, TOKENS, getTokens } from "@/config/chainConfig";
import { celo, scroll } from "thirdweb/chains";

// Get supported assets dynamically from chainConfig
const getSupportedAssetsByChain = () => {
  const supportedAssets: Record<string, string[]> = {};
  
  // Add Celo assets
  if (TOKENS[celo.id]) {
    supportedAssets["CELO"] = TOKENS[celo.id].map(token => token.symbol);
    supportedAssets[celo.id.toString()] = TOKENS[celo.id].map(token => token.symbol);
  }
  
  // Add Scroll assets  
  if (TOKENS[scroll.id]) {
    supportedAssets["SCROLL"] = TOKENS[scroll.id].map(token => token.symbol);
    supportedAssets[scroll.id.toString()] = TOKENS[scroll.id].map(token => token.symbol);
  }
  
  return supportedAssets;
};

export const ONRAMP_SUPPORTED_ASSETS = getSupportedAssetsByChain();

// Asset to chain mapping (default chains for each asset)
export const ASSET_CHAIN_MAPPING = {
  USDC: "CELO",
  USDT: "CELO", 
  CUSD: "CELO",
  CKES: "CELO",
  CNGN: "CELO",
  BKES: "SCROLL",
} as const;

// Limits by country
export const COUNTRY_LIMITS = {
  KES: { min: 20, max: 250000 },
  UGX: { min: 500, max: 5000000 },
  CDF: { min: 100, max: 1000000 }, // Estimated limits for Congo
} as const;

class OnrampService {
  private baseUrl: string;

  constructor() {
    // Use our own API routes instead of calling external API directly
    this.baseUrl = "/api/onramp";
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
      console.error("Onramp API error:", error);
      throw new Error(error.message || "Failed to communicate with onramp service");
    }
  }

  // Get exchange rates for a currency
  async getExchangeRate(currencyCode: string): Promise<ExchangeRateResponse> {
    try {
      const result = await this.makeRequest<any>("/exchange-rate", "POST", {
        currency_code: currencyCode,
      });

      // Use quoted_rate from the API response structure
      const rate = result.data?.data?.quoted_rate || result.data?.data?.selling_rate || result.data?.rate;

      return {
        success: true,
        rate: rate,
        currency_code: currencyCode,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Validate mobile number or merchant code
  async validatePaymentMethod(
    request: ValidationRequest,
    currencyCode: string = "KES"
  ): Promise<ValidationResponse> {
    try {
      const result = await this.makeRequest<any>("/validate", "POST", {
        ...request,
        currency: currencyCode !== "KES" ? currencyCode : undefined,
      });

      return {
        success: true,
        name: result.data?.name || result.data?.account_name,
        message: "Validation successful",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Initiate onramp transaction with auto-deposit to Minilend
  async initiateOnramp(
    request: OnrampRequest,
    currencyCode: string = "KES",
    minilendContractAddress?: string,
    userAddress?: string
  ): Promise<OnrampResponse> {
    try {
      // If Minilend contract address is provided, use it as destination for auto-deposit
      const destinationAddress = minilendContractAddress || request.address;
      
      const result = await this.makeRequest<any>("/initiate", "POST", {
        ...request,
        address: destinationAddress,
        currency_code: currencyCode,
        // Add metadata for auto-deposit callback
        ...(minilendContractAddress && userAddress && {
          callback_metadata: {
            auto_deposit: true,
            minilend_contract: minilendContractAddress,
            user_address: userAddress,
            lock_period: "2592000" // 30 days default
          }
        })
      });

      return {
        success: true,
        transaction_code: result.data?.data?.transaction_code || result.data?.transaction_code,
        message: result.data?.data?.message || result.data?.message || "Onramp transaction initiated successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Check transaction status
  async getTransactionStatus(
    transactionCode: string,
    currencyCode: string = "KES"
  ): Promise<any> {
    try {
      const result = await this.makeRequest<any>("/status", "POST", {
        transaction_code: transactionCode,
        currency: currencyCode,
      });

      return result.data || result;
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  // Helper method to determine if an asset is supported for onramp
  isAssetSupportedForOnramp(asset: string, chain: string = "CELO"): boolean {
    // Normalize chain name
    const normalizedChain = chain.toUpperCase();
    
    // Check by chain name first
    let supportedAssets = ONRAMP_SUPPORTED_ASSETS[normalizedChain];
    
    // If not found by name, try by chain ID
    if (!supportedAssets) {
      const chainId = normalizedChain === "CELO" ? celo.id.toString() : 
                     normalizedChain === "SCROLL" ? scroll.id.toString() : 
                     normalizedChain;
      supportedAssets = ONRAMP_SUPPORTED_ASSETS[chainId];
    }
    
    const normalizedAsset = asset.toUpperCase();
    const isSupported = supportedAssets?.includes(normalizedAsset) || false;
    
    return isSupported;
  }

  // Helper method to get the appropriate chain for an asset
  getChainForAsset(asset: string): string {
    return ASSET_CHAIN_MAPPING[asset.toUpperCase() as keyof typeof ASSET_CHAIN_MAPPING] || "CELO";
  }

  // Helper method to get country limits
  getCountryLimits(currencyCode: string) {
    return COUNTRY_LIMITS[currencyCode as keyof typeof COUNTRY_LIMITS] || { min: 1, max: 1000000 };
  }
}

// Export singleton instance
export const onrampService = new OnrampService();

// Helper function to format phone number for API
export function formatPhoneNumber(phone: string, countryCode: string = "KES"): string {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, "");
  
  // Handle different country formats
  switch (countryCode) {
    case "KES":
      // Kenya: Convert to 07XXXXXXXX or 01XXXXXXXX format
      if (cleaned.startsWith("254")) {
        cleaned = "0" + cleaned.substring(3);
      } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
        cleaned = "0" + cleaned;
      }
      break;
    case "UGX":
      // Uganda: Convert to 07XXXXXXXX format
      if (cleaned.startsWith("256")) {
        cleaned = "0" + cleaned.substring(3);
      } else if (cleaned.startsWith("7")) {
        cleaned = "0" + cleaned;
      }
      break;
    case "CDF":
      // Congo: Handle local format
      if (cleaned.startsWith("243")) {
        cleaned = "0" + cleaned.substring(3);
      }
      break;
  }
  
  return cleaned;
}

// Helper function to detect country from phone number
export function detectCountryFromPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.startsWith("254") || (cleaned.startsWith("07") && cleaned.length === 9)) {
    return "KES";
  } else if (cleaned.startsWith("256") || (cleaned.startsWith("07") && cleaned.length === 9)) {
    return "UGX";
  } else if (cleaned.startsWith("243")) {
    return "CDF";
  }
  
  return "KES"; // Default to Kenya
}
