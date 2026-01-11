"use client";

import { WifiOff } from "lucide-react";

interface NetworkStatusBarProps {
  isOnline: boolean;
}

export function NetworkStatusBar({ isOnline }: NetworkStatusBarProps) {
  if (isOnline) return null;

  return (
    <div
      className="bg-red-900/60 border border-red-500/30 text-red-200 rounded-lg p-3 mb-4 text-sm flex items-center backdrop-blur-sm"
      role="alert"
      aria-live="assertive"
    >
      <WifiOff className="w-4 h-4 mr-2" aria-hidden="true" />
      <p>You are currently offline. Some features may be limited.</p>
    </div>
  );
}
