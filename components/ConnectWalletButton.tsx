"use client";

import { Button } from "./ui/button";
import { useWallet } from "@/lib/wallet";
import { MetaMaskMobileButton } from "./MetaMaskMobileButton";
import { isMobileDevice, isMetaMaskInstalled } from "@/lib/metamask";
import { useEffect, useState } from "react";
import { ensureCeloNetwork } from "@/lib/contract";

interface ConnectWalletButtonProps {
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ConnectWalletButton({
  className,
  variant = "default",
  size = "default",
}: ConnectWalletButtonProps) {
  const { isConnected, connect, disconnect, isConnecting, address, error } =
    useWallet();
  const [showMobileButton, setShowMobileButton] = useState(false);

  useEffect(() => {
    // Only show the mobile button on mobile devices without MetaMask
    setShowMobileButton(isMobileDevice() && !isMetaMaskInstalled());
  }, []);

  if (isConnected) {
    return (
      <Button
        onClick={disconnect}
        className={className}
        variant={variant}
        size={size}
      >
        Disconnect{" "}
        {address
          ? `(${address.substring(0, 6)}...${address.substring(address.length - 4)})`
          : ""}
      </Button>
    );
  }

  // Show MetaMask mobile button for mobile users without MetaMask
  if (showMobileButton) {
    return (
      <MetaMaskMobileButton
        className={className}
        variant={variant}
        size={size}
      />
    );
  }

  const handleConnect = async () => {
    try {
      await connect();
      
      // After connecting, ensure we're on the Celo network
      if (isConnected) {
        await ensureCeloNetwork();
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  return (
    <Button
      onClick={handleConnect}
      className={className}
      variant={variant}
      size={size}
      disabled={isConnecting}
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </Button>
  );
}
