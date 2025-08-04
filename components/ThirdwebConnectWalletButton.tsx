"use client";
import { ConnectButton } from "thirdweb/react";
import { lightTheme, darkTheme } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { useEffect, useState } from "react";

interface ThirdwebConnectWalletButtonProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const wallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
];

export function ThirdwebConnectWalletButton({ className, size = "md" }: ThirdwebConnectWalletButtonProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check initial theme preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);

    // Check if mobile
    const mobileQuery = window.matchMedia('(max-width: 480px)');
    setIsMobile(mobileQuery.matches);

    // Listen for theme changes
    const handleThemeChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    // Listen for mobile changes
    const handleMobileChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    mobileQuery.addEventListener('change', handleMobileChange);

    // Cleanup listeners on component unmount
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
      mobileQuery.removeEventListener('change', handleMobileChange);
    };
  }, []);

  const getButtonStyle = () => {
    // Base mobile-first approach - let CSS handle the responsive styling
    const baseStyle = {
      backgroundColor: "#0e6037",
      color: "white",
      border: "none",
      fontWeight: "500" as const,
      cursor: "pointer",
      transition: "all 0.15s ease", // Faster for mobile performance
      touchAction: "manipulation" as const, // Better touch response
    };

    // Only apply size styles for non-mobile or when explicitly needed
    if (!isMobile) {
      switch (size) {
        case "sm":
          return {
            ...baseStyle,
            padding: "6px 12px",
            fontSize: "12px",
            minHeight: "36px",
            borderRadius: "6px",
          };
        case "lg":
          return {
            ...baseStyle,
            padding: "12px 24px",
            fontSize: "16px",
            minHeight: "48px",
            borderRadius: "12px",
            width: "100%",
          };
        default:
          return {
            ...baseStyle,
            padding: "8px 16px",
            fontSize: "14px",
            minHeight: "40px",
            borderRadius: "8px",
          };
      }
    }

    // Mobile gets minimal inline styles - CSS media queries handle the rest
    return baseStyle;
  };

  const getTheme = () => {
    const commonColors = {
      primaryButtonBg: "#0e6037",
      primaryButtonText: "#ffffff",
    };

    if (isDarkMode) {
      return darkTheme({
        colors: {
          ...commonColors,
          modalBg: "hsl(150, 19%, 15%)", // Darker for better mobile contrast
          accentText: "hsl(173, 100%, 55%)", // Slightly less bright for mobile
          borderColor: "#374151",
          secondaryText: "#9ca3af",
          primaryText: "#ffffff",
        },
      });
    } else {
      return lightTheme({
        colors: {
          ...commonColors,
          accentText: "#0e6037",
          borderColor: "#e5e7eb",
          modalBg: "#ffffff",
          secondaryText: "#6b7280",
          primaryText: "#1f2937",
        },
      });
    }
  };

  return (
    <div className={`touch-action-manipulation ${className || ""}`}>
      <ConnectButton
        client={client}
        chain={celo}
        connectButton={{
          label: isMobile ? "Connect" : "Connect Wallet", // Shorter label for mobile
          style: getButtonStyle()
        }}
        connectModal={{
          showThirdwebBranding: false,
          size: isMobile ? "compact" : "compact",
          title: "Minilend",
          titleIcon: "https://ministables.vercel.app/minilend-logo.png",
        }}
        theme={getTheme()}
        wallets={wallets}
      />
    </div>
  );
}