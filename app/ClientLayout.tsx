"use client";

import type React from "react";
import { useEffect } from "react";
import { WalletProvider } from "@/lib/wallet";
import { EnhancedWalletProvider } from "@/lib/enhanced-wallet";
import { ContractProvider } from "@/lib/contract";
import { Toaster } from "@/components/ui/toaster";
import {
  registerServiceWorker,
  initializeDataSaver,
} from "@/lib/serviceWorker";
import { AuthProvider } from "@/lib/auth-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Inter } from "next/font/google";

const queryClient = new QueryClient();

const inter = Inter({ subsets: ["latin"] });

import { ThirdwebWalletProvider } from "@/lib/thirdweb/provider";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerServiceWorker();
    initializeDataSaver();
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} pb-safe`}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThirdwebWalletProvider>
              <WalletProvider>
                <ContractProvider>
                  {children}
                  <Toaster />
                  {/* Connection Status Banner */}
                  <div id="connection-status" className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-white text-center py-1 text-sm hidden">
                    You are offline. Some features may be limited.
                  </div>
                </ContractProvider>
              </WalletProvider>
            </ThirdwebWalletProvider>
          </AuthProvider>
        </QueryClientProvider>
        {/* Connection Status Script */}
        <script dangerouslySetInnerHTML={{
          __html: `
            function updateOnlineStatus() {
              const status = document.getElementById('connection-status');
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
        }} />
      </body>
    </html>
  );
}
