import React from "react";
import {
  generateUsernameFromAddress,
  countryCodeToFlag,
} from "@/lib/utils/profileUtils";
import { CheckCircle } from "lucide-react";

// Generate a deterministic cover pattern from wallet address
const generateCoverPattern = (address: string): string => {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 120) % 360;

  return `linear-gradient(135deg, hsl(${hue1}, 70%, 35%) 0%, hsl(${hue2}, 60%, 25%) 100%)`;
};

// Generate a deterministic avatar from wallet address
const generateAvatar = (address: string): string => {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  const saturation = 70 + (Math.abs(hash) % 30);
  const lightness = 45 + (Math.abs(hash) % 20);

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

interface ProfileHeroProps {
  walletAddress: string;
  username?: string;
  countryCode?: string;
  isVerified?: boolean;
  className?: string;
}

export const ProfileHero = ({
  walletAddress,
  username,
  countryCode,
  isVerified = false,
  className = "",
}: ProfileHeroProps) => {
  const displayUsername =
    username || generateUsernameFromAddress(walletAddress);
  const avatarColor = generateAvatar(walletAddress);
  const coverPattern = generateCoverPattern(walletAddress);

  return (
    <div className={`px-4 pt-4 ${className}`}>
      {/* Simplified Profile Layout */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-14 h-14 rounded-full border-2 border-gray-700/30 flex items-center justify-center text-white text-base font-bold shadow-lg"
          style={{ backgroundColor: avatarColor }}
        >
          {displayUsername.slice(0, 2).toUpperCase()}
        </div>

        {/* User Info */}
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <h1 className="text-lg font-bold text-white">{displayUsername}</h1>
            {countryCode && (
              <span className="text-base" title={`From ${countryCode}`}>
                {countryCodeToFlag(countryCode)}
              </span>
            )}
            {isVerified && (
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-blue-400 font-medium">
                  Verified
                </span>
              </div>
            )}
          </div>

          {/* Wallet Address */}
          <p className="text-xs text-gray-400 font-mono">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </p>
        </div>
      </div>
    </div>
  );
};
