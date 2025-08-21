import { createThirdwebClient } from "thirdweb";
import { ConnectButton } from "thirdweb/react";
import { darkTheme } from "thirdweb/react";
import { inAppWallet, createWallet } from "thirdweb/wallets";
import { ethereum, celo, scroll } from "thirdweb/chains";
import { client } from '@/lib/thirdweb/client';


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
    createWallet("walletConnect")
  ];

export default function Mayday() {
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
  );
}
