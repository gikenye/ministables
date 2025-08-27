"use client";
import { useState, useEffect } from "react";
import { client } from "@/lib/thirdweb/client";
import { celo } from "thirdweb/chains";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";
import { useReadContract } from "thirdweb/react";

const SUPPORTED_STABLECOINS = [
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
  "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", // cREAL
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", // cKES
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3", // USDGLO
];

export function useDashboardData(address: string | undefined) {
  const [deposits, setDeposits] = useState<Record<string, string>>({});
  const [borrows, setBorrows] = useState<Record<string, string>>({});
  const [collateral, setCollateral] = useState<Record<string, string>>({});
  const [lockEnds, setLockEnds] = useState<Record<string, number>>({});
  const [poolData, setPoolData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Create batch contract reads
  const userDepositBatch = SUPPORTED_STABLECOINS.map(token => {
    return useReadContract({
      contract: {
        client,
        chain: celo,
        address: MINILEND_ADDRESS,
      },
      method: "function userDeposits(address, address, uint256) view returns (uint256 amount, uint256 lockEnd)",
      params: [address || "0x0000000000000000000000000000000000000000", token, 0n],
      queryOptions: {
        enabled: !!address,
      }
    });
  });

  const userBorrowBatch = SUPPORTED_STABLECOINS.map(token => {
    return useReadContract({
      contract: {
        client,
        chain: celo,
        address: MINILEND_ADDRESS,
      },
      method: "function userBorrows(address, address) view returns (uint256)",
      params: [address || "0x0000000000000000000000000000000000000000", token],
      queryOptions: {
        enabled: !!address,
      }
    });
  });

  const userCollateralBatch = SUPPORTED_STABLECOINS.map(token => {
    return useReadContract({
      contract: {
        client,
        chain: celo,
        address: MINILEND_ADDRESS,
      },
      method: "function userCollateral(address, address) view returns (uint256)",
      params: [address || "0x0000000000000000000000000000000000000000", token],
      queryOptions: {
        enabled: !!address,
      }
    });
  });

  const totalSupplyBatch = SUPPORTED_STABLECOINS.map(token => {
    return useReadContract({
      contract: {
        client,
        chain: celo,
        address: MINILEND_ADDRESS,
      },
      method: "function totalSupply(address) view returns (uint256)",
      params: [token],
      queryOptions: {
        enabled: !!address,
      }
    });
  });

  // Process data when available
  useEffect(() => {
    if (!address) {
      console.log("No wallet address available for dashboard data");
      setLoading(false);
      return;
    }
    
    console.log("Loading dashboard data for address:", address);

    const allDataReady = [
      ...userDepositBatch, 
      ...userBorrowBatch, 
      ...userCollateralBatch,
      ...totalSupplyBatch
    ].every(item => !item.isPending);

    if (!allDataReady) return;

    try {
      const newDeposits: Record<string, string> = {};
      const newBorrows: Record<string, string> = {};
      const newCollateral: Record<string, string> = {};
      const newLockEnds: Record<string, number> = {};
      const newPoolData: Record<string, string> = {};

      // Process deposits and lock ends
      userDepositBatch.forEach((result, index) => {
        const token = SUPPORTED_STABLECOINS[index];
        if (result.data) {
          newDeposits[token] = result.data[0].toString();
          newLockEnds[token] = Number(result.data[1]);
        } else {
          newDeposits[token] = "0";
          newLockEnds[token] = 0;
        }
      });

      // Process borrows
      userBorrowBatch.forEach((result, index) => {
        const token = SUPPORTED_STABLECOINS[index];
        newBorrows[token] = result.data ? result.data.toString() : "0";
      });

      // Process collateral
      userCollateralBatch.forEach((result, index) => {
        const token = SUPPORTED_STABLECOINS[index];
        newCollateral[token] = result.data ? result.data.toString() : "0";
      });

      // Process total supply
      totalSupplyBatch.forEach((result, index) => {
        const token = SUPPORTED_STABLECOINS[index];
        newPoolData[token] = result.data ? result.data.toString() : "0";
      });

      setDeposits(newDeposits);
      setBorrows(newBorrows);
      setCollateral(newCollateral);
      setLockEnds(newLockEnds);
      setPoolData(newPoolData);
      
      console.log("Dashboard data loaded successfully:", {
        deposits: newDeposits,
        borrows: newBorrows,
        collateral: newCollateral
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [address, userDepositBatch, userBorrowBatch, userCollateralBatch, totalSupplyBatch]);

  return { deposits, borrows, collateral, lockEnds, poolData, loading };
}