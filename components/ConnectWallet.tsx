"use client";
import { ConnectButton, useConnect } from "thirdweb/react";
import { darkTheme } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { useEffect, useState } from "react";
import { injected } from "thirdweb/wallets";


interface ConnectWalletButtonProps {
  className?: string;
}

const wallets = [
  injected(),
  inAppWallet({
    auth: {
      options: ["google", "facebook", "farcaster", "x", "phone"],
    },
  }),
  createWallet("com.valoraapp"),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("com.trustwallet.app"),
  createWallet("walletConnect"),
];


export function ConnectWallet({ className }: ConnectWalletButtonProps) {

  const [hideConnectBtn, setHideConnectBtn] = useState(false);
  const { connect } = useConnect();

  useEffect(() => {
    // MiniPay auto-connection
    if (typeof window !== "undefined" && window.ethereum && window.ethereum.isMiniPay) {
      setHideConnectBtn(true);
      connect({ connector: injected() });
    }
  }, [connect]);



  return (
    <div className={className}>
      {!hideConnectBtn && (
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
