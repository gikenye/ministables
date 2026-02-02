"use client";
import { useConnect, useActiveAccount } from "thirdweb/react";
import { ConnectButton, darkTheme } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { useChain } from "@/components/ChainProvider";
import { client } from "@/lib/thirdweb/client";
import { theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { CHAINS } from "@/config/chainConfig";

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

const getIsMiniPay = () =>
  typeof window !== "undefined" && Boolean(window.ethereum?.isMiniPay);

export function ConnectWallet({ className }: { className?: string }) {
  const account = useActiveAccount();
  const [isMiniPay, setIsMiniPay] = useState(getIsMiniPay);
  const { chain, setChain } = useChain();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleProviderUpdate = () => {
      const nextIsMiniPay = getIsMiniPay();
      setIsMiniPay((current) =>
        current === nextIsMiniPay ? current : nextIsMiniPay
      );
    };

    window.addEventListener("ethereum#initialized", handleProviderUpdate, {
      once: true,
    });
    window.ethereum?.on?.("connect", handleProviderUpdate);
    window.ethereum?.on?.("disconnect", handleProviderUpdate);

    return () => {
      window.removeEventListener("ethereum#initialized", handleProviderUpdate);
      window.ethereum?.removeListener?.("connect", handleProviderUpdate);
      window.ethereum?.removeListener?.("disconnect", handleProviderUpdate);
    };
  }, []);

  const shouldShowButton = !account || !isMiniPay;
  const buttonClassName = cn(
    "rounded-full px-5 py-3 text-sm font-semibold shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 border border-emerald-400/40 bg-emerald-500/20 text-white backdrop-blur-sm hover:bg-emerald-500/35",
    className
  );

  return (
    <ConnectButton
      client={client}
      chains={CHAINS}
      wallets={wallets}
      connectButton={{
        label: "Sign in",
        className: buttonClassName,
      }}
      connectModal={{
        showThirdwebBranding: false,
        size: "compact",
        title: "Minilend",
        titleIcon: "/minilend-pwa.png",
      }}
      theme={darkTheme({
        colors: {
          modalBg: theme.colors.backgroundDark,
          borderColor: theme.colors.borderLight,
          accentText: theme.colors.accent,
          primaryButtonBg: theme.colors.accent,
          primaryButtonText: theme.colors.text,
        },
      })}
    />
  );
}
