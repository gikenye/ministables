import React from "react";
import { HelpCircle, ExternalLink } from "lucide-react";

export const SupportCard = () => {
  const handleGetHelp = () => {
    // Handle help - could open WhatsApp, email, or help center
    window.open("https://wa.me/+25451201818", "_blank");
  };

  return (
    <div className="bg-gray-800 rounded-lg mx-4 mt-4 overflow-hidden">
      {/* Section Header */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-900">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          Support
        </h3>
      </div>

      {/* Get Help */}
      <button
        onClick={handleGetHelp}
        className="w-full px-4 py-3 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <HelpCircle className="w-5 h-5 text-gray-400" />
            <span className="text-white">Get Help</span>
          </div>
          <ExternalLink className="w-5 h-5 text-gray-400" />
        </div>
      </button>
    </div>
  );
};
