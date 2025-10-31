import React from "react";
import { Share2 } from "lucide-react";
import { ActionButton } from "../ui/ActionButton";

export const InviteFriendsCard = () => {
  const handleInvite = () => {
    if (navigator.share) {
      navigator.share({
        title: "Minilend - Start Saving Together",
        text: "Join me on Minilend and start building your savings goals!",
        url: window.location.origin,
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      console.log("Invite friends clicked");
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mx-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
          <Share2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-base font-medium text-white">Invite friends</h3>
            <p className="text-sm text-gray-400">
              Support your friends in growing and managing their savings.
            </p>
          </div>
        </div>
        <ActionButton
          onClick={handleInvite}
          variant="primary"
          size="sm"
          className="text-black px-4 flex-shrink-0"
        >
          Invite
        </ActionButton>
      </div>
    </div>
  );
};
