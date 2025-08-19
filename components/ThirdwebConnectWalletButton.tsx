"use client";
import { ConnectButton } from "thirdweb/react";
import { lightTheme, darkTheme } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { base, celo, scroll } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { useEffect, useState } from "react";

interface ThirdwebConnectWalletButtonProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const wallets = [
  inAppWallet({
    auth: {
      options: ["google", "phone", "email", "apple"],
    },
    // accountAbstraction: {
    //   chain: celo,
    //   sponsorGas: true, // or false, as needed 
    // },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("walletConnect"),
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

    // Check if mobile - increased threshold for better mobile detection
    const mobileQuery = window.matchMedia('(max-width: 768px)');
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
    // Base style
    const baseStyle = {
      backgroundColor: "#0e6037",
      color: "white",
      border: "none",
      fontWeight: "500" as const,
      cursor: "pointer",
      transition: "all 0.15s ease",
      touchAction: "manipulation" as const,
    };

    // Mobile-optimized sizing
    if (isMobile) {
      return {
        ...baseStyle,
        padding: "8px 16px", // Compact padding for mobile
        fontSize: "14px", // Readable but compact font size
        minHeight: "36px", // Smaller height for mobile
        borderRadius: "8px",
        width: "auto", // Let content determine width
        minWidth: "120px", // Minimum width for touch targets
        maxWidth: "200px", // Prevent overly wide buttons
      };
    }

    // Desktop sizing based on size prop
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
    <div className={`touch-action-manipulation ${className || ""}`} style={{
      // Mobile-specific container optimizations
      ...(isMobile && {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        maxWidth: "100%",
        padding: "0 4px", // Minimal side padding
      })
    }}>
      <ConnectButton
        client={client}
        chains={[celo, scroll]}
        // accountAbstraction={{
        //   chain: celo,
        //   sponsorGas: false,
        // }}
        connectButton={{
          label: "Launch App",
          style: getButtonStyle(),
        }}
        connectModal={{
          showThirdwebBranding: false,
          size: "compact",
          title: "Minilend :)",
          titleIcon:
            "https://ministables.vercel.app/minilend-logo.png",
        }}
        theme={getTheme()}
        wallets={wallets}
      />
    </div>
  );
}