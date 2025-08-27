"use client";
import { useState, useEffect, useMemo } from "react";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";
import { calculateEquivalentValue } from "@/lib/oracles/priceService";
import { useReadContract } from "thirdweb/react";
import { prepareContractCall, readContract } from "thirdweb";

export function useAccumulatedInterest(address: string | undefined, stablecoins: string[]) {
  const [interest, setInterest] = useState<Record<string, string>>({});
  const [interestUsd, setInterestUsd] = useState<Record<string, string>>({});
  const [borrowStartTimes, setBorrowStartTimes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Fetch accumulated interest for user using the useReadContract hook
  const { data: accumulatedInterestData, isPending: interestLoading } = useReadContract({
    contract: {
      chain: celo,
      client,
      address: MINILEND_ADDRESS,
    },
    method: "function accumulatedInterest(address) view returns (uint256)",
    params: [address || "0x0000000000000000000000000000000000000000"],
    queryOptions: {
      enabled: !!address,
    },
  });

  // Memoize the accumulated interest to avoid unnecessary recalculations
  const accumulatedInterest = useMemo(() => {
    return accumulatedInterestData ? accumulatedInterestData.toString() : "0";
  }, [accumulatedInterestData]);

  // Fetch borrow start times for all tokens in a single effect
  useEffect(() => {
    if (!address || !stablecoins.length) return;
    
    const fetchBorrowStartTimes = async () => {
      setLoading(true);
      
      try {
        // Create a map to hold results
        const newBorrowStartTimes: Record<string, number> = {};
        
        // Use Promise.all with the recommended thirdweb pattern
        await Promise.all(stablecoins.map(async (token) => {
          try {
            // Use prepareContractCall and readContract instead of getContract
            const tx = prepareContractCall({
              contract: {
                chain: celo,
                client, 
                address: MINILEND_ADDRESS,
              },
              method: "function borrowStartTime(address,address) view returns (uint256)",
              params: [address, token],
            });
            
            const result = await readContract(tx);
            newBorrowStartTimes[token] = Number(result || 0);
          } catch (error) {
            console.error(`Error fetching borrow start time for ${token}:`, error);
            newBorrowStartTimes[token] = 0;
          }
        }));
        
        setBorrowStartTimes(newBorrowStartTimes);
        
        // Process interest data after borrowStartTimes are ready
        processInterestData(newBorrowStartTimes);
      } catch (error) {
        console.error("Error fetching borrow start times:", error);
        setLoading(false);
      }
    };
    
    fetchBorrowStartTimes();
  }, [address, stablecoins, accumulatedInterest]);

  // Process interest data separately to avoid nested async functions
  const processInterestData = async (newBorrowStartTimes: Record<string, number>) => {
    try {
      const newInterest: Record<string, string> = {};
      
      // Stable reference USD token for conversion
      const cUsdToken = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
      
      // Set accumulated interest for all tokens
      if (accumulatedInterestData) {
        for (const token of stablecoins) {
          newInterest[token] = accumulatedInterestData.toString();
        }
      }

      setInterest(newInterest);

      // Calculate USD equivalent values
      const usdValues: Record<string, string> = {};
      
      for (const token of stablecoins) {
        if (newInterest[token] && newInterest[token] !== "0") {
          try {
            const equivalentValue = await calculateEquivalentValue(token, cUsdToken, newInterest[token]);
            if (equivalentValue) {
              usdValues[token] = equivalentValue.value;
            } else {
              usdValues[token] = newInterest[token];
            }
          } catch {
            usdValues[token] = newInterest[token];
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

  return { 
    interest, 
    interestUsd, 
    borrowStartTimes, 
    loading: loading || interestLoading 
  };
}