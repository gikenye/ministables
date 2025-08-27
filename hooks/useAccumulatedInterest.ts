"use client";
import { useState, useEffect } from "react";
import { getContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";
import { calculateEquivalentValue } from "@/lib/oracles/priceService";
import { useReadContract } from "thirdweb/react";

export function useAccumulatedInterest(address: string | undefined, stablecoins: string[]) {
  const [interest, setInterest] = useState<Record<string, string>>({});
  const [interestUsd, setInterestUsd] = useState<Record<string, string>>({});
  const [borrowStartTimes, setBorrowStartTimes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Fetch accumulated interest for user
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

  // Fetch borrowStartTime for each token
  // Use a proper hook pattern instead of mapping hooks in the component body
  const [borrowStartTimesResults, setBorrowStartTimesResults] = useState<Array<{token: string, data: any}>>([]);
  
  // Fetch borrowStartTimes in a single useEffect to avoid recreation on each render
  useEffect(() => {
    if (!address || !stablecoins.length) return;
    
    const fetchBorrowStartTimes = async () => {
      try {
        const contract = getContract({
          chain: celo,
          client, 
          address: MINILEND_ADDRESS,
        });
        
        const results = await Promise.all(stablecoins.map(async (token) => {
          try {
            const data = await contract.read("borrowStartTime", [address, token]);
            return { token, data };
          } catch (error) {
            console.error(`Error fetching borrow start time for ${token}:`, error);
            return { token, data: null };
          }
        }));
        
        setBorrowStartTimesResults(results);
      } catch (error) {
        console.error("Error fetching borrow start times:", error);
      }
    };
    
    fetchBorrowStartTimes();
  }, [address, stablecoins]);

  // Process fetch results
  useEffect(() => {
    if (!address || !stablecoins.length) return;
    
    const processInterestData = async () => {
      setLoading(true);
      try {
        const newInterest: Record<string, string> = {};
        const newBorrowStartTimes: Record<string, number> = {};
        
        // Stable reference USD token for conversion
        const cUsdToken = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
        
        // Set accumulated interest
        if (accumulatedInterestData) {
          for (const token of stablecoins) {
            newInterest[token] = accumulatedInterestData.toString();
          }
        }

        // Process borrow start times
        borrowStartTimesResults.forEach(result => {
          if (result.data) {
            newBorrowStartTimes[result.token] = Number(result.data);
          } else {
            newBorrowStartTimes[result.token] = 0;
          }
        });

        setInterest(newInterest);
        setBorrowStartTimes(newBorrowStartTimes);

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
        console.error("Error loading interest data:", error);
      } finally {
        setLoading(false);
      }
    };

    processInterestData();
  // Stable dependencies that won't cause unnecessary rerenders:
  // - address and stablecoins only change when actually needed
  // - accumulatedInterestData is from thirdweb hook that manages its own reactivity
  // - borrowStartTimesResults will only change when the data actually changes
  }, [address, stablecoins, accumulatedInterestData, borrowStartTimesResults]);

  return { 
    interest, 
    interestUsd, 
    borrowStartTimes, 
    loading: loading || interestLoading 
  };
}