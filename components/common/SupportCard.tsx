import React from "react";
import { HelpCircle, ExternalLink } from "lucide-react";

export const SupportCard = () => {
  const handleGetHelp = () => {
    // Handle help - could open WhatsApp, email, or help center
    window.open("https://wa.me/+25451201818", "_blank");
  };

  return (
    <div className="bg-gray-800/20 backdrop-blur-sm rounded-lg mx-4 mt-3 overflow-hidden border border-gray-700/30">
      {/* Section Header */}
      <div className="px-3 py-2.5 border-b border-gray-700/30 bg-gray-800/20 backdrop-blur-sm">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Support
        </h3>
      </div>

      {/* Get Help */}
      <button
        onClick={handleGetHelp}
        className="w-full px-3 py-2.5 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <HelpCircle className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-white">Get Help</span>
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400" />
        </div>
      </button>
    </div>
  );
};
