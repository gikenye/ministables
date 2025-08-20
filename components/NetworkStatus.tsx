"use client";
import { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      
      if (!online) {
        setShowStatus(true);
      } else {
        // Show reconnected message briefly
        setShowStatus(true);
        setTimeout(() => setShowStatus(false), 3000);
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Initial check
    updateOnlineStatus();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  if (!showStatus) return null;

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
      isOnline 
        ? 'bg-green-100 text-green-800 border border-green-200' 
        : 'bg-red-100 text-red-800 border border-red-200'
    }`}>
      <div className="flex items-center space-x-2">
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            <span>Back online</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>No internet connection</span>
          </>
        )}
      </div>
    </div>
  );
}

export function RateLimitWarning({ show, onDismiss }: { show: boolean; onDismiss: () => void }) {
  if (!show) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-100 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg shadow-lg text-sm">
      <div className="flex items-center space-x-2">
        <AlertCircle className="w-4 h-4" />
        <span>Network busy, retrying...</span>
        <button 
          onClick={onDismiss}
          className="ml-2 text-yellow-600 hover:text-yellow-800"
        >
          ×
        </button>
      </div>
    </div>
  );
}