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
import { ChainProvider } from "@/components/ChainProvider";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { SpaceBackground } from "@/components/common/SpaceBackground";
import { sdk } from "@farcaster/miniapp-sdk";

const queryClient = new QueryClient();
const disabledProviders = (process.env.NEXT_PUBLIC_DISABLE_PROVIDERS ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const isDisabled = (name: string) => disabledProviders.includes(name);

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    void sdk.actions.ready();
    registerServiceWorker();
    initializeDataSaver();
  }, []);

  let content = children;
  if (!isDisabled("ChainProvider")) {
    content = <ChainProvider>{content}</ChainProvider>;
  }
  if (!isDisabled("ThirdwebProvider")) {
    content = <ThirdwebProvider>{content}</ThirdwebProvider>;
  }
  if (!isDisabled("AuthProvider")) {
    content = <AuthProvider>{content}</AuthProvider>;
  }
  if (!isDisabled("QueryClientProvider")) {
    content = (
      <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
    );
  }

  return (
    <>
      {!isDisabled("SpaceBackground") && <SpaceBackground />}
      <div className="app-shell">
        {content}
        {!isDisabled("Toaster") && <Toaster />}
        {!isDisabled("PWAInstallPrompt") && <PWAInstallPrompt />}
        {!isDisabled("ConnectionStatusBanner") && (
          <div
            id="connection-status"
            className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-white text-center py-1 text-sm hidden"
          >
            You are offline. Some features may be limited.
          </div>
        )}
      </div>
      {!isDisabled("ConnectionStatusScript") && (
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
      )}
    </>
  );
}
