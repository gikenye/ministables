import { useChain } from "@/components/ChainProvider";
import { getContract } from "thirdweb";
import { client } from "@/lib/thirdweb/client";

export function useContractOperations() {
  const { chain, contractAddress, tokenInfos } = useChain();

  const getTokenContract = (tokenAddress: string) => {
    return getContract({
      client,
      chain,
      address: tokenAddress,
    });
  };

  const getTokenInfo = (tokenAddress: string) => {
    return tokenInfos[tokenAddress] || { symbol: "UNKNOWN", decimals: 18 };
  };

  return {
    chain,
    contractAddress,
    tokenInfos,
    getTokenContract,
    getTokenInfo,
  };
}