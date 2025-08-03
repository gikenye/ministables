"use client";

import { ConnectButton } from "thirdweb/react";
import { darkTheme } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { celo } from "thirdweb/chains";
import {client} from "@/lib/thirdweb/client";

interface ThirdwebConnectWalletButtonProps {
  className?: string;
}


const wallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
];

export function ThirdwebConnectWalletButton({ className }: ThirdwebConnectWalletButtonProps) {
  return (
    <ConnectButton
      client={client}
      chain={celo}
      connectButton={{ label: "Connect Wallet" }}
      connectModal={{
        showThirdwebBranding: false,
        size: "compact",
        title: "Minilend :)",
        titleIcon: "https://ministables.vercel.app/minilend-logo.png",
      }}
      theme={darkTheme({
        colors: {
          modalBg: "hsl(150, 19%, 19%)",
          accentText: "hsl(173, 100%, 60%)",
        },
      })}
      wallets={wallets}
    />
  );
}