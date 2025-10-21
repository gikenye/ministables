"use client";

import { createContext, useContext, useState, useMemo, useEffect } from "react";
import { CHAINS, getTokens, getTokenInfoMap } from "@/config/chainConfig";
import { getContract } from "thirdweb";
import { client } from "@/lib/thirdweb/client";
import { useActiveWalletChain } from "thirdweb/react";

interface ChainContextType {
  chain: typeof CHAINS[0];
  setChain: (chain: typeof CHAINS[0]) => void;
  tokens: ReturnType<typeof getTokens>;
  tokenInfos: ReturnType<typeof getTokenInfoMap>;
}

const ChainContext = createContext<ChainContextType>({
  chain: CHAINS[0],
  setChain: () => {},
  tokens: [],
  tokenInfos: {},
});

export function ChainProvider({ children }: { children: React.ReactNode }) {
  const [chain, setChain] = useState(CHAINS[0]);
  const activeWalletChain = useActiveWalletChain();

  // Sync custom chain state with wallet chain changes
  useEffect(() => {
    if (activeWalletChain) {
      const matchingChain = CHAINS.find(c => c.id === activeWalletChain.id);
      if (matchingChain && matchingChain.id !== chain.id) {
        console.log(`[ChainProvider] Wallet switched to ${matchingChain.name}, updating app state`);
        setChain(matchingChain);
      }
    }
  }, [activeWalletChain?.id, chain.id]);
  
  const value = useMemo(() => {
    const tokens = getTokens(chain.id);
    const tokenInfos = getTokenInfoMap(chain.id);
    
    return {
      chain,
      setChain,
      tokens,
      tokenInfos,
    };
  }, [chain]);
  
  return (
    <ChainContext.Provider value={value}>{children}</ChainContext.Provider>
  );
}

export const useChain = () => useContext(ChainContext);
