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
      connectButton={{ label: "sign in" }}
      connectModal={{
        showThirdwebBranding: false,
        size: "compact",
        title: "Minilend",
        titleIcon: "https://www.minilend.xyz/static/new-logo.png"
      }}
      theme={darkTheme({
        colors: {
          modalBg: "hsl(148, 19%, 15%)",
          borderColor: "hsl(217, 19%, 27%)",
          accentText: "hsl(193, 100%, 55%)",
          primaryButtonBg: "hsl(150, 75%, 22%)",
          primaryButtonText: "hsl(0, 0%, 100%)",
        },
      })}
    />
  );
}
