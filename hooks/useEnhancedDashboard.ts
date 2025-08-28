"use client";
import { useState, useEffect, useMemo } from "react";
import { getContract, prepareContractCall, readContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";
import { calculateEquivalentValue } from "@/lib/oracles/priceService";
import { 
  fetchUserDeposit, 
  fetchUserBorrow, 
  fetchUserCollateral,
  fetchAccumulatedInterest,
  fetchBorrowStartTime,
  fetchTotalSupply
} from "@/lib/services/dashboardService";

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
  "0x471EcE3750Da237f93B8E339c536989b8978a438": {
    symbol: "CELO",
    decimals: 18,
  },
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": {
    symbol: "cUSD",
    decimals: 18,
  },
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": {
    symbol: "cEUR",
    decimals: 18,
  },
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": {
    symbol: "cREAL",
    decimals: 18,
  },
  "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": {
    symbol: "eXOF",
    decimals: 18,
  },
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": {
    symbol: "cKES",
    decimals: 18,
  },
  "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": {
    symbol: "PUSO",
    decimals: 18,
  },
  "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": {
    symbol: "cCOP",
    decimals: 18,
  },
  "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": {
    symbol: "cGHS",
    decimals: 18,
  },
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": { 
    symbol: "USDT", 
    decimals: 6 
  },
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": { 
    symbol: "USDC", 
    decimals: 6 
  },
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": {
    symbol: "USDGLO",
    decimals: 18,
  },
  "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71": {
    symbol: "cNGN",
    decimals: 18,
  },
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
  const [dashboardData, setDashboardData] = useState({
    deposits: {} as Record<string, string>,
    borrows: {} as Record<string, string>,
    collateral: {} as Record<string, string>,
    lockEnds: {} as Record<string, number>,
    interest: {} as Record<string, string>,
    interestUsd: {} as Record<string, string>,
    borrowStartTimes: {} as Record<string, number>,
  });
  
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
    for (const token of Object.keys(dashboardData.interestUsd)) {
      total += parseFloat(dashboardData.interestUsd[token] || "0");
    }
    return total.toFixed(2);
  }, [dashboardData.interestUsd]);

  // Find nearest unlock time
  const nearestUnlockTime = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const futureUnlockTimes = Object.values(dashboardData.lockEnds)
      .filter(time => time > now)
      .sort((a, b) => a - b);
    
    return futureUnlockTimes.length > 0 ? futureUnlockTimes[0] : null;
  }, [dashboardData.lockEnds]);

  // Fetch all data using the service functions with contract
  useEffect(() => {
    if (!address) {
      console.log("useEnhancedDashboard: No address provided, skipping data fetch");
      setLoading(false);
      return;
    }

    console.log("useEnhancedDashboard: Starting data fetch for address:", address);
    let isMounted = true; // Track component mount state for cleanup
    
    const loadAllDashboardData = async () => {
      setLoading(true);
      
      try {
        // Initialize contract - similar to BorrowMoneyModal implementation
        console.log("useEnhancedDashboard: Initializing contract with address:", MINILEND_ADDRESS);
        
        // Make sure we have a valid contract address
        if (!MINILEND_ADDRESS || MINILEND_ADDRESS === "0x0000000000000000000000000000000000000000") {
          throw new Error("Invalid MINILEND_ADDRESS");
        }
        
        // Log client and chain to make sure they're available
        console.log("useEnhancedDashboard: Client and chain available:", 
          { clientAvailable: !!client, chainAvailable: !!celo });
          
        const contract = getContract({
          address: MINILEND_ADDRESS,
          chain: celo,
          client,
        });
        
        console.log("useEnhancedDashboard: Contract initialized:", JSON.stringify({
          address: contract.address,
          source: contract.source,
          abi: contract.abi ? "ABI present" : "No ABI found"
        }));

        // Fetch user data using the ThirdWeb function patterns
        const deposits: Record<string, string> = {};
        const borrows: Record<string, string> = {};
        const collateral: Record<string, string> = {};
        const lockEnds: Record<string, number> = {};
        const interest: Record<string, string> = {};
        const startTimes: Record<string, number> = {};

        console.log("Using a reduced set of tokens for initial test");
        
        // Start with just a few tokens to test data fetching
        const testTokens = [
          "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
          "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
        ];
        
        try {
          // Try to fetch user deposit for cUSD as a simple test
          console.log("Fetching test deposit for cUSD");
          const testToken = "0x765DE816845861e75A25fCA122bb6898B8B1282a"; // cUSD
          
          const testDeposit = await fetchUserDeposit(contract, address, testToken, 0n);
          console.log("Test deposit result:", testDeposit);
          
          // If the test worked, process all tokens
          for (const token of testTokens) {
            try {
              console.log(`Processing token: ${token}`);
              
              // Fetch deposit data
              const depositResult = await fetchUserDeposit(contract, address, token, 0n);
              if (depositResult) {
                const [amount, lockEnd] = depositResult as [bigint, bigint];
                deposits[token] = amount.toString();
                lockEnds[token] = Number(lockEnd);
              } else {
                deposits[token] = "0";
                lockEnds[token] = 0;
              }
              
              // Fetch borrow data
              const borrowResult = await fetchUserBorrow(contract, address, token);
              borrows[token] = borrowResult ? borrowResult.toString() : "0";
              
              // Fetch collateral data
              const collateralResult = await fetchUserCollateral(contract, address, token);
              collateral[token] = collateralResult ? collateralResult.toString() : "0";
              
              // Fetch borrow start times
              const startTimeResult = await fetchBorrowStartTime(contract, address, token);
              startTimes[token] = startTimeResult ? Number(startTimeResult) : 0;
              
            } catch (err) {
              console.error(`Error processing data for token ${token}:`, err);
              deposits[token] = "0";
              borrows[token] = "0";
              collateral[token] = "0";
              lockEnds[token] = 0;
              startTimes[token] = 0;
            }
          }
          
          // Fill in the rest of the tokens with zero values
          for (const token of SUPPORTED_STABLECOINS) {
            if (!testTokens.includes(token)) {
              deposits[token] = "0";
              borrows[token] = "0";
              collateral[token] = "0";
              lockEnds[token] = 0;
              startTimes[token] = 0;
            }
          }
        } catch (err) {
          console.error("Failed to fetch test deposit:", err);
          
          // Fill all tokens with zeros as fallback
          for (const token of SUPPORTED_STABLECOINS) {
            deposits[token] = "0";
            borrows[token] = "0";
            collateral[token] = "0";
            lockEnds[token] = 0;
            startTimes[token] = 0;
          }
        }

        // Fetch accumulated interest (once for user)
        let accumulatedInterest = "0";
        try {
          const interestResult = await fetchAccumulatedInterest(contract, address);
          accumulatedInterest = interestResult ? interestResult.toString() : "0";
        } catch (err) {
          console.error("Error fetching accumulated interest:", err);
        }

        // Fill interest data for all tokens
        for (const token of SUPPORTED_STABLECOINS) {
          interest[token] = accumulatedInterest;
        }

        if (isMounted) {
          setDashboardData({
            deposits,
            borrows,
            collateral,
            lockEnds,
            interest,
            interestUsd: {}, // Will calculate below
            borrowStartTimes: startTimes
          });
          
          // Calculate USD values
          await calculateUsdValues(deposits, borrows, interest);
        }
      } catch (error) {
        console.error("Error loading enhanced dashboard data:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadAllDashboardData();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [address]);
  
  // Calculate USD values for all tokens
  const calculateUsdValues = async (
    deposits: Record<string, string>, 
    borrows: Record<string, string>,
    interest: Record<string, string>
  ) => {
    try {
      let depositTotal = 0;
      let borrowTotal = 0;
      const interestUsdValues: Record<string, string> = {};
      
      for (const token of SUPPORTED_STABLECOINS) {
        // Calculate deposit value
        if (deposits[token] && deposits[token] !== "0") {
          try {
            const equivalentValue = await calculateEquivalentValue(token, USD_REFERENCE_TOKEN, deposits[token]);
            if (equivalentValue) {
              depositTotal += parseFloat(equivalentValue.value);
            }
          } catch (error) {
            console.error(`Error converting deposit value for ${token}:`, error);
          }
        }
        
        // Calculate borrow value
        if (borrows[token] && borrows[token] !== "0") {
          try {
            const equivalentValue = await calculateEquivalentValue(token, USD_REFERENCE_TOKEN, borrows[token]);
            if (equivalentValue) {
              borrowTotal += parseFloat(equivalentValue.value);
            }
          } catch (error) {
            console.error(`Error converting borrow value for ${token}:`, error);
          }
        }
        
        // Calculate interest USD value
        if (interest[token] && interest[token] !== "0") {
          try {
            const equivalentValue = await calculateEquivalentValue(token, USD_REFERENCE_TOKEN, interest[token]);
            if (equivalentValue) {
              interestUsdValues[token] = equivalentValue.value;
            } else {
              interestUsdValues[token] = "0";
            }
          } catch (error) {
            console.error(`Error converting interest value for ${token}:`, error);
            interestUsdValues[token] = "0";
          }
        } else {
          interestUsdValues[token] = "0";
        }
      }
      
      setDepositValue(depositTotal.toFixed(2));
      setBorrowValue(borrowTotal.toFixed(2));
      
      setDashboardData(prev => ({
        ...prev,
        interestUsd: interestUsdValues
      }));
      
    } catch (error) {
      console.error("Error calculating USD values:", error);
    }
  };

  return {
    deposits: dashboardData.deposits,
    depositValue,
    borrows: dashboardData.borrows,
    borrowValue,
    collateral: dashboardData.collateral,
    interest: dashboardData.interest,
    interestUsd: dashboardData.interestUsd,
    totalInterestUsd,
    lockEnds: dashboardData.lockEnds,
    borrowStartTimes: dashboardData.borrowStartTimes,
    nearestUnlockTime,
    loading,
    tokenInfo: TOKEN_INFO
  };
}