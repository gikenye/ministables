import React, { useEffect } from "react";
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
import { useVerificationStatus } from "@/hooks/useVerificationStatus";
import { LogOut, Shield, HelpCircle, ExternalLink } from "lucide-react";
import { ConnectWallet } from "../ConnectWallet";

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

  // Get real user data
  const { user, loading: userLoading } = useUser();
  const { goals, stats, loading: goalsLoading } = useGoals();

  // Get verification status from our database
  const {
    isVerified,
    nationality,
    loading: verificationLoading,
    refetch: refetchVerification,
  } = useVerificationStatus();

  // Refresh verification status when component regains focus
  useEffect(() => {
    const handleFocus = () => {
      refetchVerification();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchVerification]);

  // Handle verification click
  const handleVerificationClick = () => {
    router.push("/self");
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
  const goalsCompleted = stats?.completedGoals || 0;

  const loading = userLoading || goalsLoading;

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
                  {showBalance ? `$${totalSaved}` : "••••"}
                </p>
                <p className="text-xs text-gray-400">Total Saved</p>
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
        {(!isVerified || verificationLoading) && (
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
                      Verify Your Identity
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
              href="https://t.me/your_telegram_group" // Replace with your actual Telegram link
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
    </div>
  );
};
