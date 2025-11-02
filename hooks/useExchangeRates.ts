import { useState, useEffect } from "react";
import { fetchUSDExchangeRates } from "@/lib/services/exchangeRateService";
import { offrampService } from "@/lib/services/offrampService";

interface ExchangeRates {
  [currencyCode: string]: number;
}

interface UseExchangeRatesReturn {
  rates: ExchangeRates | null;
  loading: boolean;
  error: string | null;
  getRate: (from: string, to: string) => number | null;
  getKESRate: () => number | null;
  refreshRates: () => Promise<void>;
}

/**
 * Hook for fetching and managing exchange rates
 * Combines both USD exchange rates and Pretium rates for comprehensive coverage
 */
export function useExchangeRates(): UseExchangeRatesReturn {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch USD exchange rates first (primary source)
      const usdRates = await fetchUSDExchangeRates();

      if (usdRates) {
        setRates(usdRates);
      } else {
        // Fallback to Pretium rates if USD rates fail
        try {
          const quoteRequest = {
            amount: "1", // Get rate for 1 USD
            cryptoCurrency: "USDC",
            fiatCurrency: "KES",
            network: "CELO",
          };

          const quoteResponse =
            await offrampService.getOfframpQuote(quoteRequest);

          if (quoteResponse.success && quoteResponse.data?.exchangeRate) {
            setRates({ KES: quoteResponse.data.exchangeRate });
          } else {
            throw new Error("No exchange rates available from Pretium");
          }
        } catch (pretiumError) {
          console.error("Pretium fallback failed:", pretiumError);
          // Use fallback rates if all services fail
          setRates({ KES: 131.5 }); // Fallback rate
          setError("Using fallback exchange rates");
        }
      }
    } catch (err) {
      console.error("Failed to fetch exchange rates:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch exchange rates"
      );
      // Set fallback rates
      setRates({ KES: 131.5 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const getRate = (from: string, to: string): number | null => {
    if (!rates) return null;

    // Handle USD conversions
    if (from === "USD" && rates[to]) {
      return rates[to];
    }

    if (to === "USD" && rates[from]) {
      return 1 / rates[from];
    }

    // Handle same currency
    if (from === to) return 1;

    // For other conversions, convert through USD
    if (rates[from] && rates[to]) {
      return rates[to] / rates[from];
    }

    return null;
  };

  const getKESRate = (): number | null => {
    return getRate("USD", "KES");
  };

  const refreshRates = async () => {
    await fetchRates();
  };

  return {
    rates,
    loading,
    error,
    getRate,
    getKESRate,
    refreshRates,
  };
}
