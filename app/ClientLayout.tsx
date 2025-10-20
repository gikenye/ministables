"use client";

import type React from "react";
import { useEffect } from "react";
import { ThirdwebProvider } from "thirdweb/react";
import { client } from "@/lib/thirdweb/client";
import { Toaster } from "@/components/ui/toaster";
import {
  registerServiceWorker,
  initializeDataSaver,
} from "@/lib/serviceWorker";
import { AuthProvider } from "@/lib/auth-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Inter } from "next/font/google";
import { MiniAppProvider } from "@neynar/react";
import { ChainProvider } from "@/components/ChainProvider";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { ThemeProvider } from "@/components/theme-provider";

const queryClient = new QueryClient();

const inter = Inter({ subsets: ["latin"] });

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
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>
      <body className={`${inter.className} pb-safe`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={false}
          storageKey="minilend-theme"
        >
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ThirdwebProvider>
                <MiniAppProvider analyticsEnabled={true}>
                  <ChainProvider>
                    {children}
                    <Toaster />
                    <PWAInstallPrompt />
                    {/* Connection Status Banner */}
                    <div
                      id="connection-status"
                      className="fixed bottom-0 left-0 right-0 bg-warning text-foreground text-center py-1 text-sm hidden"
                    >
                      You are offline. Some features may be limited.
                    </div>
                  </ChainProvider>
                </MiniAppProvider>
              </ThirdwebProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
        {/* Connection Status Script */}
        <script
          dangerouslySetInnerHTML={{
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
          }}
        />
      </body>
    </html>
  );
}
