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
  // const userId = account?.address;
  const userId = "0xc022BD0b6005Cae66a468f9a20897aDecDE04e95";

  const excludedCountries = useMemo(() => [countries.NORTH_KOREA], []);

  // Early return if user is not connected
  if (!userId) {
    return (
      <div
        className="min-h-screen relative overflow-hidden bg-cover bg-center bg-no-repeat flex flex-col items-center justify-center p-4"
        style={{
          backgroundImage: "url('/african-safari-scene-2005.jpg')",
        }}
      >
        {/* Background overlay for better text readability */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] pointer-events-none"></div>

        {/* Content Container */}
        <div className="relative z-10 w-full max-w-md mx-auto">
          <div className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-xl p-6 shadow-lg text-center">
            <h2 className="text-white font-semibold text-lg mb-3">
              Wallet Required
            </h2>
            <p className="text-white/70 text-sm">
              Please connect your wallet to proceed with identity verification
            </p>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    try {
      // Use the contract address
      const endpoint =
        process.env.NEXT_PUBLIC_SELF_ENDPOINT ||
        "0x4ea3a08de3d5cc74a5b2e20ba813af1ab3765956";

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
        deeplinkCallback: `${window.location.origin}/`,
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
    <div
      className="min-h-screen relative overflow-hidden bg-cover bg-center bg-no-repeat flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: "url('/african-safari-scene-2005.jpg')",
      }}
    >
      {/* Background overlay for better text readability */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] pointer-events-none"></div>

      {/* Compact Content Container */}
      <div className="relative z-10 w-full max-w-sm mx-auto">
        <div className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-xl p-4 shadow-lg">
          <div className="flex flex-col items-center gap-4">
            {/* QR Code Section */}
            <div className="flex-shrink-0">
              <div className="bg-white rounded-lg p-2 shadow-lg">
                {selfApp ? (
                  <SelfQRcodeWrapper
                    selfApp={selfApp}
                    type="deeplink"
                    onSuccess={handleSuccessfulVerification}
                    onError={() =>
                      displayToast("Error: Failed to verify identity")
                    }
                  />
                ) : (
                  <div className="w-[160px] h-[160px] bg-gray-100 animate-pulse flex items-center justify-center rounded-lg">
                    <p className="text-gray-500 text-sm">Loading...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-row gap-2 w-full">
              <button
                type="button"
                onClick={copyToClipboard}
                disabled={!universalLink || !userId || isVerifying}
                className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:from-gray-500 disabled:to-gray-500 transition-all duration-200 text-white font-medium py-2 px-3 rounded-lg text-xs disabled:cursor-not-allowed shadow-lg"
              >
                {linkCopied ? "Copied!" : "Copy Link"}
              </button>

              <button
                type="button"
                onClick={openSelfApp}
                disabled={!universalLink || !userId || isVerifying}
                className="flex-1 bg-white/10 hover:bg-white/20 disabled:bg-gray-500/20 backdrop-blur-sm border border-white/20 transition-all duration-200 text-white font-medium py-2 px-3 rounded-lg text-xs disabled:cursor-not-allowed"
              >
                {isVerifying ? (
                  <span className="flex items-center justify-center gap-1">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Verifying...
                  </span>
                ) : (
                  "Open Self App"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 left-4 right-4 z-50 flex justify-center">
          <div className="bg-gray-800/90 backdrop-blur-sm text-white py-3 px-6 rounded-lg shadow-lg border border-gray-600/30 max-w-sm text-center">
            <div className="text-sm font-medium">{toastMessage}</div>
          </div>
        </div>
      )}
    </div>
  );
}
