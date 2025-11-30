import { useState, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  AllocateResponse,
  mapTokenSymbolToAsset,
  isValidEthereumAddress,
  isValidTransactionHash,
} from "@/lib/services/backendApiService";
import { reportError, reportInfo } from "@/lib/services/errorReportingService";

interface UseAllocateResult {
  allocateDeposit: (
    params: AllocateDepositParams
  ) => Promise<AllocateResponse | null>;
  loading: boolean;
  error: string | null;
  lastAllocation: AllocateResponse | null;
}

interface AllocateDepositParams {
  tokenSymbol: string;
  amount: string; // Amount in wei as string
  txHash: string;
  userAddress?: string; // Optional override, defaults to connected account
  targetGoalId?: string; // Optional target goal ID for goal-specific deposits
  lockTier?: number; // Lock tier in days (default: 30)
}

/**
 * Hook for handling deposit allocation to backend vaults
 * Integrates with the backend /api/allocate endpoint
 */
export function useAllocate(): UseAllocateResult {
  const account = useActiveAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAllocation, setLastAllocation] = useState<AllocateResponse | null>(
    null
  );

  const allocateDeposit = useCallback(
    async (params: AllocateDepositParams): Promise<AllocateResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        // Validate parameters
        const userAddress = params.userAddress || account?.address;

        if (!userAddress) {
          throw new Error(
            "No wallet connected. Please connect your wallet first."
          );
        }

        if (!isValidEthereumAddress(userAddress)) {
          throw new Error("Invalid user address provided.");
        }

        if (!isValidTransactionHash(params.txHash)) {
          throw new Error("Invalid transaction hash provided.");
        }

        if (!params.amount || params.amount === "0") {
          throw new Error("Invalid amount provided.");
        }

        // Map token symbol to supported asset
        const asset = mapTokenSymbolToAsset(params.tokenSymbol);
        if (!asset) {
          throw new Error(
            `Unsupported token: ${params.tokenSymbol}. Supported tokens: USDC, cUSD, USDT, cKES`
          );
        }

        // Prepare allocation request
        const allocateRequest = {
          tokenSymbol: params.tokenSymbol,
          userAddress,
          amount: params.amount,
          txHash: params.txHash,
          targetGoalId: params.targetGoalId, // Include target goal ID if provided
          lockTier: params.lockTier || 30, // Default to 30-day lock tier
        };

        // Report allocation attempt
        reportInfo("Backend allocation started", {
          component: "useAllocate",
          operation: "allocateDeposit",
          userId: userAddress,
          amount: params.amount,
          transactionHash: params.txHash,
          tokenSymbol: params.tokenSymbol,
          additional: { asset },
        });

        console.log("[useAllocate] SENDING REQUEST TO /api/allocate:", JSON.stringify(allocateRequest, null, 2));

        // Call local API route which will call the backend
        console.log("[useAllocate] Making fetch request to /api/allocate with body:", JSON.stringify(allocateRequest, null, 2));
        const response = await fetch("/api/allocate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(allocateRequest),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const result = (await response.json()) as AllocateResponse;

        // Validate response
        if (!result.success) {
          throw new Error("Allocation failed on backend");
        }

        setLastAllocation(result);

        // Report successful allocation
        reportInfo("Backend allocation completed successfully", {
          component: "useAllocate",
          operation: "allocateDeposit",
          additional: { result },
        });

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Unknown error during allocation";
        setError(errorMessage);

        // Report allocation error
        reportError(err as Error, {
          component: "useAllocate",
          operation: "allocateDeposit",
          tokenSymbol: params.tokenSymbol,
          amount: params.amount,
          transactionHash: params.txHash,
          userId: params.userAddress || account?.address,
        });

        return null;
      } finally {
        setLoading(false);
      }
    },
    [account?.address]
  );

  return {
    allocateDeposit,
    loading,
    error,
    lastAllocation,
  };
}

// Helper hook for getting allocation status
export function useAllocationStatus(txHash?: string) {
  const [allocationStatus, setAllocationStatus] = useState<{
    allocated: boolean;
    quicksaveGoalId?: string;
    depositId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const checkAllocationStatus = useCallback(async () => {
    if (!txHash) return;

    setLoading(true);
    try {
      // This would be implemented if the backend provides a status endpoint
      // For now, we'll just return the last allocation status
      // In the future, you might want to add a /api/allocate/status endpoint

      reportInfo("Checking allocation status", {
        component: "useAllocationStatus",
        transactionHash: txHash,
      });
    } catch (error) {
      reportError(error as Error, {
        component: "useAllocationStatus",
        transactionHash: txHash,
      });
    } finally {
      setLoading(false);
    }
  }, [txHash]);

  return {
    allocationStatus,
    loading,
    checkAllocationStatus,
  };
}
