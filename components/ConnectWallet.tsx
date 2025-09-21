"use client";
import { useConnect, useActiveAccount } from "thirdweb/react";
import { ConnectButton, darkTheme } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { celo, scroll } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { useEffect, useState } from "react";

// You can pass supported chains to the ConnectButton as the `chains` prop.
// If you want Scroll (L2 mainnet) and Celo, import both.
const supportedChains = [celo, scroll];

// Define wallets, including inAppWallet with smart account config for the default chain (e.g. Celo).
const wallets = [
  createWallet("io.metamask"),
  inAppWallet({
    executionMode: {
      mode: "EIP4337",
      smartAccount: {
        // You can optionally prompt user to choose a chain, here set Celo as the default for smart AA.
        chain: celo,
        sponsorGas: true,
      },
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

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
    }
  }, []);

  const shouldShowButton = !account || !isMiniPay;

  return (
    <div className={className}>
      {shouldShowButton && (
        <ConnectButton
          client={client}
          chains={supportedChains}
          wallets={wallets}
          connectButton={{ label: "sign in" }}
          accountAbstraction={{
            // Set the preferred chain for account abstraction
            chain: celo,
            sponsorGas: true,
          }}
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
        />
      )}
    </div>
  );
}
