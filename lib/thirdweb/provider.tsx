"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { client } from "./client";

export const ThirdwebWalletProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThirdwebProvider
      client={client}
      authConfig={{
        domain: process.env.NEXT_PUBLIC_MINISTABLES_DOMAIN || "localhost", // or "localhost" for dev
        authUrl: "/api/auth",
      }}
    >
      {children}
    </ThirdwebProvider>
  );
};
