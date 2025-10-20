"use client";
import { createThirdwebClient } from "thirdweb";
import { ConnectButton } from "thirdweb/react";
import { darkTheme, lightTheme } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { ethereum, celo, scroll } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

// const client = createThirdwebClient({
//   clientId: "....",
// });

const wallets = [
  inAppWallet({
    auth: {
      options: ["google", "telegram", "farcaster", "x", "phone"],
    },
    // accountAbstraction: {
    //   chain: celo,
    //   sponsorGas: true, // or false, as needed
    // },
  }),
  createWallet("com.valoraapp"),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("com.trustwallet.app"),
  createWallet("walletConnect"),
];

export default function Mayday() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? resolvedTheme : "dark";

  return (
    <ConnectButton
      accountAbstraction={{
        chain: celo,
        sponsorGas: true,
      }}
      client={client}
      connectButton={{ label: "Launch App" }}
      connectModal={{
        showThirdwebBranding: false,
        size: "compact",
        title: "Minilend :)",
        titleIcon: "https://ministables.vercel.app/minilend-logo.png",
      }}
      theme={
        currentTheme === "dark"
          ? darkTheme({
              colors: {
                modalBg: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                accentText: "hsl(var(--primary))",
                primaryButtonBg: "hsl(var(--primary))",
                primaryButtonText: "hsl(var(--primary-foreground))",
                secondaryButtonBg: "hsl(var(--secondary))",
                secondaryButtonText: "hsl(var(--secondary-foreground))",
                connectedButtonBg: "hsl(var(--card))",
                connectedButtonBgHover: "hsl(var(--accent))",
                separatorLine: "hsl(var(--border))",
              },
            })
          : lightTheme({
              colors: {
                modalBg: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                accentText: "hsl(var(--primary))",
                primaryButtonBg: "hsl(var(--primary))",
                primaryButtonText: "hsl(var(--primary-foreground))",
                secondaryButtonBg: "hsl(var(--secondary))",
                secondaryButtonText: "hsl(var(--secondary-foreground))",
                connectedButtonBg: "hsl(var(--card))",
                connectedButtonBgHover: "hsl(var(--accent))",
                separatorLine: "hsl(var(--border))",
              },
            })
      }
      wallets={wallets}
    />
  );
}
