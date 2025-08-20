import { useReadContract } from "thirdweb/react";
import { useMemo } from "react";
import { useMinilendContract } from "./useMinilendContract";

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
  const contract = useMinilendContract();

  // Read all data for each token
  const reads = SUPPORTED_STABLECOINS.map((token) => ({
    token,
    deposit: useReadContract({
      contract,
      method: "function userDeposits(address, address, uint256) view returns (uint256 amount, uint256 lockEnd)",
      params: [address, token, 0n],
      queryOptions: { enabled: !!address },
    }),
    borrow: useReadContract({
      contract,
      method: "function userBorrows(address, address) view returns (uint256)",
      params: [address, token],
      queryOptions: { enabled: !!address },
    }),
    collateral: useReadContract({
      contract,
      method: "function userCollateral(address, address) view returns (uint256)",
      params: [address, token],
      queryOptions: { enabled: !!address },
    }),
    totalSupply: useReadContract({
      contract,
      method: "function totalSupply(address) view returns (uint256)",
      params: [token],
    }),
  }));

  // Compose the dashboard data
  const userData = useMemo(() => {
    const deposits: Record<string, string> = {};
    const borrows: Record<string, string> = {};
    const collateral: Record<string, string> = {};
    const lockEnds: Record<string, number> = {};
    const poolData: Record<string, string> = {};

    for (const { token, deposit, borrow, collateral: collat, totalSupply } of reads) {
      deposits[token] = deposit.data?.[0]?.toString() || "0";
      lockEnds[token] = Number(deposit.data?.[1] || 0);
      borrows[token] = borrow.data?.toString() || "0";
      collateral[token] = collat.data?.toString() || "0";
      poolData[token] = totalSupply.data?.toString() || "0";
    }

    return { deposits, borrows, collateral, lockEnds, poolData };
  }, [reads]);

  // Loading state: true if any read is loading
  const loading = reads.some(
    ({ deposit, borrow, collateral: collat, totalSupply }) =>
      deposit.isLoading || borrow.isLoading || collat.isLoading || totalSupply.isLoading
  );

  return { ...userData, loading };
}