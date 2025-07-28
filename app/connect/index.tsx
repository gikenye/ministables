"use client";
import { createThirdwebClient } from "thirdweb";
import { ConnectButton } from "thirdweb/react";
import { darkTheme } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";

const client = createThirdwebClient({
  clientId: "....",
});

const wallets = [
  inAppWallet({
    auth: {
      options: [
        // "google",
        // "discord",
        // "telegram",
        // "farcaster",
        // "email",
        // "x",
        // "passkey",
        // "phone",
      ],
    },
  }),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
];

export default function Connect() {
  return (
    <ConnectButton
      client={client}
      connectButton={{ label: "Connect Wallet" }}
      connectModal={{
        showThirdwebBranding: false,
        size: "compact",
        title: "  Minilend :)",
        titleIcon: "https://ministables.vercel.app/minilend-logo.png",
      }}
      theme={darkTheme({
        colors: {
          accentText: "hsl(150, 100%, 27%)",
          modalBg: "hsl(68, 72.20%, 22.50%)",
          borderColor: "hsl(228, 12%, 17%)",
          primaryButtonBg: "hsl(150, 100%, 27%)",
          primaryButtonText: "hsl(240, 6%, 94%)",
          selectedTextBg: "hsl(240, 6%, 94%)",
          accentButtonBg: "hsl(99, 34%, 49%)",
        },
      })}
      wallets={wallets}
    />
  );
}
