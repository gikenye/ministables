"use client";
import { useConnect, useActiveAccount } from "thirdweb/react";
import { ConnectButton, darkTheme } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { inAppWallet } from "thirdweb/wallets/in-app";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { useEffect, useState } from "react";



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


export function ConnectWallet({ className }) {
  const { connect } = useConnect();
  const account = useActiveAccount();
  const [hideConnectBtn, setHideConnectBtn] = useState(false);

  useEffect(() => {
    // Detect if we're in MiniPay environment
    const isMiniPay = typeof window !== "undefined" && 
                      window.ethereum && 
                      window.ethereum.isMiniPay;

    // Auto-connect only in MiniPay environment
    if (isMiniPay && !account) {
      connect(async () => {
        const injected = createWallet("io.metamask");
        await injected.connect({ client });
        return injected;
      });
    }

    // Hide connect button only in MiniPay when wallet is connected
    setHideConnectBtn(isMiniPay && !!account);
  }, [connect, account]);

  // Show connect button unless we're in MiniPay with connected wallet
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

