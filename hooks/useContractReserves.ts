import { useReadContract } from "thirdweb/react";
import { Contract } from "thirdweb";
import { useMemo } from "react";

export function useContractReserves(contract: Contract, tokenAddress: string, userAddress?: string) {
  const { data, isPending } = useReadContract({
    contract,
    method: "function contractReserves(address, address) view returns (uint256)",
    params: [tokenAddress, userAddress || "0x0000000000000000000000000000000000000000"],
  });

  return {
    reserves: data?.toString() || "0",
    hasLiquidity: data ? data > BigInt(0) : false,
    isPending,
  };
}

export function useTokensWithLiquidity(
  contract: Contract, 
  tokens: string[], 
  userAddress?: string
) {
  const reserveQueries = tokens.map(token => 
    useContractReserves(contract, token, userAddress)
  );

  const tokensWithLiquidity = useMemo(() => {
    if (!tokens.length) return [];
    return tokens.filter((_, index) => {
      const query = reserveQueries[index];
      return query && !query.isPending && query.hasLiquidity;
    });
  }, [tokens.join(','), reserveQueries.map(q => `${q.isPending}-${q.hasLiquidity}`).join(',')]);

  const isLoading = reserveQueries.some(query => query?.isPending);

  return {
    tokensWithLiquidity,
    isLoading,
  };
}