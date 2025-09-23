"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatUnits } from "viem";
import { oracleService } from "@/lib/services/oracleService";
import { TOKENS, CHAINS, getTokenInfoMap } from "@/config/chainConfig";

interface TokenRate {
  address: string;
  symbol: string;
  rate: string;
  usdValue: string;
  localValue?: string;
}

// No hardcoded rates; fetch from on-chain backend oracle

// Build token metadata from central TOKENS config for the default chain
const defaultChain = CHAINS[0];
const tokenList = (TOKENS as any)[defaultChain.id] || [];
const TOKEN_INFO: Record<string, { symbol: string; flag: string }> = (() => {
  const map = defaultChain ? getTokenInfoMap(defaultChain.id) : {} as Record<string, any>;
  const out: Record<string, { symbol: string; flag: string }> = {};
  for (const addr of Object.keys(map)) {
    out[addr.toLowerCase()] = { symbol: (map[addr].symbol || '').toUpperCase(), flag: '' };
  }
  return out;
})();

const DEFAULT_DISPLAY_TOKENS = tokenList.length > 0 ? tokenList.slice(0, 4).map((t: any) => t.address) : [
  '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0',
  '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
  '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  '0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71',
];

// Derive local fiat metadata for known stable/local tokens
const LOCAL_META: Record<string, { code: string; symbol: string }> = {};
for (const t of tokenList) {
  const sym = (t.symbol || '').toUpperCase();
  if (sym === 'CKES' || sym === 'BKES') LOCAL_META[t.address.toLowerCase()] = { code: 'KES', symbol: 'KSh' };
  if (sym === 'CNGN') LOCAL_META[t.address.toLowerCase()] = { code: 'NGN', symbol: '₦' };
}

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
        const results: TokenRate[] = await Promise.all(
          displayTokens.map(async (addr: string): Promise<TokenRate> => {
            try {
              const { rate }: { rate: bigint } = await oracleService.getMedianRate(addr);
              const usdValue: number = Number(formatUnits(rate, 18));
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
