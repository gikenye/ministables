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
import { Analytics } from "@vercel/analytics/next";
import { SpaceBackground } from "@/components/common/SpaceBackground";

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
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0e6037" />
        <style>{`html, body { background: #020617; color: #e2e8f0; }`}</style>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.SEO_CONFIG={title:"Minilend - Save and you will be rewarded",description:"Minilend is a savings protocol for group savings in stablecoins on Celo, Base & Scroll. Save for your goals, borrow for your needs.",canonical:"https://ministables.vercel.app",image:"https://ministables.vercel.app/new-logo.png",siteName:"Minilend",siteUrl:"https://ministables.vercel.app",locale:"en_US",type:"website",twitterCard:"summary_large_image"};`,
          }}
        />
        <script src="/seo/seo-core.js" defer />
      </head>
      <body className={`${inter.className} pb-safe`}>
        <SpaceBackground />
        <div className="app-shell">
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ThirdwebProvider>
                <MiniAppProvider analyticsEnabled={true}>
                <ChainProvider>
                  {children}
                  <Toaster />
                  <PWAInstallPrompt />
                  <Analytics />
                  {/* Connection Status Banner */}
                  <div
                    id="connection-status"
                    className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-white text-center py-1 text-sm hidden"
                  >
                    You are offline. Some features may be limited.
                  </div>
                </ChainProvider>
                </MiniAppProvider>
              </ThirdwebProvider>
            </AuthProvider>
          </QueryClientProvider>
        </div>
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
