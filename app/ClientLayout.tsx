"use client";

import type React from "react";
import { useEffect } from "react";
import { WalletProvider } from "@/lib/wallet";
import { ContractProvider } from "@/lib/contract";
import { Toaster } from "@/components/ui/toaster";
import {
  registerServiceWorker,
  initializeDataSaver,
} from "@/lib/serviceWorker";
import { AuthProvider } from "@/lib/auth-provider";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Register service worker and initialize data saver
  useEffect(() => {
    registerServiceWorker();
    initializeDataSaver();
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} pb-safe`}>
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
            // Monitor online/offline status
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
