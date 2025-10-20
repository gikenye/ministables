"use client";

import { useActiveAccount } from "thirdweb/react";
import { useChain } from "@/components/ChainProvider";
import { useEffect, useState } from "react";

export function ChainDebug() {
  const account = useActiveAccount();
  const { chain: customChain } = useChain();
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

  useEffect(() => {
    if (account && (window as any).ethereum) {
      // Get the current wallet chain ID
      const checkWalletChain = async () => {
        try {
          const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
          setWalletChainId(parseInt(chainId, 16));
        } catch (error) {
          console.error('Failed to get wallet chain:', error);
        }
      };

      checkWalletChain();

      // Listen for chain changes
      const handleChainChanged = (chainId: string) => {
        setWalletChainId(parseInt(chainId, 16));
      };

      (window as any).ethereum.on('chainChanged', handleChainChanged);

      return () => {
        (window as any).ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [account]);

  if (!account) return null;

  const isChainMismatch = walletChainId && customChain.id !== walletChainId;

  return (
    <div className="bg-warning/20 border border-warning text-foreground p-3 rounded-xl text-sm mb-4">
      <h4 className="font-semibold mb-2">🔍 Chain Debug Info</h4>
      <div className="space-y-1 text-xs">
        <div>Custom Chain Provider: {customChain.name} (ID: {customChain.id})</div>
        <div>Wallet Chain ID: {walletChainId || 'Loading...'}</div>
        {isChainMismatch && (
          <div className="text-destructive-foreground font-bold">
            ⚠️ MISMATCH DETECTED! Your app thinks you're on {customChain.name} but your wallet is on chain {walletChainId}
          </div>
        )}
        {!isChainMismatch && walletChainId && (
          <div className="text-foreground">✅ Chains are synchronized</div>
        )}
      </div>
    </div>
  );
}