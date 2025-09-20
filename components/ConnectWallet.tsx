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
  const [isMiniPay, setIsMiniPay] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
    }
  }, []);



  // Only hide the button if in MiniPay and account is connected
  const shouldShowButton = !account || !isMiniPay;

  return (
    <div className={className}>
      {shouldShowButton && (
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


