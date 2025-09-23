import { useMemo } from "react";
import { getContract } from "thirdweb";
import { useChain } from "@/components/ChainProvider";
import { client } from "@/lib/thirdweb/client";

export function useChainContract() {
  const { chain, contractAddress } = useChain();
  
  return useMemo(() => {
    return getContract({
      client,
      chain,
      address: contractAddress,
    });
  }, [chain, contractAddress]);
}