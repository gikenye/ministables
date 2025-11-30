import { useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';

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

  const forceRefresh = useCallback(async () => {
    if (!account?.address) return;
    
    try {
      // Force fresh fetch from remote API
      await fetch('/api/user-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: account.address })
      });
      
      // Trigger UI update
      onGoalsUpdate();
    } catch (error) {
      console.warn('Failed to refresh goals:', error);
    }
  }, [account?.address, onGoalsUpdate]);

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