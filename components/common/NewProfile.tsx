import React, { useEffect, useState, useMemo } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useRouter } from "next/navigation";
import {
  generateUsernameFromAddress,
  getMemberSinceDate,
  countryCodeToFlag,
} from "@/lib/utils/profileUtils";
import { ProfileHero } from "./ProfileHero";
import { useGoals } from "@/hooks/useGoals";
import { useUser } from "@/hooks/useUser";
import { LogOut, Shield, HelpCircle, ExternalLink } from "lucide-react";
import { ConnectWallet } from "../ConnectWallet";
import {
  SelfQRcodeWrapper,
  SelfAppBuilder,
  type SelfApp,
  countries,
  getUniversalLink,
} from "@selfxyz/qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Telegram Icon Component (from Flaticon - Pixel perfect)
const TelegramIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

interface NewProfileProps {
  showBalance: boolean;
  onToggleBalance: () => void;
  className?: string;
}

export const NewProfile = ({
  showBalance,
  onToggleBalance,
  className = "",
}: NewProfileProps) => {
  const account = useActiveAccount();
  const address = account?.address;
  const router = useRouter();

  // Modal and toast state
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [universalLink, setUniversalLink] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [encryptedUserId, setEncryptedUserId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [nationality, setNationality] = useState<string | undefined>(undefined);
  const [useridLoading, setUseridLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);

  // Get real user data
  const { user, loading: userLoading } = useUser();
  const { goals, stats, loading: goalsLoading } = useGoals();

  // XP state
  const [xpData, setXpData] = useState<{ totalXP: number; xpHistory: any[] } | null>(null);
  const [xpLoading, setXpLoading] = useState(false);


  // Self verification setup
  const excludedCountries = useMemo(() => [countries.NORTH_KOREA], []);

  // Check for verification callback on mount and process immediately
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
      const storedSelfId = sessionStorage.getItem('pendingSelfVerification');
      if (storedSelfId) {
        // Process verification immediately
        (async () => {
          try {
            displayToast("Processing verification...");
            const response = await fetch("/api/self/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ selfId: storedSelfId }),
            });
            
            if (response.ok) {
              sessionStorage.removeItem('pendingSelfVerification');
              displayToast("Verification completed successfully!");
              // Refresh verification status
              const verifyResponse = await fetch(`/api/self/verify?selfId=${encodeURIComponent(storedSelfId)}`);
              if (verifyResponse.ok) {
                const data = await verifyResponse.json();
                setIsVerified(true);
                setNationality(data.nationality);
              }
            } else {
              displayToast("Verification failed. Please try again.");
            }
          } catch (error) {
            console.error('Verification processing error:', error);
            displayToast("Verification error. Please try again.");
          }
        })();
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!address || !isVerificationModalOpen || !encryptedUserId) return;

    const initSelfApp = async () => {
      try {
        const endpoint =
          process.env.NEXT_PUBLIC_SELF_ENDPOINT ||
          "0x4ea3a08de3d5cc74a5b2e20ba813af1ab3765956";

        const encoder = new TextEncoder();
        const data = encoder.encode(encryptedUserId);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(12, 15)}-${(parseInt(hash[16], 16) & 0x3 | 0x8).toString(16)}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;

        const callbackUrl = `${window.location.origin}${window.location.pathname}?verified=true`;
        
        const app = new SelfAppBuilder({
          version: 2,
          appName: process.env.NEXT_PUBLIC_SELF_APP_NAME || "Minilend",
          scope: process.env.NEXT_PUBLIC_SELF_SCOPE || "minilend-app",
          endpoint: endpoint,
          logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
          userId: uuid,
          endpointType: "celo",
          userIdType: "uuid",
          userDefinedData: "Enjoy saving together with Minilend!",
          deeplinkCallback: callbackUrl,
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
    };

    initSelfApp();
  }, [excludedCountries, address, isVerificationModalOpen, encryptedUserId]);

  useEffect(() => {
    if (!address) return;

    const fetchUserId = async () => {
      setUseridLoading(true);
      try {
        const response = await fetch('/api/self/userid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: address }),
        });
        if (response.ok) {
          const data = await response.json();
          setEncryptedUserId(data.selfId);
        } else {
          console.error('Failed to fetch encrypted userId');
        }
      } catch (error) {
        console.error('Error fetching encrypted userId:', error);
      } finally {
        setUseridLoading(false);
      }
    };

    fetchUserId();
  }, [address]);

  // Fetch XP data
  useEffect(() => {
    if (!address) return;

    const fetchXpData = async () => {
      setXpLoading(true);
      try {
        const response = await fetch(`/api/xp?userAddress=${address}`);
        if (response.ok) {
          const data = await response.json();
          setXpData(data);
        }
      } catch (error) {
        console.error('Error fetching XP data:', error);
      } finally {
        setXpLoading(false);
      }
    };

    fetchXpData();
  }, [address]);

  useEffect(() => {
    if (!encryptedUserId) return;

    const checkVerification = async () => {
      setVerificationLoading(true);
      try {
        const response = await fetch(`/api/self/verify?selfId=${encodeURIComponent(encryptedUserId)}`);
        if (response.ok) {
          const data = await response.json();
          setIsVerified(true);
          setNationality(data.nationality);
        } else {
          setIsVerified(false);
          setNationality(undefined);
        }
      } catch (error) {
        console.error('Error checking verification status:', error);
        setIsVerified(false);
        setNationality(undefined);
      } finally {
        setVerificationLoading(false);
      }
    };

    checkVerification();
  }, [encryptedUserId]);

  // Handle verification click
  const handleVerificationClick = () => {
    setIsVerificationModalOpen(true);
  };

  // Toast notification function
  const displayToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Copy link to clipboard
  const copyToClipboard = () => {
    if (!universalLink || !address) return;
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

  // Open Self App
  const openSelfApp = () => {
    if (!universalLink || !address || !encryptedUserId) return;
    // Store selfId for post-redirect verification
    sessionStorage.setItem('pendingSelfVerification', encryptedUserId);
    window.open(universalLink, "_blank");
    displayToast("Opening Self App...");
  };

  // Handle successful verification
  const handleSuccessfulVerification = async () => {
    if (isVerifying) return;
    if (!address) {
      displayToast("Please connect your wallet to proceed with verification");
      return;
    }

    setIsVerifying(true);
    displayToast("Verification successful! Fetching disclosed data...");

    try {
      const response = await fetch("/api/self/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfId: encryptedUserId }),
      });

      if (response.ok) {
        sessionStorage.removeItem('pendingSelfVerification');
        displayToast("Verification saved! Closing modal...");
        setTimeout(() => {
          setIsVerificationModalOpen(false);
          setIsVerified(true);
          if (encryptedUserId) {
            fetch(`/api/self/verify?selfId=${encodeURIComponent(encryptedUserId)}`)
              .then(res => res.json())
              .then(data => setNationality(data.nationality))
              .catch(console.error);
          }
        }, 1500);
      } else {
        const errorData = await response.json().catch(() => ({}));
        displayToast(`Verification failed: ${errorData.message || errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to save verification:", error);
      displayToast(`Verification error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!address) {
    return (
      <div className={`min-h-screen ${className}`}>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gray-800/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700/30">
              <Shield className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Sign In to Continue
            </h2>
            <p className="text-gray-400 text-sm">
              Sign in to view your profile and start saving
            </p>
          </div>
          <ConnectWallet className="w-full max-w-sm" />
        </div>
      </div>
    );
  }

  const username = generateUsernameFromAddress(address);

  // Calculate stats from real data
  const totalSaved = stats?.totalSaved || "0";
  const totalXP = xpData?.totalXP || 0;
  const goalsCompleted = xpData?.xpHistory 
    ? new Set(xpData.xpHistory.map(item => item.metaGoalId)).size 
    : 0;

  const loading = userLoading || goalsLoading || xpLoading;

  return (
    <div className={`min-h-screen ${className}`}>
      <div className="mx-auto max-w-md">
        {/* Profile Hero - 50% smaller */}
        <ProfileHero
          walletAddress={address}
          username={username}
          countryCode={nationality}
          isVerified={isVerified}
        />

        {/* Simple Stats - Translucent Design */}
        <div className="px-4 mt-6">
          <div className="bg-gray-800/20 backdrop-blur-sm rounded-xl p-4 border border-gray-700/30">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-white">
                  {xpLoading ? "..." : totalXP.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400">Total XP</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {goalsCompleted}
                </p>
                <p className="text-xs text-gray-400">Goals Completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Self Verification CTA - Only show for loading or unverified users */}
        {(!isVerified || verificationLoading || useridLoading) && (
          <div className="px-4 mt-4">
            {verificationLoading ? (
              // Loading state
              <div className="bg-gray-500/20 backdrop-blur-sm border border-gray-500/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-400 animate-pulse" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-400">
                      Checking verification status...
                    </h3>
                    <p className="text-xs text-black">
                      Please wait while we verify your identity status
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // Unverified state - clickable
              <button
                onClick={handleVerificationClick}
                className="w-full bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4 hover:bg-blue-500/30 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <div className="flex-1 text-left">
                    <h3 className="text-sm font-medium text-blue-400">
                      Scan qr code with self App
                    </h3>
                    <p className="text-xs text-blue-300">
                      Prove your humanhood with Self Protocol
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-blue-400" />
                </div>
              </button>
            )}
          </div>
        )}

        {/* Simple Menu - Translucent Design */}
        <div className="px-4 mt-6">
          <div className="bg-gray-800/20 backdrop-blur-sm rounded-xl border border-gray-700/30 overflow-hidden">
            {/* Join Telegram */}
            <a
              href="https://t.me/minilendxyz"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-700/30 transition-colors border-b border-gray-700/30 block"
            >
              <div className="flex items-center gap-3">
                <TelegramIcon className="w-5 h-5 text-blue-400" />
                <span className="font-medium text-white">
                  Join our Telegram
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>

            {/* Connect/Disconnect Wallet - Using ConnectWallet component */}
            <div className="px-4 py-4 border-b border-gray-700/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LogOut className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-white">account</span>
                </div>
                <ConnectWallet />
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="px-4 mt-6">
            <div className="bg-gray-800/20 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-700/30">
              <p className="text-gray-400">Loading profile data...</p>
            </div>
          </div>
        )}
      </div>

      {/* Self Verification Modal */}
      <Dialog
        open={isVerificationModalOpen}
        onOpenChange={setIsVerificationModalOpen}
      >
        <DialogContent className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-center">
              scan qr code with self app
            </DialogTitle>
          </DialogHeader>

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
                disabled={!universalLink || !address || isVerifying}
                className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:from-gray-500 disabled:to-gray-500 transition-all duration-200 text-white font-medium py-2 px-3 rounded-lg text-xs disabled:cursor-not-allowed shadow-lg"
              >
                {linkCopied ? "Copied!" : "Copy Link"}
              </button>

              <button
                type="button"
                onClick={openSelfApp}
                disabled={!universalLink || !address || isVerifying}
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
        </DialogContent>
      </Dialog>

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
};
