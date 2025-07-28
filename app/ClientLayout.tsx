"use client";

import type React from "react";
import { useEffect } from "react";
import { ThirdwebProvider, darkTheme } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { celo } from "thirdweb/chains";
import { WalletProvider } from "@/lib/wallet";
import { ContractProvider } from "@/lib/contract";
import { Toaster } from "@/components/ui/toaster";
import {
  registerServiceWorker,
  initializeDataSaver,
} from "@/lib/serviceWorker";
import { AuthProvider } from "@/lib/auth-provider";
import { Inter } from "next/font/google";

// Your wallet definitions
import { createWallet } from "thirdweb/wallets";
const wallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
  createWallet("io.zerion.wallet"),
];

const inter = Inter({ subsets: ["latin"] });

const client = createThirdwebClient({
  clientId: "870fb72b2fc1f747cf42a34629486955", // Replace with your actual client ID
});

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    registerServiceWorker();
    initializeDataSaver();
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} pb-safe`}>
        <ThirdwebProvider
          client={client}
          chain={celo}
          wallets={wallets}
          theme={darkTheme({
            // ...your theme config
          })}
        >
          <AuthProvider>
            <WalletProvider>
              <ContractProvider>
                {children}
                <Toaster />
                <div
                  id="connection-status"
                  className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-white text-center py-1 text-sm hidden"
                >
                  You are offline. Some features may be limited.
                </div>
              </ContractProvider>
            </WalletProvider>
          </AuthProvider>
        </ThirdwebProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
            function updateOnlineStatus() {
              var status = document.getElementById('connection-status');
              if (status) {
                if (navigator.onLine) {
                  status.classList.add('hidden');
                } else {
                  status.classList.remove('hidden');
                }
              }
            }
            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);
            updateOnlineStatus();
          `,
          }}
        />
      </body>
    </html>
  );
}