import { useState, useEffect } from "react";
import { useChain } from "@/components/ChainProvider";

interface InterestRates {
  [tokenSymbol: string]: number;
}

interface UseInterestRatesReturn {
  rates: InterestRates;
  loading: boolean;
  error: string | null;
  getTokenRate: (tokenSymbol: string) => number;
  refreshRates: () => Promise<void>;
}

/**
 * Hook for fetching and managing dynamic interest rates from Aave
 * Falls back to default rates if Aave rates are unavailable
 */
export function useInterestRates(): UseInterestRatesReturn {
  const [rates, setRates] = useState<InterestRates>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { chain } = useChain();

  // Default fallback rates for different tokens
  const DEFAULT_RATES: InterestRates = {
    USDC: 4.2,
    USDT: 4.1,
    CUSD: 3.8,
  };

  const fetchRates = async () => {
    if (!chain?.id) {
      setRates(DEFAULT_RATES);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Only fetch from Aave for supported chains
      if (chain.id === 42220) {
        const response = await fetch(`/api/interest-rates?chainId=${chain.id}`);

        if (response.ok) {
          const data = await response.json();
          setRates({ ...DEFAULT_RATES, ...data.rates });
        } else {
          setRates(DEFAULT_RATES);
        }
      } else {
        setRates(DEFAULT_RATES);
      }
    } catch (err) {
      console.error("Failed to fetch interest rates:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch interest rates"
      );
      setRates(DEFAULT_RATES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, [chain?.id]);

  const getTokenRate = (tokenSymbol: string): number => {
    const upperSymbol = tokenSymbol.toUpperCase();
    return rates[upperSymbol] || DEFAULT_RATES[upperSymbol] || 4.0;
  };

  const refreshRates = async () => {
    await fetchRates();
  };

  return {
    rates,
    loading,
    error,
    getTokenRate,
    refreshRates,
  };
}
