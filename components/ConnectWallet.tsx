"use client";
import { ConnectButton, useConnect } from "thirdweb/react";
import { darkTheme } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { inAppWallet } from "thirdweb/wallets/in-app";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { useEffect, useState } from "react";

interface ConnectWalletButtonProps {
  className?: string;
}

const wallets = [
  createWallet("io.metamask"),
  inAppWallet({
    // Celo does not support EIP-7702 — use EIP-4337 smart accounts instead.
    // Note: EIP-4337 creates a smart contract account (different address from EOA).
    executionMode: {
      mode: "EIP4337",
      smartAccount: {
        chain: celo,
        sponsorGas: true,
      },
    },
    auth: {
      options: ["google", "farcaster", "phone", "email"],
    },
  }),
  createWallet("com.valoraapp"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
];

const miniPayWallet = createWallet("io.metamask");


export function ConnectWallet({ className }: ConnectWalletButtonProps) {
  const [hideConnectBtn, setHideConnectBtn] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum && window.ethereum.isMiniPay) {
      setHideConnectBtn(true);
      miniPayWallet.connect({ client });
    }
  }, []);



  return (
    <div className={className}>
      {!hideConnectBtn && (
        <ConnectButton
          accountAbstraction={{
            chain: celo,
            sponsorGas: true,
          }}
          client={client}
          connectButton={{ label: "sign in" }}
          connectModal={{
            showThirdwebBranding: false,
            size: "compact",
            title: "Minilend",
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
          wallets={wallets}
        />
      )}
    </div>
  );
}
