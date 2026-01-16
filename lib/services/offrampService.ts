// Offramp service for Pretium API integration - Mobile Money Withdrawals

export interface OfframpQuoteRequest {
  amount: string; // crypto amount input by user
  fiatCurrency: string;
  cryptoCurrency: string;
  network: string;
}

export interface OfframpQuoteResponse {
  success: boolean;
  data?: {
    inputAmount: string; // crypto amount
    outputAmount: string; // fiat output after fees
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
  transactionHash: string; // settlement transfer hash
  shortcode: string; // formatted phone number
  amount: string; // fiat amount to pay out
  type?: "MOBILE" | "PAYBILL" | "BUY_GOODS";
  mobileNetwork?: string;
  callbackUrl?: string;
}

export interface OfframpInitiateResponse {
  success: boolean;
  data?: { orderID: string };
  error?: string;
}

export interface OfframpStatusResponse {
  success: boolean;
  data?: {
    status: "PENDING" | "SUCCESS" | "FAILED";
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

export interface PretiumExchangeRateRequest {
  currency_code: string;
}

export interface PretiumStatusRequest {
  transaction_code: string;
}

export interface PretiumPayRequest {
  transaction_hash: string;
  amount: string;
  fee?: string;
  shortcode: string; // phone
  type?: "MOBILE" | "PAYBILL" | "BUY_GOODS";
  mobile_network?: string;
  chain?: string;
  callback_url?: string;
}

export const PHONE_PATTERNS = {
  KES: /^(?:\+254|254|0)?([17]\d{8})$/,
  NGN: /^(?:\+234|234|0)?([789]\d{9})$/,
  UGX: /^(?:\+256|256|0)?(\d{9})$/,
  CDF: /^(?:\+243|243|0)?(\d{9})$/,
  MWK: /^(?:\+265|265|0)?(\d{8,9})$/,
  ETB: /^(?:\+251|251|0)?(\d{9})$/,
  GHS: /^(?:\+233|233|0)?(\d{9})$/,
} as const;

class OfframpService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = "/api";
  }

  private async makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" = "POST",
    data?: any
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Pretium sometimes returns { message } or { error }
      const msg = json?.error || json?.message || `HTTP error! status: ${res.status}`;
      throw new Error(msg);
    }

    return json as T;
  }

  // --- Constraints (used by UI) ---
  // Keep signature your component expects.
  validateWithdrawalConstraints(
    tokenAddress: string,
    amount: string,
    userDeposits: string,
    userBorrows: string,
    allowBorrow: boolean
  ): { ok: boolean; error?: string } {
    const amt = Number(amount);
    if (!amt || amt <= 0) return { ok: false, error: "Enter a valid amount" };

    // Simple available = deposits - borrows unless allowBorrow
    const deposits = Number(userDeposits || "0");
    const borrows = Number(userBorrows || "0");
    const available = allowBorrow ? deposits : Math.max(deposits - borrows, 0);

    if (amt > available) {
      return { ok: false, error: "Insufficient available balance" };
    }

    return { ok: true };
  }

  // --- Quote ---
  async getOfframpQuote(request: OfframpQuoteRequest): Promise<OfframpQuoteResponse> {
    try {
      const rateReq: PretiumExchangeRateRequest = {
        currency_code: request.fiatCurrency,
      };
      const rateRes = await this.makeRequest<any>(
        "/onramp/exchange-rate",
        "POST",
        rateReq
      );

      const exchangeRate = Number(
        rateRes?.data?.data?.quoted_rate ||
          rateRes?.data?.data?.selling_rate ||
          rateRes?.data?.rate ||
          rateRes?.rate ||
          1
      );
      const inputAmount = Number(request.amount);
      const grossOut = inputAmount * exchangeRate;

      // Simplified fee model (keep as you had)
      const feeOut = grossOut * 0.025;
      const netOut = Math.max(grossOut - feeOut, 0);

      return {
        success: true,
        data: {
          inputAmount: request.amount,
          outputAmount: netOut.toString(),
          inputCurrency: request.cryptoCurrency,
          outputCurrency: request.fiatCurrency,
          exchangeRate,
          type: "offramp",
          network: request.network,
          fee: {
            feeInInputCurrency: (feeOut / exchangeRate).toString(),
            currency: request.fiatCurrency,
            feeInOutputCurrency: feeOut,
            estimatedOutputKES: request.fiatCurrency === "KES" ? netOut : 0,
            decimals: 2,
          },
          limits: {
            min: this.getMinimumWithdrawalAmount(request.fiatCurrency),
            max: this.getMaximumWithdrawalAmount(request.fiatCurrency),
            currency: request.fiatCurrency,
          },
        },
      };
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to fetch quote" };
    }
  }

  // --- Initiate Offramp ---
  async initiateOfframp(request: OfframpInitiateRequest): Promise<OfframpInitiateResponse> {
    try {
      const payData: PretiumPayRequest = {
        transaction_hash: request.transactionHash,
        shortcode: request.shortcode,
        amount: request.amount,
        type: request.type || "MOBILE",
        mobile_network:
          request.mobileNetwork ||
          this.detectMobileNetwork(
            request.shortcode,
            this.getCurrencyFromChain(request.chain)
          ),
        chain: request.chain.toUpperCase(),
        callback_url:
          request.callbackUrl ||
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/pretium/callback`,
      };

      const result = await this.makeRequest<any>("/pretium/pay", "POST", payData);

      const orderID =
        result.transaction_code ||
        result.id ||
        result?.data?.transaction_code ||
        result?.data?.data?.transaction_code;

      if (!orderID) {
        return { success: false, error: "Offramp initiation returned no order ID" };
      }

      return {
        success: true,
        data: { orderID },
      };
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to initiate offramp" };
    }
  }

  // --- Status ---
  async getOfframpStatus(orderID: string): Promise<OfframpStatusResponse> {
    try {
      const statusReq: PretiumStatusRequest = { transaction_code: orderID };
      const result = await this.makeRequest<any>(
        "/pretium/status",
        "POST",
        statusReq
      );

      return {
        success: true,
        data: {
          status: this.mapPretiumStatus(result.status),
          message: result.message || "Transaction processed",
          details: {
            phoneNumber: result.phone_number || "",
            ReceiverPartyPublicName: result.receiver_name,
            transactionSize: result.amount || "0",
            transactionSide: "offramp",
            initiatedAt: result.created_at || new Date().toISOString(),
            mpesaReceipt: result.receipt_number,
            completedAt: result.completed_at,
            failureReason: result.failure_reason,
            resultCode: result.result_code,
          },
        },
      };
    } catch (e: any) {
      return { success: false, error: e?.message || "Failed to fetch status" };
    }
  }

  private mapPretiumStatus(status: string): "PENDING" | "SUCCESS" | "FAILED" {
    switch ((status || "").toLowerCase()) {
      case "completed":
      case "success":
        return "SUCCESS";
      case "failed":
      case "error":
        return "FAILED";
      default:
        return "PENDING";
    }
  }

  private getCurrencyFromChain(chain: string): string {
    const map: Record<string, string> = {
      celo: "KES",
      base: "USD",
      stellar: "USD",
    };
    return map[(chain || "").toLowerCase()] || "KES";
  }

  detectMobileNetwork(phone: string, currency: string = "KES"): string {
    const cleaned = phone.replace(/\D/g, "");

    if (currency === "KES") {
      if (cleaned.startsWith("2547") || cleaned.startsWith("2541")) return "Safaricom";
    }

    return "Safaricom";
  }

  validatePhoneNumber(phone: string, currency: string = "KES"): boolean {
    const pattern = PHONE_PATTERNS[currency as keyof typeof PHONE_PATTERNS];
    return pattern ? pattern.test(phone) : false;
  }

  formatPhoneNumber(phone: string, currency: string = "KES"): string {
    let cleaned = phone.replace(/\D/g, "");

    if (currency === "KES") {
      if (cleaned.startsWith("0")) cleaned = "254" + cleaned.slice(1);
      else if (!cleaned.startsWith("254")) cleaned = "254" + cleaned;
    }

    return cleaned;
  }

  private getMinimumWithdrawalAmount(currency: string): number {
    const minimums: Record<string, number> = {
      KES: 20,
      NGN: 100,
      MWK: 100,
      UGX: 500,
      GHS: 5,
      CDF: 100,
      ETB: 100,
    };
    return minimums[currency] ?? 20;
  }

  private getMaximumWithdrawalAmount(currency: string): number {
    const maximums: Record<string, number> = {
      KES: 250000,
      NGN: 2000000,
      MWK: 5000000,
      UGX: 5000000,
      GHS: 1000,
      CDF: 5000000,
      ETB: 5000000,
    };
    return maximums[currency] ?? 250000;
  }
}

// Singleton
export const offrampService = new OfframpService();

// Helpers (used by UI)
export function estimateOfframpFee(amount: number, currency: string = "KES"): number {
  const feeRates: Record<string, number> = { KES: 0.025, USD: 0.03 };
  const rate = feeRates[currency] ?? 0.025;
  return Math.max(amount * rate, currency === "KES" ? 1 : 0.1);
}

export function formatCurrencyAmount(amount: number, currency: string): string {
  const formatters: Record<string, Intl.NumberFormat> = {
    KES: new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }),
    USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
  };
  const formatter = formatters[currency];
  return formatter ? formatter.format(amount) : `${amount} ${currency}`;
}
