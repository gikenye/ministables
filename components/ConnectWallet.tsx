"use client";
import { useConnect, useActiveAccount } from "thirdweb/react";
import { ConnectButton, darkTheme } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { inAppWallet } from "thirdweb/wallets/in-app";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { useEffect } from "react";



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

// Function to detect if the environment is MiniPay
const isMiniPayEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  return !!(window.ethereum?.isMiniPay);
};


export function ConnectWallet({ className }) {
  const { connect } = useConnect();
  const account = useActiveAccount();

  useEffect(() => {
    // Detect injected provider (MiniPay or similar)
    const isInjectedProvider = typeof window !== "undefined" && !!window.ethereum;

    // If injected provider is present and no account is active, connect automatically
    if (isInjectedProvider && !account) {
      connect(async () => {
        const injected = createWallet("io.metamask");
        await injected.connect({ client });
        return injected;
      });
    }
  }, [connect, account]);

  // Hide connect button only in MiniPay when a wallet is connected
  // In normal browsers, always show the button to allow switching/disconnecting
  const shouldShowConnectButton = !account || !isMiniPayEnvironment();

  return (
    <div className={className}>
      {shouldShowConnectButton && (
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

