"use client";

import { useEffect, useState } from "react";

// Types for MetaMask deeplinks
export interface DeeplinkOptions {
  url?: string;
  chainId?: string;
}

/**
 * Detects if the current device is running iOS
 */
export function isIOS(): boolean {
  if (typeof window === "undefined") return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
  );
}

/**
 * Detects if the current device is running Android
 */
export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;

  return /Android/.test(navigator.userAgent);
}

/**
 * Checks if the current device is mobile (either iOS or Android)
 */
export function isMobileDevice(): boolean {
  return isIOS() || isAndroid();
}

/**
 * Checks if MetaMask is available in the browser
 */
export function isMetaMaskInstalled(): boolean {
  if (typeof window === "undefined") return false;

  return window.ethereum && window.ethereum.isMetaMask;
}

/**
 * Creates a MetaMask deeplink for mobile devices
 * @param options Options for the deeplink
 * @returns The deeplink URL
 */
export function createMetaMaskDeeplink(options: DeeplinkOptions = {}): string {
  const { url, chainId } = options;

  // Get the current URL for the return URL
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  // Create a return URL parameter to come back to the current page
  const returnUrl = encodeURIComponent(currentUrl);

  // Base URL for the deeplink
  let deeplink = "https://metamask.app.link/dapp/";

  // If a URL is provided, use it, otherwise use the current URL
  const dappUrl = url || currentUrl;

  // Remove protocol from URL
  const formattedUrl = dappUrl.replace(/^https?:\/\//, "");

  // Append the URL to the deeplink
  deeplink += formattedUrl;

  // Start query parameters
  let queryParams = chainId ? `?chainId=${chainId}` : "?";

  // Add return URL parameter if not already in the URL
  if (!deeplink.includes("returnUrl=")) {
    queryParams += (queryParams === "?" ? "" : "&") + `returnUrl=${returnUrl}`;
  }

  // Add the query parameters to the deeplink
  deeplink += queryParams === "?" ? "" : queryParams;

  return deeplink;
}

/**
 * Hook to check if MetaMask is available
 * @returns Object with MetaMask availability status
 */
export function useMetaMaskAvailability() {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsAvailable(isMetaMaskInstalled());
      setIsMobile(isMobileDevice());
    }
  }, []);

  return {
    isMetaMaskAvailable: isAvailable,
    isMobileDevice: isMobile,
    isIOS: isIOS(),
    isAndroid: isAndroid(),
  };
}

/**
 * Opens MetaMask mobile app via deeplink
 * @param options Options for the deeplink
 * @returns Promise that resolves when the user returns from MetaMask
 */
export function openMetaMaskMobile(
  options: DeeplinkOptions = {}
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    const deeplink = createMetaMaskDeeplink(options);

    // Store the current timestamp to detect when user returns
    const timestamp = Date.now();
    localStorage.setItem("metamask_deeplink_timestamp", timestamp.toString());

    // Set up visibility change listener to detect when user returns from MetaMask
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const storedTimestamp = localStorage.getItem(
          "metamask_deeplink_timestamp"
        );
        const timeDiff = Date.now() - parseInt(storedTimestamp || "0");

        // If more than 2 seconds have passed, user likely returned from MetaMask
        if (timeDiff > 2000) {
          document.removeEventListener(
            "visibilitychange",
            handleVisibilityChange
          );
          localStorage.removeItem("metamask_deeplink_timestamp");
          resolve();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Open the deeplink
    window.location.href = deeplink;
  });
}
