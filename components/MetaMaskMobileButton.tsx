"use client";

import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import {
  isMobileDevice,
  isMetaMaskInstalled,
  openMetaMaskMobile,
} from "@/lib/metamask";

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
}

export function MetaMaskMobileButton({
  chainId = "42220", // Default to Celo Mainnet
  className,
  variant = "default",
  size = "default",
}: MetaMaskMobileButtonProps) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Only show the button on mobile devices without MetaMask
    setShouldShow(isMobileDevice() && !isMetaMaskInstalled());
  }, []);

  // Don't render anything if we shouldn't show the button
  if (!shouldShow) {
    return null;
  }

  const handleOpenMetaMask = () => {
    openMetaMaskMobile({ chainId });
  };

  return (
    <Button
      onClick={handleOpenMetaMask}
      className={className}
      variant={variant}
      size={size}
    >
      Open MetaMask App
    </Button>
  );
}
