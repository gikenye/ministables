import { useEffect } from "react";

interface UseNetworkStatusProps {
  setIsOnline: (isOnline: boolean) => void;
}

export function useNetworkStatus({ setIsOnline }: UseNetworkStatusProps) {
  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    updateStatus();
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, [setIsOnline]);
}
