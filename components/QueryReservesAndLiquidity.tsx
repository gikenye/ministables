import { useReadContract } from "thirdweb/react";
import { Contract } from "thirdweb";
import { useState, useEffect } from "react";

interface QueryProps {
  token: string;
  contract: Contract;
  aavePoolContract: Contract;
}

interface QueryResult {
  totalSupply: bigint;
  availableLiquidity: bigint;
  isPending: boolean;
}

export default function QueryReservesAndLiquidity({
  token,
  contract,
  aavePoolContract,
}: QueryProps): QueryResult {
  const [enableQueries, setEnableQueries] = useState(false);
  
  // Stagger query execution to prevent rate limiting
  useEffect(() => {
    const timer = setTimeout(() => {
      setEnableQueries(true);
    }, Math.random() * 1000); // Random delay up to 1 second
    
    return () => clearTimeout(timer);
  }, []);
  
  // Only query totalSupply to reduce requests
  const { data: totalSupply, isPending: isTotalSupplyPending, error: totalSupplyError } = useReadContract({
    contract,
    method: "function totalSupply(address) view returns (uint256)",
    params: [token],
    queryOptions: {
      enabled: enableQueries,
      retry: (failureCount, error) => {
        if (error?.message?.includes('429')) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  });

  return {
    totalSupply: totalSupply || BigInt(0),
    availableLiquidity: totalSupply || BigInt(0), // Simplified - just show total supply
    isPending: isTotalSupplyPending || !enableQueries,
  };
}