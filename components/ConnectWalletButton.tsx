"use client";

import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";

export function ConnectWalletButton({ className }: { className?: string }) {
  const { connect, isConnecting, error } = useWallet();

  return (
    <div>
      <Button
        onClick={async () => {
          console.log("[ConnectWalletButton] Initiating wallet connection");
          const address = await connect();
          if (address) {
            console.log("[ConnectWalletButton] Connected address:", address);
          }
        }}
        disabled={isConnecting}
        className={className}
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}