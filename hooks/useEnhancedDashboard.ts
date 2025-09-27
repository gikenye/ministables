"use client";
import { useState, useEffect, useMemo } from "react";
import { getContract } from "thirdweb";
import { useReadContract } from "thirdweb/react";
import { client } from "@/lib/thirdweb/client";
import { CHAINS, CONTRACTS, TOKENS, getTokenInfoMap } from "@/config/chainConfig";

// Select a chain that has a configured contract (fall back to first chain)
const SELECTED_CHAIN = (CHAINS && CHAINS.length > 0)
  ? (CHAINS.find((c: any) => CONTRACTS && CONTRACTS[c.id]) || CHAINS[0])
  : undefined;
const USD_REFERENCE_TOKEN = (() => {
  try {
    if (TOKENS && SELECTED_CHAIN && TOKENS[SELECTED_CHAIN.id]) {
      const usd = TOKENS[SELECTED_CHAIN.id].find((t: any) => (t.symbol || '').toUpperCase() === "CUSD")
      return usd ? usd.address : undefined
    }
  } catch (e) {
    // ignore
  }
  return undefined
})();

const SUPPORTED_STABLECOINS: string[] = (() => {
  try {
    if (TOKENS && SELECTED_CHAIN && TOKENS[SELECTED_CHAIN.id]) {
      return TOKENS[SELECTED_CHAIN.id].map((t: any) => t.address)
    }
  } catch (e) {}
  return []
})();

const TOKEN_INFO: Record<string, { symbol: string; decimals: number }> = SELECTED_CHAIN ? getTokenInfoMap(SELECTED_CHAIN.id) : {};

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

  // Create contract instance using the selected chain from config
  const selectedAddress = (CONTRACTS && SELECTED_CHAIN) ? CONTRACTS[SELECTED_CHAIN.id] : undefined;

  const contract = useMemo(() => {
    if (SELECTED_CHAIN && selectedAddress) {
      return getContract({
        client,
        chain: SELECTED_CHAIN,
        address: selectedAddress,
      });
    }
    return undefined;
  }, [selectedAddress]);

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

  // Get user data for all supported tokens - create a stable reference
  const userDataQueries = SUPPORTED_STABLECOINS.map(token => {
    const { data: deposit } = useReadContract({
      contract: contract as any,
      method: "function deposits(address, address) view returns (uint256)",
      params: [address || "0x0000000000000000000000000000000000000000", token] as const,
      queryOptions: { enabled: !!address && !!contract },
    });
    
    const { data: borrow } = useReadContract({
      contract: contract as any,
      method: "function borrows(address, address) view returns (uint256)",
      params: [address || "0x0000000000000000000000000000000000000000", token] as const,
      queryOptions: { enabled: !!address && !!contract },
    });
    
    const { data: collateral } = useReadContract({
      contract: contract as any,
      method: "function collaterals(address, address) view returns (uint256)",
      params: [address || "0x0000000000000000000000000000000000000000", token] as const,
      queryOptions: { enabled: !!address && !!contract },
    });
    
    return { token, deposit, borrow, collateral };
  });

  // Memoize the serialized data to avoid infinite loops
  const serializedData = useMemo(() => {
    return userDataQueries.map(({ token, deposit, borrow, collateral }) => ({
      token,
      deposit: deposit?.toString() || "0",
      borrow: borrow?.toString() || "0", 
      collateral: collateral?.toString() || "0"
    }));
  }, [userDataQueries.map(q => q.deposit?.toString()).join(','), 
      userDataQueries.map(q => q.borrow?.toString()).join(','),
      userDataQueries.map(q => q.collateral?.toString()).join(',')]);

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
    serializedData.forEach(({ token, deposit, borrow, collateral }) => {
      newData.deposits[token] = deposit;
      newData.borrows[token] = borrow;
      newData.collateral[token] = collateral;
      newData.lockEnds[token] = 0;
      newData.interest[token] = "0";
      newData.interestUsd[token] = "0";
      newData.borrowStartTimes[token] = 0;

      // Calculate values (assuming 1:1 USD for simplicity)
      const depositValue = parseFloat(formatAmount(deposit, token));
      const borrowValue = parseFloat(formatAmount(borrow, token));
      totalDepositValue += depositValue;
      totalBorrowValue += borrowValue;
    });

    setDashboardData(newData);
    setDepositValue(totalDepositValue.toFixed(2));
    setBorrowValue(totalBorrowValue.toFixed(2));
    setLoading(false);
  }, [address, serializedData]);
  


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