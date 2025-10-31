import React from "react";

interface ProfileHeaderCardProps {
  username: string;
  memberSince: string;
}

export const ProfileHeaderCard = ({
  username,
  memberSince,
}: ProfileHeaderCardProps) => {
  return (
    <div className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg p-4 mx-4 mt-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-white">{username}</h1>
          <p className="text-sm text-white/80">{memberSince}</p>
        </div>
        {/* Optional: Add profile avatar or actions here */}
      </div>
    </div>
  );
};
