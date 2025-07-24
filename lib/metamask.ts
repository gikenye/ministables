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

  // Base URL for the deeplink
  let deeplink = "https://metamask.app.link/dapp/";

  // If a URL is provided, use it, otherwise use the current URL
  const dappUrl =
    url || (typeof window !== "undefined" ? window.location.href : "");

  // Remove protocol from URL
  const formattedUrl = dappUrl.replace(/^https?:\/\//, "");

  // Append the URL to the deeplink
  deeplink += formattedUrl;

  // Add chainId if provided
  if (chainId) {
    deeplink += `?chainId=${chainId}`;
  }

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
 */
export function openMetaMaskMobile(options: DeeplinkOptions = {}): void {
  if (typeof window === "undefined") return;

  const deeplink = createMetaMaskDeeplink(options);

  // Open the deeplink in a new tab
  window.open(deeplink, "_blank");
}
