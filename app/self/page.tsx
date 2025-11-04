"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  SelfQRcodeWrapper,
  SelfAppBuilder,
  type SelfApp,
  countries,
  getUniversalLink,
} from "@selfxyz/qrcode";
import { useActiveAccount } from "thirdweb/react";

export default function Home() {
  const router = useRouter();
  const [linkCopied, setLinkCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [universalLink, setUniversalLink] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const account = useActiveAccount();
  const userId = account?.address;
  const excludedCountries = useMemo(() => [countries.NORTH_KOREA], []);

  // Early return if user is not connected
  if (!userId) {
    return (
      <div className="min-h-screen w-full bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="mb-6 md:mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-800">
            {process.env.NEXT_PUBLIC_SELF_APP_NAME || "Self Workshop"}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 px-2">
            Please connect your wallet to proceed with identity verification
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto">
          <div className="text-center text-gray-500">
            Wallet connection required
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    try {
      // Use the contract address from .env or fallback to the verified Self endpoint
      const endpoint =
        process.env.NEXT_PUBLIC_SELF_ENDPOINT || "https://selfda1.vercel.app";

      const app = new SelfAppBuilder({
        version: 2,
        appName: process.env.NEXT_PUBLIC_SELF_APP_NAME || "Minilend",
        scope: process.env.NEXT_PUBLIC_SELF_SCOPE || "minilend-app",
        endpoint: endpoint,
        logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
        userId: userId,
        endpointType: "celo",
        userIdType: "hex",
        userDefinedData: "Enjoy saving together with Minilend!",
        disclosures: {
          minimumAge: 18,
          ofac: true,
          excludedCountries: excludedCountries,
          nationality: true,
        },
      }).build();

      setSelfApp(app);
      setUniversalLink(getUniversalLink(app));
    } catch (error) {
      console.error("Failed to initialize Self app:", error);
    }
  }, [excludedCountries, userId]);

  const displayToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const copyToClipboard = () => {
    if (!universalLink || !userId) return;
    navigator.clipboard
      .writeText(universalLink)
      .then(() => {
        setLinkCopied(true);
        displayToast("Universal link copied to clipboard!");
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
        displayToast("Failed to copy link");
      });
  };

  const openSelfApp = () => {
    if (!universalLink || !userId) return;
    window.open(universalLink, "_blank");
    displayToast("Opening Self App...");
  };

  const handleSuccessfulVerification = async () => {
    // Prevent duplicate submissions
    if (isVerifying) {
      return;
    }

    if (!userId) {
      displayToast("Please connect your wallet to proceed with verification");
      return;
    }

    setIsVerifying(true);
    displayToast("Verification successful! Fetching disclosed data...");

    try {
      const response = await fetch("/api/self/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: userId }),
      });

      if (response.ok) {
        const data = await response.json();
        // Log verification success without PII
        if (process.env.NODE_ENV === "development") {
          console.log("Verification data received successfully");
        }
        displayToast("Verification saved! Redirecting...");
        setTimeout(() => router.push("/"), 1500);
      } else {
        // Parse and show API error message
        try {
          const errorData = await response.json();
          const errorMessage =
            errorData.message ||
            errorData.error ||
            "Failed to fetch verification data";
          displayToast(`Verification failed: ${errorMessage}`);
        } catch {
          displayToast("Failed to fetch verification data");
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown verification error";
      console.error("Failed to save verification:", error);
      displayToast(`Verification error: ${errorMessage}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-800">
          {process.env.NEXT_PUBLIC_SELF_APP_NAME || "Self Workshop"}
        </h1>
        <p className="text-sm sm:text-base text-gray-600 px-2">
          Scan QR code with Self Protocol App to verify your identity
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto">
        <div className="flex justify-center mb-4 sm:mb-6">
          {selfApp ? (
            <SelfQRcodeWrapper
              selfApp={selfApp}
              onSuccess={handleSuccessfulVerification}
              onError={() => displayToast("Error: Failed to verify identity")}
            />
          ) : (
            <div className="w-[256px] h-[256px] bg-gray-200 animate-pulse flex items-center justify-center">
              <p className="text-gray-500 text-sm">Loading QR Code...</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 mb-4 sm:mb-6">
          <button
            type="button"
            onClick={copyToClipboard}
            disabled={!universalLink || !userId || isVerifying}
            className="flex-1 bg-gray-800 hover:bg-gray-700 transition-colors text-white p-2 rounded-md text-sm sm:text-base disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {linkCopied ? "Copied!" : "Copy Universal Link"}
          </button>

          <button
            type="button"
            onClick={openSelfApp}
            disabled={!universalLink || !userId || isVerifying}
            className="flex-1 bg-blue-600 hover:bg-blue-500 transition-colors text-white p-2 rounded-md text-sm sm:text-base mt-2 sm:mt-0 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {isVerifying ? "Verifying..." : "Open Self App"}
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 mt-2">
          <span className="text-gray-500 text-xs uppercase tracking-wide">
            User Address
          </span>
          <div className="bg-gray-100 rounded-md px-3 py-2 w-full text-center break-all text-sm font-mono text-gray-800 border border-gray-200">
            {userId ? (
              userId
            ) : (
              <span className="text-gray-400">Not connected</span>
            )}
          </div>
        </div>

        {showToast && (
          <div className="fixed bottom-4 right-4 bg-gray-800 text-white py-2 px-4 rounded shadow-lg animate-fade-in text-sm">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
