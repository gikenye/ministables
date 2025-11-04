import React from "react";
import {
  generateUsernameFromAddress,
  countryCodeToFlag,
} from "@/lib/utils/profileUtils";

// Generate a deterministic avatar from wallet address
const generateAvatar = (address: string): string => {
  // Use a simple hash to generate consistent colors
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  const saturation = 70 + (Math.abs(hash) % 30); // 70-100%
  const lightness = 45 + (Math.abs(hash) % 20); // 45-65%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

interface ProfileHeaderCardProps {
  walletAddress: string;
  memberSince: string;
  countryCode?: string;
}

export const ProfileHeaderCard = ({
  walletAddress,
  memberSince,
  countryCode,
}: ProfileHeaderCardProps) => {
  const username = generateUsernameFromAddress(walletAddress);
  const avatarColor = generateAvatar(walletAddress);

  return (
    <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 rounded-2xl p-4 mx-4 mt-3 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent"></div>

      <div className="relative flex flex-col items-center">
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-full mb-3 flex items-center justify-center text-white text-lg font-bold shadow-lg"
          style={{ backgroundColor: avatarColor }}
        >
          {username.slice(0, 2).toUpperCase()}
        </div>

        {/* Username and Country */}
        <div className="flex items-center gap-1.5 mb-2">
          <h1 className="text-lg font-bold text-white">{username}</h1>
          {countryCode && (
            <span className="text-lg" title={`From ${countryCode}`}>
              {countryCodeToFlag(countryCode)}
            </span>
          )}
        </div>

        {/* Wallet Address */}
        <p className="text-xs text-purple-200 mb-2 font-mono">
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </p>

        {/* Member Since */}
        <p className="text-xs text-purple-300">Member since {memberSince}</p>
      </div>
    </div>
  );
};
