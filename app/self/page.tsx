"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { countries, getUniversalLink } from "@selfxyz/core";
import {
  SelfQRcodeWrapper as OriginalSelfQRcodeWrapper,
  SelfAppBuilder,
  type SelfApp,
} from "@selfxyz/qrcode";

// Create a wrapper component with the correct type
const SelfQRcodeWrapper = (props: any) => {
  return <OriginalSelfQRcodeWrapper {...props} />;
};
import { ethers } from "ethers";
import { signIn, useSession } from "next-auth/react";
import { useActiveAccount } from "thirdweb/react";

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const account = useActiveAccount();
  const address = account?.address;
  const isConnected = !!account;
  const [linkCopied, setLinkCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [universalLink, setUniversalLink] = useState("");
  const [userId, setUserId] = useState('0x0000000000000000000000000000000000000000');
  const [verifying, setVerifying] = useState(false);
  // Use useMemo to cache the array to avoid creating a new array on each render
  const excludedCountries = useMemo(() => [countries.NORTH_KOREA], []);

  // Check if user is already verified and redirect if needed
  useEffect(() => {
    if (session?.user?.verified) {
      router.push("/");
    }
  }, [session, router]);

  // Update userId when wallet address changes
  useEffect(() => {
    if (address && isConnected) {
      setUserId(address);
    }
  }, [address, isConnected]);

  // Use useEffect to ensure code only executes on the client side
  useEffect(() => {
    if (!userId || userId === '0x0000000000000000000000000000000000000000') return;
    try {
      const app = new SelfAppBuilder({
        version: 2,
        appName: process.env.NEXT_PUBLIC_SELF_APP_NAME || "Minilend",
        scope: process.env.NEXT_PUBLIC_SELF_SCOPE || "minilend-by-pesabits",
        endpoint: `${process.env.NEXT_PUBLIC_SELF_ENDPOINT}`,
        logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
        userId: userId,
        endpointType: "staging_celo",
        userIdType: "hex", // use 'hex' for ethereum address or 'uuid' for uuidv4
        userDefinedData: "Hakuna Matata 😁 !!",
        disclosures: {
          // Only request minimal information
          minimumAge: 18,
          ofac: true, // Check if user is not on OFAC list
          nationality: true,
          // Don't request additional personal information
          name: false,
          gender: false,
          issuing_state: false,
          date_of_birth: false,
          passport_number: false,
          expiry_date: false,
        },
        devMode: true,
      }).build();

      setSelfApp(app);
      setUniversalLink(getUniversalLink(app));
    } catch (error) {
      console.error("Failed to initialize Self app:", error);
    }
  }, [userId]);

  const displayToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const copyToClipboard = () => {
    if (!universalLink) return;

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
    if (!universalLink) return;

    window.open(universalLink, "_blank");
    displayToast("Opening Self App...");
  };

  // This is a wrapper function that matches the expected type for onSuccess
  const handleVerificationSuccess = () => {
    setVerifying(true);
    displayToast("Verification successful! Creating session...");
    
    // Simplified sign-in process - just use the wallet address
    signIn("self-protocol", {
      address: userId,
      redirect: false,
    })
      .then((result) => {
        if (result?.error) {
          console.error("Sign in error:", result.error);
          displayToast("Error creating session. Please try again.");
          setVerifying(false);
        } else {
          displayToast("Verification successful! Redirecting...");
          // Redirect to the verified page
          setTimeout(() => {
            router.push("/verified");
          }, 1500);
        }
      })
      .catch((error) => {
        console.error("Error during sign in:", error);
        displayToast("Error creating session. Please try again.");
        setVerifying(false);
      });
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center px-4 py-6">
      {/* Header */}
      <div className="mb-4 text-center">
        <h1 className="text-xl font-bold mb-1 text-primary">
          Identity Verification
        </h1>
        <p className="text-xs text-gray-600">
          Scan QR code with Self Protocol App
        </p>
      </div>

      {/* Main content */}
      <div className="w-full max-w-xs">
        {verifying ? (
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-gray-600 text-sm">Verifying...</p>
          </div>
        ) : (
          <div className="flex justify-center mb-4">
            {selfApp ? (
              <SelfQRcodeWrapper
                selfApp={selfApp}
                type="deeplink"
                onSuccess={handleVerificationSuccess}
                onError={() => {
                  displayToast("Error: Failed to verify identity");
                }}
              />
            ) : (
              <div className="w-[220px] h-[220px] bg-gray-100 animate-pulse flex items-center justify-center rounded-lg">
                <p className="text-gray-500 text-xs">Loading QR Code...</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 mb-4">
          <button
            type="button"
            onClick={openSelfApp}
            disabled={!universalLink}
            className="w-full bg-primary hover:bg-primary/90 transition-colors text-white p-2 rounded-md text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Open Self App
          </button>
          
          <button
            type="button"
            onClick={copyToClipboard}
            disabled={!universalLink}
            className="w-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-800 p-2 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {linkCopied ? "Copied!" : "Copy Link"}
          </button>
        </div>

        {/* Toast notification */}
        {showToast && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white py-2 px-4 rounded-full shadow-lg text-xs">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
