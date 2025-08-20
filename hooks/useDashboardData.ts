"use client";
import { useState, useEffect } from "react";
import { getContract, readContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        const contract = getContract({
          client,
          chain: celo,
          address: MINILEND_ADDRESS,
        });

        const newDeposits: Record<string, string> = {};
        const newBorrows: Record<string, string> = {};
        const newCollateral: Record<string, string> = {};
        const newLockEnds: Record<string, number> = {};
        const newPoolData: Record<string, string> = {};

        for (const token of SUPPORTED_STABLECOINS) {
          try {
            const [depositResult, borrowResult, collateralResult, totalSupplyResult] = await Promise.allSettled([
              readContract({
                contract,
                method: "function userDeposits(address, address, uint256) view returns (uint256 amount, uint256 lockEnd)",
                params: [address, token, 0n],
              }),
              readContract({
                contract,
                method: "function userBorrows(address, address) view returns (uint256)",
                params: [address, token],
              }),
              readContract({
                contract,
                method: "function userCollateral(address, address) view returns (uint256)",
                params: [address, token],
              }),
              readContract({
                contract,
                method: "function totalSupply(address) view returns (uint256)",
                params: [token],
              })
            ]);

            newDeposits[token] = depositResult.status === 'fulfilled' ? depositResult.value[0].toString() : "0";
            newLockEnds[token] = depositResult.status === 'fulfilled' ? Number(depositResult.value[1]) : 0;
            newBorrows[token] = borrowResult.status === 'fulfilled' ? borrowResult.value.toString() : "0";
            newCollateral[token] = collateralResult.status === 'fulfilled' ? collateralResult.value.toString() : "0";
            newPoolData[token] = totalSupplyResult.status === 'fulfilled' ? totalSupplyResult.value.toString() : "0";
          } catch {
            newDeposits[token] = "0";
            newBorrows[token] = "0";
            newCollateral[token] = "0";
            newLockEnds[token] = 0;
            newPoolData[token] = "0";
          }
        }

        setDeposits(newDeposits);
        setBorrows(newBorrows);
        setCollateral(newCollateral);
        setLockEnds(newLockEnds);
        setPoolData(newPoolData);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [address]);

  return { deposits, borrows, collateral, lockEnds, poolData, loading };
}