import React, { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  generateUsernameFromAddress,
  getMemberSinceDate,
} from "@/lib/utils/profileUtils";
import { ProfileHero } from "./ProfileHero";
import { useGoals } from "@/hooks/useGoals";
import { useUser } from "@/hooks/useUser";
import { LogOut, Shield, HelpCircle } from "lucide-react";
import { ConnectWallet } from "../ConnectWallet";

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
  const [countryCode, setCountryCode] = useState<string | undefined>();

  // Get real user data
  const { user, loading: userLoading } = useUser();
  const { goals, stats, loading: goalsLoading } = useGoals();

  // Check for Self verification
  useEffect(() => {
    if (address && !countryCode) {
      fetch(`/api/self/verify?userAddress=${address}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.nationality) {
            setCountryCode(data.nationality);
          }
        })
        .catch(() => {
          // Silently handle verification errors
        });
    }
  }, [address, countryCode]);

  if (!address) {
    return (
      <div className={`min-h-screen ${className}`}>
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gray-800/50 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700/30">
              <Shield className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Connect Your Wallet
            </h2>
            <p className="text-gray-400 text-sm">
              Connect your wallet to view your profile and start saving
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
          countryCode={countryCode}
          isVerified={!!countryCode}
        />

        {/* Simple Stats - Only Real Data */}
        <div className="px-4 mt-4">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/30">
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

        {/* Self Verification CTA - Only show if not verified */}
        {!countryCode && (
          <div className="px-4 mt-4">
            <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-400" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-400">
                    Verify Your Identity
                  </h3>
                  <p className="text-xs text-blue-300">
                    Unlock enhanced features with Self Protocol
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Simple Menu - Only Essential Items */}
        <div className="px-4 mt-6">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/30 overflow-hidden">
            {/* Help */}
            <button className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-700/50 transition-colors border-b border-gray-700/50">
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-gray-400" />
                <span className="font-medium text-white">Help & Support</span>
              </div>
            </button>

            {/* Disconnect Wallet */}
            <button
              onClick={() => {
                // TODO: Implement wallet disconnect
                console.log("Disconnect wallet");
              }}
              className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-700/50 transition-colors text-red-400"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-gray-400" />
                <span className="font-medium">Disconnect Wallet</span>
              </div>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="px-4 mt-6">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-700/30">
              <p className="text-gray-400">Loading profile data...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
