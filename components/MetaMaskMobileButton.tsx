"use client";

import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import {
  isMobileDevice,
  isMetaMaskInstalled,
  openMetaMaskMobile,
} from "@/lib/metamask";
import { useWallet } from "@/lib/wallet";
import { ensureCeloNetwork } from "@/lib/contract";

interface MetaMaskMobileButtonProps {
  chainId?: string;
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  onConnected?: () => void;
}

export function MetaMaskMobileButton({
  chainId = "42220", // Default to Celo Mainnet
  className,
  variant = "default",
  size = "default",
  onConnected,
}: MetaMaskMobileButtonProps) {
  const { connect } = useWallet();
  const [shouldShow, setShouldShow] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Show on all mobile devices for better UX
    setShouldShow(isMobileDevice());
  }, []);

  // Don't render anything if we shouldn't show the button
  if (!shouldShow) {
    return null;
  }

  const handleOpenMetaMask = async () => {
    setIsConnecting(true);
    
    try {
      // Open MetaMask and wait for user to return
      await openMetaMaskMobile({ chainId });
      
      // When user returns, try to connect the wallet
      await connect();
      
      // Ensure we're on the Celo network
      await ensureCeloNetwork();
      
      // Call the onConnected callback if provided
      if (onConnected) {
        onConnected();
      }
    } catch (error) {
      console.error("Error connecting with MetaMask mobile:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Button
      onClick={handleOpenMetaMask}
      className={className}
      variant={variant}
      size={size}
      disabled={isConnecting}
    >
      {isConnecting ? "Connecting..." : "Connect with MetaMask"}
    </Button>
  );
}
