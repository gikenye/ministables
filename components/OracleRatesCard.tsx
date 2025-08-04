"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatUnits } from "viem";

const CELO_USD_RATE = 0.7;

interface TokenRate {
  address: string;
  symbol: string;
  rate: string;
  usdValue: string;
}

const HARDCODED_RATES: Record<string, string> = {
  "0x471EcE3750Da237f93B8E339c536989b8978a438": "1000000000000000000", // CELO
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": "1428571428571428571", // cUSD
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": "1571428571428571428", // cEUR
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": "285714285714285714", // cREAL
  "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": "2380952380952381", // eXOF
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": "10989010989010989", // cKES
  "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": "24571428571428571", // PUSO
  "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": "357142857142857", // cCOP
  "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": "95238095238095238", // cGHS
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": "1428571428571428571", // USDT
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": "1428571428571428571", // USDC
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": "1428571428571428571", // USDGLO
};

const TOKEN_INFO: Record<string, { symbol: string; flag: string }> = {
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": { symbol: "cKES", flag: "🇰🇪" },
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": { symbol: "USDC", flag: "🇺🇸" },
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": { symbol: "cUSD", flag: "🇺🇸" },
  "0x471EcE3750Da237f93B8E339c536989b8978a438": { symbol: "cNGN", flag: "🇳🇬" },
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": { symbol: "cEUR", flag: "🇪🇺" },
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": { symbol: "cREAL", flag: "🇧🇷" },
  "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": { symbol: "eXOF", flag: "🌍" },
  "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": { symbol: "PUSO", flag: "🇵🇭" },
  "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": { symbol: "cCOP", flag: "🇨🇴" },
  "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": { symbol: "cGHS", flag: "🇬🇭" },
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": { symbol: "USDT", flag: "🇺🇸" },
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": { symbol: "USDGLO", flag: "🌍" },
};

const DISPLAY_TOKENS = [
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", // cKES
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
  "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
  "0x471EcE3750Da237f93B8E339c536989b8978a438", // cNGN
];

export function OracleRatesCard() {
  const [displayedRates, setDisplayedRates] = useState<TokenRate[]>([]);

  const createTokenRate = (address: string): TokenRate => {
    const rate = HARDCODED_RATES[address] || "0";
    const rateInCelo = Number(formatUnits(BigInt(rate), 18));
    const usdValue = (rateInCelo * CELO_USD_RATE).toFixed(4);
    
    return {
      address,
      symbol: TOKEN_INFO[address]?.symbol || "UNKNOWN",
      rate,
      usdValue,
    };
  };

  useEffect(() => {
    const rates = DISPLAY_TOKENS.map(createTokenRate);
    setDisplayedRates(rates);
  }, []);

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
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
