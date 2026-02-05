import { useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useChain } from "@/components/ChainProvider";

interface UseRealTimeGoalsProps {
  onGoalsUpdate: () => void;
  intervalMs?: number;
}

/**
 * Hook to periodically refresh goals data to ensure UI stays in sync
 * with remote API changes
 */
export function useRealTimeGoals({ 
  onGoalsUpdate, 
  intervalMs = 5000 // 5 seconds default
}: UseRealTimeGoalsProps) {
  const account = useActiveAccount();
  const { chain } = useChain();

  const forceRefresh = useCallback(async () => {
    if (!account?.address) return;
    
    try {
      const params = new URLSearchParams({ userAddress: account.address });
      if (chain?.id) params.set("chainId", String(chain.id));
      const url = `/api/user-positions?${params}`;
      // Force fresh fetch from API
      await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      
      // Trigger UI update
      onGoalsUpdate();
    } catch (error) {
      console.warn('Failed to refresh goals:', error);
    }
  }, [account?.address, chain?.id, onGoalsUpdate]);

  // Set up periodic refresh
  useEffect(() => {
    if (!account?.address) return;

    const interval = setInterval(forceRefresh, intervalMs);
    return () => clearInterval(interval);
  }, [account?.address, forceRefresh, intervalMs]);

  // Refresh on visibility change (when user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && account?.address) {
        forceRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [account?.address, forceRefresh]);

  return { forceRefresh };
}
