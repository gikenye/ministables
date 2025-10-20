"use client";
import { useConnect, useActiveAccount } from "thirdweb/react";
import { ConnectButton, darkTheme, lightTheme } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { useChain } from "@/components/ChainProvider";
import { client } from "@/lib/thirdweb/client";
import { useEffect, useState } from "react";
import { CHAINS } from "@/config/chainConfig";
import { useTheme } from "next-themes";

const wallets = [
  inAppWallet({
    executionMode: {
      mode: "EIP4337",
      // smartAccount: {
      //   sponsorGas: true,
      //   chain: useChain(),
      // },
    },
    auth: { options: ["google", "farcaster", "phone", "email"] },
  }),
  createWallet("com.valoraapp"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
];

export function ConnectWallet({ className }: { className?: string }) {
  const account = useActiveAccount();
  const [isMiniPay, setIsMiniPay] = useState(false);
  const { chain, setChain } = useChain();
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
    }
  }, []);

  const shouldShowButton = !account || !isMiniPay;

  // Use resolvedTheme to get the actual theme (light or dark) accounting for system preference
  const currentTheme = mounted ? resolvedTheme : "dark";

  return (
    <ConnectButton
      client={client}
      chains={CHAINS}
      wallets={wallets}
      connectButton={{
        label: "Sign in",
        className:
          "rounded-full px-4 py-2 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/60 bg-gradient-to-r from-primary to-card text-primary-foreground",
      }}
      connectModal={{
        showThirdwebBranding: false,
        size: "compact",
        title: "Minilend",
        titleIcon: "https://www.minilend.xyz/static/new-logo.png",
      }}
      theme={
        currentTheme === "dark"
          ? darkTheme({
              colors: {
                modalBg: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                accentText: "hsl(var(--primary))",
                primaryButtonBg: "hsl(var(--primary))",
                primaryButtonText: "hsl(var(--primary-foreground))",
                secondaryButtonBg: "hsl(var(--secondary))",
                secondaryButtonText: "hsl(var(--secondary-foreground))",
                connectedButtonBg: "hsl(var(--card))",
                connectedButtonBgHover: "hsl(var(--accent))",
                separatorLine: "hsl(var(--border))",
              },
            })
          : lightTheme({
              colors: {
                modalBg: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                accentText: "hsl(var(--primary))",
                primaryButtonBg: "hsl(var(--primary))",
                primaryButtonText: "hsl(var(--primary-foreground))",
                secondaryButtonBg: "hsl(var(--secondary))",
                secondaryButtonText: "hsl(var(--secondary-foreground))",
                connectedButtonBg: "hsl(var(--card))",
                connectedButtonBgHover: "hsl(var(--accent))",
                separatorLine: "hsl(var(--border))",
              },
            })
      }
    />
  );
}
