import React from "react";
import { Wallet, LogOut, ChevronRight, Shield } from "lucide-react";
import { ConnectWallet } from "../ConnectWallet";
import Link from "next/link";

export const AccountSettingsCard = () => {
  const handleLogout = () => {
    // Handle logout logic
    console.log("Logout clicked");
    // You can implement actual logout logic here
  };

  return (
    <div className="bg-gray-800 rounded-lg mx-4 mt-4 overflow-hidden">
      {/* Section Header */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-900">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          Account
        </h3>
      </div>

      {/* Connect/Disconnect Wallet */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Wallet className="w-5 h-5 text-gray-400" />
            <span className="text-white">Manage wallet</span>
          </div>
          <ConnectWallet />
        </div>
      </div>

      {/* Verify Identity */}
      <Link href="/self" className="block px-4 py-3 border-b border-gray-700 hover:bg-gray-750 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="text-white block">Verify Identity</span>
              <span className="text-xs text-gray-400">Complete KYC verification</span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </Link>

      {/* Log out */}
      <button
        onClick={handleLogout}
        className="w-full px-4 py-3 hover:bg-gray-750 transition-colors text-red-400 hover:text-red-300"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <LogOut className="w-5 h-5" />
            <span>Log out</span>
          </div>
          <ChevronRight className="w-5 h-5" />
        </div>
      </button>
    </div>
  );
};
