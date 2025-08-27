"use client";
import { useState } from "react";
import { calculateEquivalentValue } from "@/lib/oracles/priceService";

/**
 * Simple hook to store interest-related data, which is now fetched via the dashboardService
 */
export function useAccumulatedInterest(address: string | undefined, stablecoins: string[]) {
  const [interest, setInterest] = useState<Record<string, string>>({});
  const [interestUsd, setInterestUsd] = useState<Record<string, string>>({});
  const [borrowStartTimes, setBorrowStartTimes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // For USD conversion if needed - now independent from fetching
  const convertToUsd = async (interestValues: Record<string, string>) => {
    setLoading(true);
    try {
      const cUsdToken = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
      const usdValues: Record<string, string> = {};
      
      for (const token of stablecoins) {
        if (interestValues[token] && interestValues[token] !== "0") {
          try {
            const equivalentValue = await calculateEquivalentValue(token, cUsdToken, interestValues[token]);
            if (equivalentValue) {
              usdValues[token] = equivalentValue.value;
            } else {
              usdValues[token] = interestValues[token];
            }
          } catch {
            usdValues[token] = interestValues[token];
          }
        } else {
          usdValues[token] = "0";
        }
      }
      
      setInterestUsd(usdValues);
    } catch (error) {
      console.error("Error processing interest data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Update interest data with values from parent
  const updateInterestData = (
    interestData: Record<string, string>, 
    startTimes: Record<string, number>
  ) => {
    setInterest(interestData);
    setBorrowStartTimes(startTimes);
  };
  
  return { 
    interest, 
    interestUsd, 
    borrowStartTimes, 
    loading,
    convertToUsd,
    updateInterestData
  };
}