"use client";

import { createContext, useContext, useState, useMemo } from "react";
import { CHAINS, getContractAddress, getTokens, getTokenInfoMap } from "@/config/chainConfig";
import { getContract } from "thirdweb";
import { client } from "@/lib/thirdweb/client";

interface ChainContextType {
  chain: typeof CHAINS[0];
  setChain: (chain: typeof CHAINS[0]) => void;
  contractAddress: string;
  contract: any;
  tokens: ReturnType<typeof getTokens>;
  tokenInfos: ReturnType<typeof getTokenInfoMap>;
}

const ChainContext = createContext<ChainContextType>({
  chain: CHAINS[0],
  setChain: () => {},
  contractAddress: "",
  contract: null,
  tokens: [],
  tokenInfos: {},
});

export function ChainProvider({ children }: { children: React.ReactNode }) {
  const [chain, setChain] = useState(CHAINS[0]);
  
  const value = useMemo(() => {
    const contractAddress = getContractAddress(chain.id);
    const contract = getContract({
      client,
      chain,
      address: contractAddress,
    });
    const tokens = getTokens(chain.id);
    const tokenInfos = getTokenInfoMap(chain.id);
    
    return {
      chain,
      setChain,
      contractAddress,
      contract,
      tokens,
      tokenInfos,
    };
  }, [chain]);
  
  return (
    <ChainContext.Provider value={value}>{children}</ChainContext.Provider>
  );
}

export const useChain = () => useContext(ChainContext);
