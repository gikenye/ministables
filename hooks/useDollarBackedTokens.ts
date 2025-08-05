import { useReadContract } from "thirdweb/react";
import { Contract } from "thirdweb";
import { useMemo } from "react";

export function useDollarBackedTokens(contract: Contract) {
  // Fetch dollar-backed tokens from contract
  const queries = Array.from({ length: 10 }, (_, index) => 
    useReadContract({
      contract,
      method: "function dollarBackedTokens(uint256) view returns (address)",
      params: [BigInt(index)],
    })
  );

  const dollarBackedTokens = useMemo(() => {
    const tokens: string[] = [];
    queries.forEach(query => {
      if (query?.data && query.data !== "0x0000000000000000000000000000000000000000") {
        tokens.push(query.data);
      }
    });
    return tokens;
  }, [queries.map(q => q?.data || '').join(',')]);

  const isLoading = queries.some(query => query?.isPending);

  return {
    dollarBackedTokens,
    isLoading,
    isDollarBacked: (tokenAddress: string) => 
      dollarBackedTokens.includes(tokenAddress.toLowerCase()) ||
      dollarBackedTokens.includes(tokenAddress),
  };
}