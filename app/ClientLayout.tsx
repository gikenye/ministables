"use client";

import type React from "react";
import { useEffect, useState } from "react";
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
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    void sdk.actions.ready();
    registerServiceWorker();
    initializeDataSaver();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkConnectivity = async () => {
      if (cancelled) return;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const res = await fetch("/api/health", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!cancelled) {
          setIsOnline(res.ok);
        }
      } catch {
        if (!cancelled) {
          setIsOnline(false);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const updateStatus = () => {
      if (navigator.onLine) {
        checkConnectivity();
      } else {
        setIsOnline(false);
      }
    };

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    document.addEventListener("visibilitychange", updateStatus);
    updateStatus();
    intervalId = setInterval(checkConnectivity, 15000);

    return () => {
      cancelled = true;
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      document.removeEventListener("visibilitychange", updateStatus);
      if (intervalId) clearInterval(intervalId);
    };
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
            className={`fixed bottom-0 left-0 right-0 bg-yellow-500 text-white text-center py-1 text-sm ${isOnline ? "hidden" : ""}`}
          >
            You are offline. Some features may be limited.
          </div>
        )}
      </div>
    </>
  );
}
