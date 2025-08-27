"use client";
import { useState, useEffect } from "react";
import { fetchUserDashboardData } from "@/lib/services/dashboardService";

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

  // Use a single effect to load all data at once
  useEffect(() => {
    if (!address) {
      console.log("No wallet address available for dashboard data");
      setLoading(false);
      return;
    }
    
    console.log("Loading dashboard data for address:", address);
    
    const loadDashboardData = async () => {
      setLoading(true);
      
      try {
        const data = await fetchUserDashboardData(address, SUPPORTED_STABLECOINS);
        
        if (data.success) {
          setDeposits(data.deposits);
          setBorrows(data.borrows);
          setCollateral(data.collateral);
          setLockEnds(data.lockEnds);
          
          console.log("Dashboard data loaded successfully:", {
            deposits: data.deposits,
            borrows: data.borrows,
            collateral: data.collateral
          });
        } else {
          console.error("Error loading dashboard data:", data.error);
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadDashboardData();
    
    // Only re-fetch when the address changes
  }, [address]);

  return { deposits, borrows, collateral, lockEnds, poolData, loading };
}