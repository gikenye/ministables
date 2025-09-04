"use client";
import { ConnectButton } from "thirdweb/react";
import { darkTheme } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { useEffect, useState } from "react";

interface ConnectWalletButtonProps {
  className?: string;
}

const wallets = [
  createWallet("io.metamask"),
  inAppWallet({
    auth: {
      options: ["google", "facebook", "farcaster", "x", "phone"],
    },
  }),
  createWallet("com.valoraapp"),
  createWallet("com.coinbase.wallet"),
  createWallet("com.trustwallet.app"),
  createWallet("walletConnect"),
];

const metamaskWallet = createWallet("io.metamask");


export function ConnectWallet({ className }: ConnectWalletButtonProps) {
  const [isMiniPay, setIsMiniPay] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
      metamaskWallet.connect({ client });
    }
  }, []);

  return (
    <div className={className}>
      {!isMiniPay && (
        <ConnectButton
          accountAbstraction={{
            chain: celo,
            sponsorGas: false,
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
