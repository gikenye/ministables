"use client";
import { useState, useEffect, useMemo } from "react";
import { getContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";
import { useDashboardData } from "./useDashboardData";
import { useAccumulatedInterest } from "./useAccumulatedInterest";
import { calculateEquivalentValue } from "@/lib/oracles/priceService";

// Standard stablecoin reference for value comparison
const USD_REFERENCE_TOKEN = "0x765DE816845861e75A25fCA122bb6898B8B1282a"; // cUSD

// Supported stablecoins from deployment config
const SUPPORTED_STABLECOINS = [
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", // cKES
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", // cREAL
  "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08", // eXOF
  "0x8A567e2aE79CA692Bd748aB832081C45de4041eA", // cCOP
  "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313", // cGHS
  "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B", // PUSO
  "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3", // USDGLO
  "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71", // cNGN
];

// Token info mapping
const TOKEN_INFO: Record<string, { symbol: string; decimals: number }> = {
  "0x471EcE3750Da237f93B8E339c536989b8978a438": { symbol: "CELO", decimals: 18 },
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": { symbol: "cUSD", decimals: 18 },
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": { symbol: "cEUR", decimals: 18 },
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": { symbol: "cREAL", decimals: 18 },
  "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": { symbol: "eXOF", decimals: 18 },
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": { symbol: "cKES", decimals: 18 },
  "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": { symbol: "PUSO", decimals: 18 },
  "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": { symbol: "cCOP", decimals: 18 },
  "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": { symbol: "cGHS", decimals: 18 },
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": { symbol: "USDT", decimals: 6 },
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": { symbol: "USDC", decimals: 6 },
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": { symbol: "USDGLO", decimals: 18 },
  "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71": { symbol: "cNGN", decimals: 18 },
};

export interface EnhancedUserData {
  deposits: Record<string, string>;
  depositValue: string;
  borrows: Record<string, string>;
  borrowValue: string;
  collateral: Record<string, string>;
  interest: Record<string, string>;
  interestUsd: Record<string, string>;
  totalInterestUsd: string;
  lockEnds: Record<string, number>;
  borrowStartTimes: Record<string, number>;
  nearestUnlockTime: number | null;
  loading: boolean;
  tokenInfo: Record<string, { symbol: string; decimals: number }>;
}

export function useEnhancedDashboard(address: string | undefined): EnhancedUserData {
  const { 
    deposits, borrows, collateral, lockEnds, loading: dashboardLoading 
  } = useDashboardData(address);
  
  const { 
    interest, interestUsd, borrowStartTimes, loading: interestLoading 
  } = useAccumulatedInterest(address, SUPPORTED_STABLECOINS);
  
  const [depositValue, setDepositValue] = useState("0");
  const [borrowValue, setBorrowValue] = useState("0");
  const [loading, setLoading] = useState(true);

  // Format big integers with proper decimal precision
  const bigIntPow10 = (n: number) => {
    let result = BigInt(1);
    for (let i = 0; i < n; i++) result *= BigInt(10);
    return result;
  };

  const formatAmount = (amountStr: string, token: string) => {
    const info = TOKEN_INFO[token];
    const decimals = info?.decimals ?? 18;
    try {
      const amt = BigInt(amountStr || "0");
      // scale to a number string with decimals
      const denom = bigIntPow10(decimals);
      const intPart = (amt / denom).toString();
      const frac = (amt % denom).toString().padStart(decimals, "0").slice(0, 2);
      return `${intPart}.${frac}`;
    } catch {
      return "0.00";
    }
  };

  // Calculate total interest in USD
  const totalInterestUsd = useMemo(() => {
    let total = 0;
    for (const token of Object.keys(interestUsd)) {
      total += parseFloat(interestUsd[token] || "0");
    }
    return total.toFixed(2);
  }, [interestUsd]);

  // Find nearest unlock time
  const nearestUnlockTime = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const futureUnlockTimes = Object.values(lockEnds)
      .filter(time => time > now)
      .sort((a, b) => a - b);
    
    return futureUnlockTimes.length > 0 ? futureUnlockTimes[0] : null;
  }, [lockEnds]);

  // Calculate USD values for deposits and borrows
  useEffect(() => {
    const calculateValues = async () => {
      setLoading(true);
      
      try {
        let depositTotal = 0;
        let borrowTotal = 0;
        
        // Calculate deposit values
        for (const token of Object.keys(deposits)) {
          if (deposits[token] === "0") continue;
          
          try {
            const amount = formatAmount(deposits[token], token);
            
            // Convert to USD equivalent if needed
            if (token !== USD_REFERENCE_TOKEN) {
              const result = await calculateEquivalentValue(token, USD_REFERENCE_TOKEN, amount);
              if (result) {
                depositTotal += parseFloat(result.value);
              } else {
                depositTotal += parseFloat(amount);
              }
            } else {
              depositTotal += parseFloat(amount);
            }
          } catch (error) {
            console.error(`Error calculating value for deposit token ${token}:`, error);
          }
        }
        
        // Calculate borrow values
        for (const token of Object.keys(borrows)) {
          if (borrows[token] === "0") continue;
          
          try {
            const amount = formatAmount(borrows[token], token);
            
            // Convert to USD equivalent if needed
            if (token !== USD_REFERENCE_TOKEN) {
              const result = await calculateEquivalentValue(token, USD_REFERENCE_TOKEN, amount);
              if (result) {
                borrowTotal += parseFloat(result.value);
              } else {
                borrowTotal += parseFloat(amount);
              }
            } else {
              borrowTotal += parseFloat(amount);
            }
          } catch (error) {
            console.error(`Error calculating value for borrow token ${token}:`, error);
          }
        }
        
        setDepositValue(depositTotal.toFixed(2));
        setBorrowValue(borrowTotal.toFixed(2));
      } catch (error) {
        console.error("Error calculating USD values:", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (!dashboardLoading && !interestLoading && address) {
      calculateValues();
    }
  }, [address, deposits, borrows, dashboardLoading, interestLoading]);

  return {
    deposits,
    depositValue,
    borrows,
    borrowValue,
    collateral,
    interest,
    interestUsd,
    totalInterestUsd,
    lockEnds,
    borrowStartTimes,
    nearestUnlockTime,
    loading: loading || dashboardLoading || interestLoading,
    tokenInfo: TOKEN_INFO
  };
}