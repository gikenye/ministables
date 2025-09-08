"use client";
import { useState, useEffect, useMemo } from "react";
import { getContract } from "thirdweb";
import { useReadContract } from "thirdweb/react";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";

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

  // Create contract instance like the working modals
  const contract = getContract({
    client,
    chain: celo,
    address: MINILEND_ADDRESS,
  });

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

  // Get user data for all supported tokens
  const userDataQueries = SUPPORTED_STABLECOINS.map(token => {
    const { data: deposit } = useReadContract({
      contract,
      method: "function deposits(address, address) view returns (uint256)",
      params: [address || "0x0000000000000000000000000000000000000000", token],
      queryOptions: { enabled: !!address },
    });
    
    const { data: borrow } = useReadContract({
      contract,
      method: "function borrows(address, address) view returns (uint256)",
      params: [address || "0x0000000000000000000000000000000000000000", token],
      queryOptions: { enabled: !!address },
    });
    
    const { data: collateral } = useReadContract({
      contract,
      method: "function collaterals(address, address) view returns (uint256)",
      params: [address || "0x0000000000000000000000000000000000000000", token],
      queryOptions: { enabled: !!address },
    });
    
    return { token, deposit, borrow, collateral };
  });

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const newData = {
      deposits: {} as Record<string, string>,
      borrows: {} as Record<string, string>,
      collateral: {} as Record<string, string>,
      lockEnds: {} as Record<string, number>,
      interest: {} as Record<string, string>,
      interestUsd: {} as Record<string, string>,
      borrowStartTimes: {} as Record<string, number>,
    };

    let totalDepositValue = 0;
    let totalBorrowValue = 0;

    // Process all token data
    userDataQueries.forEach(({ token, deposit, borrow, collateral }) => {
      const depositAmount = deposit?.toString() || "0";
      const borrowAmount = borrow?.toString() || "0";
      const collateralAmount = collateral?.toString() || "0";
      
      newData.deposits[token] = depositAmount;
      newData.borrows[token] = borrowAmount;
      newData.collateral[token] = collateralAmount;
      newData.lockEnds[token] = 0;
      newData.interest[token] = "0";
      newData.interestUsd[token] = "0";
      newData.borrowStartTimes[token] = 0;

      // Calculate values (assuming 1:1 USD for simplicity)
      const depositValue = parseFloat(formatAmount(depositAmount, token));
      const borrowValue = parseFloat(formatAmount(borrowAmount, token));
      totalDepositValue += depositValue;
      totalBorrowValue += borrowValue;
    });

    setDashboardData(newData);
    setDepositValue(totalDepositValue.toFixed(2));
    setBorrowValue(totalBorrowValue.toFixed(2));
    setLoading(false);
  }, [address, userDataQueries]);
  


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