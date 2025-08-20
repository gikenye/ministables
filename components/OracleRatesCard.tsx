"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatUnits } from "viem";
import { oracleService } from "@/lib/services/oracleService";

interface TokenRate {
  address: string;
  symbol: string;
  rate: string;
  usdValue: string;
  localValue?: string;
}

// No hardcoded rates; fetch from on-chain backend oracle

const TOKEN_INFO: Record<string, { symbol: string; flag: string }> = {
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": { symbol: "cKES", flag: "🇰🇪" },
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": { symbol: "USDC", flag: "🇺🇸" },
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": { symbol: "cUSD", flag: "🇺🇸" },
  "0x471EcE3750Da237f93B8E339c536989b8978a438": { symbol: "CELO", flag: "🇳🇬" },
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": { symbol: "USDT", flag: "🇺🇸" },

  // "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": { symbol: "cEUR", flag: "🇪🇺" },
  // "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": { symbol: "cREAL", flag: "🇧🇷" },
  // "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": { symbol: "eXOF", flag: "🌍" },
  // "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": { symbol: "PUSO", flag: "🇵🇭" },
  // "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": { symbol: "cCOP", flag: "🇨🇴" },
  // "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": { symbol: "cGHS", flag: "🇬🇭" },
  // "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": { symbol: "USDGLO", flag: "🌍" },
};

const DEFAULT_DISPLAY_TOKENS = [
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", // cKES
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
  "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
  "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71", // cNGN
];

const LOCAL_META: Record<string, { code: string; symbol: string }> = {
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": { code: "KES", symbol: "KSh" },
  "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71": { code: "NGN", symbol: "₦" },
};

export interface OracleRatesCardProps {
  tokens?: string[];
  localTokenAddress?: string; // token pegged to user local fiat (e.g., cKES, cNGN)
}

export function OracleRatesCard({ tokens, localTokenAddress }: OracleRatesCardProps) {
  const [displayedRates, setDisplayedRates] = useState<TokenRate[]>([]);
  const displayTokens = useMemo(() => (tokens && tokens.length > 0 ? tokens : DEFAULT_DISPLAY_TOKENS), [tokens]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        // Fetch USD prices for all tokens to display
        const results = await Promise.all(
          displayTokens.map(async (addr) => {
            try {
              const { rate } = await oracleService.getMedianRate(addr);
              const usdValue = Number(formatUnits(rate, 18));
              const base: TokenRate = {
                address: addr,
                symbol: TOKEN_INFO[addr]?.symbol || "UNKNOWN",
                rate: rate.toString(),
                usdValue: usdValue.toFixed(6),
              };
              return base;
            } catch {
              return {
                address: addr,
                symbol: TOKEN_INFO[addr]?.symbol || "UNKNOWN",
                rate: "0",
                usdValue: "0.000000",
              } as TokenRate;
            }
          })
        );
        if (cancelled) return;

        // If a local-token is provided, compute local values using oracle ratio
        if (localTokenAddress) {
          try {
            const { rate: localUsdRate } = await oracleService.getMedianRate(localTokenAddress);
            const localUsd = Number(formatUnits(localUsdRate, 18));
            const localMeta = LOCAL_META[localTokenAddress];
            if (localUsd > 0 && localMeta) {
              const withLocal = results.map((r) => {
                if (r.address.toLowerCase() === localTokenAddress.toLowerCase()) {
                  return { ...r, localValue: `1.000000 ${localMeta.symbol}` };
                }
                const usdPerToken = Number(r.usdValue);
                const localPerToken = usdPerToken / localUsd; // price in local fiat
                return { ...r, localValue: `${localPerToken.toFixed(2)} ${localMeta.symbol}` };
              });
              if (!cancelled) setDisplayedRates(withLocal);
              return;
            }
          } catch {}
        }

        setDisplayedRates(results);
      } catch {
        // ignore
      }
    };
    run();
    return () => { cancelled = true; };
  }, [displayTokens, localTokenAddress]);

  return (
    <Card className="bg-white border-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-primary">
          <TrendingUp className="w-5 h-5 mr-2" />
          Rates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayedRates.map((rate) => (
          <div
            key={rate.address}
            className="flex items-center justify-between py-1"
          >
            <span className="font-medium text-gray-900 text-sm">
              {rate.symbol}
            </span>
            <span className="font-semibold text-primary text-sm">
              ${rate.usdValue}
            </span>
            {rate.localValue && (
              <span className="text-gray-500 text-xs ml-2">{rate.localValue}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
