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
        description: "save stablecoins like USDC and access credit backed by your stables",
        logoUrl: "/public/minilend-logo.png",
        url: "https://minilend.xyz",
      }}
    />
  );
}
