"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";
import { WalletConnectionModal } from "./WalletConnectionModal";

export function ConnectWalletButton({ className }: { className?: string }) {
  const { connect, isConnecting, error, isConnected, address, disconnect } = useWallet();
  const [showModal, setShowModal] = useState(false);

  const handleConnect = async (address: string, signature: string, provider: string) => {
    console.log("[ConnectWalletButton] Connected:", { address, provider });
    // Connection is handled by the modal and wallet context
  };

  if (isConnected && address) {
    return (
      <div>
        <Button
          onClick={disconnect}
          variant="outline"
          className={className}
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button
        onClick={() => setShowModal(true)}
        disabled={isConnecting}
        className={className}
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      
      <WalletConnectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConnect={handleConnect}
      />
    </div>
  );
}