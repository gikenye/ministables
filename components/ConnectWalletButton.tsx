"use client";

import { useEffect } from "react";
import { ConnectButton, useActiveWallet } from "thirdweb/react";
import { darkTheme } from "thirdweb/react";
import { celo } from "thirdweb/chains";
import { createThirdwebClient } from "thirdweb";
import { createWallet } from "thirdweb/wallets";



// Reference client and wallets from root layout
const client = createThirdwebClient({
  clientId: "870fb72b2fc1f747cf42a34629486955", // Replace with your actual client ID
});const wallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
];

export function ConnectWalletButton() {
  const wallet = useActiveWallet();

  // Ensure Celo network on wallet connection
  useEffect(() => {
    const switchToCelo = async () => {
      try {
        if (wallet) {
          await wallet.switchChain(celo);
          console.log("Switched to Celo network");
        }
      } catch (error) {
        console.error("Error switching to Celo network:", error);
      }
    };
    if (wallet) {
      switchToCelo();
    }
  }, [wallet]);

  return (
    <ConnectButton
      client={client}
      chain={celo}
      wallets={wallets}
      connectButton={{ label: "Connect Wallet" }}
      connectModal={{
        showThirdwebBranding: false,
        size: "compact",
        title: "Sign in to MiniLend",
        titleIcon: "https://ministables.vercel.app/minilend-logo.png",
      }}
      theme={darkTheme({
        colors: {
          accentText: "hsl(150, 100%, 27%)",
          modalBg: "hsl(70, 58%, 5%)",
          borderColor: "hsl(228, 12%, 17%)",
          primaryButtonBg: "hsl(150, 100%, 27%)",
          primaryButtonText: "hsl(240, 6%, 94%)",
          selectedTextBg: "hsl(240, 6%, 94%)",
          accentButtonBg: "hsl(99, 34%, 49%)",
        },
      })}
      className="bg-primary hover:bg-secondary text-white w-full min-h-[48px] rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
    />
  );
}