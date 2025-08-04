"use client";

import { ConnectButton } from "thirdweb/react";
import { client } from "@/lib/thirdweb/client";

export default function ConnectWallet() {
  return (
    <ConnectButton
      client={client}
      auth={{ loginOptional: true } as any}
      appMetadata={{
        name: "MiniStables",
        description: "Stablecoin tools on Celo",
        logoUrl: "/public/minilend-logo.png",
        url: "https://ministables.vercel.app",
      }}
    />
  );
}
