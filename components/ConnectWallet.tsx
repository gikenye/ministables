"use client";
import { useConnect, useActiveAccount } from "thirdweb/react";
import { ConnectButton, darkTheme } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { useChain } from "@/components/ChainProvider";
import { client } from "@/lib/thirdweb/client";
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

export function ConnectWallet({ className }: { className?: string }) {
  const account = useActiveAccount();
  const [isMiniPay, setIsMiniPay] = useState(false);
  const { chain, setChain } = useChain();

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
    }
  }, []);

  const shouldShowButton = !account || !isMiniPay;

  return (
    <ConnectButton
      client={client}
      chains={CHAINS}
      wallets={wallets}
      connectButton={{
        label: "Sign in",
        className:
          "rounded-full px-4 py-2 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#54d22d]/60 bg-gradient-to-r from-[#54d22d] to-[#2e4328] text-white",
      }}
      connectModal={{
        showThirdwebBranding: false,
        size: "compact",
        title: "Minilend",
        titleIcon: "/minilend-pwa.png",
      }}
      theme={darkTheme({
        colors: {
          modalBg: "#33280aff",
          borderColor: "#000000ff",
          accentText: "#654f3eff",
          primaryButtonBg: "#0e4a62ff",
          primaryButtonText: "#ffffffff",
        },
      })}
    />
  );
}
