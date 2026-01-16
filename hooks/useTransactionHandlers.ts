import { useState } from "react";
import { parseUnits } from "viem";
import {
  reportInfo,
  reportError,
  reportWarning,
} from "@/lib/services/errorReportingService";
import { mapTokenSymbolToAsset } from "@/lib/services/backendApiService";
import { reportTransactionToDivvi } from "@/lib/services/divviService";
import { backendApiClient } from "@/lib/services/backendApiService";
import { activityService } from "@/lib/services/activityService";

interface DepositSuccess {
  amount: string;
  transactionHash?: string;
}

/**
 * Custom hook providing handlers for transaction success and error states
 */
export function useTransactionHandlers() {
  const [isDepositLoading, setIsDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<string | null>(
    null
  );
  const [depositSuccess, setDepositSuccess] = useState<DepositSuccess | null>(
    null
  );

  /**
   * Handle deposit transaction errors with user-friendly messages
   */
  const handleDepositError = (error: Error) => {
    let userMessage = "Transaction failed. Please try again.";

    if (
      error.message.includes("user rejected") ||
      error.message.includes("User rejected")
    ) {
      userMessage = "Transaction was cancelled.";
    } else if (error.message.includes("insufficient funds")) {
      userMessage = "Insufficient funds for this transaction.";
    } else if (error.message.includes("transfer amount exceeds allowance")) {
      userMessage = "Token approval failed. Please try again.";
    } else if (error.message.includes("network")) {
      userMessage =
        "Network error. Please check your connection and try again.";
    }

    setDepositError(userMessage);
  };

  /**
   * Handle successful deposit transaction
   */
  const handleDepositSuccess = async (
    receipt: any,
    amount: string,
    selectedToken: any,
    defaultToken: any,
    chain: any,
    account: any,
    goalConfirmationOpen: boolean = false,
    selectedGoal: any = null,
    onRefresh?: () => void
  ) => {
    // Report successful transaction for monitoring
    reportInfo("Deposit successful", {
      component: "useTransactionHandlers",
      operation: "handleDepositSuccess",
      transactionHash: receipt?.transactionHash,
      amount,
      tokenSymbol: selectedToken?.symbol || defaultToken?.symbol,
      chainId: chain?.id,
    });

    // Set the success state
    setDepositSuccess({
      amount,
      transactionHash: receipt.transactionHash,
    });

    // Track activity
    const goalName = goalConfirmationOpen && selectedGoal?.name ? selectedGoal.name : undefined;
    activityService.trackDeposit(
      parseFloat(amount),
      selectedToken?.symbol || defaultToken?.symbol || "USDC",
      receipt.transactionHash,
      goalName,
      account?.address
    );

    // Call backend allocation API
    try {
      if (account?.address && defaultToken && receipt?.transactionHash) {
        const amountWei = parseUnits(amount, defaultToken.decimals || 6);

        // Map token symbol to supported asset
        const mappedAsset = mapTokenSymbolToAsset(
          selectedToken?.symbol || defaultToken.symbol
        );
        if (!mappedAsset) {
          throw new Error(
            `Unsupported token: ${selectedToken?.symbol || defaultToken.symbol}`
          );
        }

        const targetGoalId =
          goalConfirmationOpen && selectedGoal?.onChainGoals?.[mappedAsset]
            ? selectedGoal.onChainGoals[mappedAsset]
            : undefined;

        const allocationRequest = {
          asset: mappedAsset,
          userAddress: account.address,
          amount: amountWei.toString(),
          txHash: receipt.transactionHash,
          targetGoalId,
        };

        try {
          const allocationResult = await backendApiClient.allocateDeposit(
            allocationRequest
          );

          if (allocationResult && allocationResult.success) {
            reportInfo("Backend allocation completed successfully", {
              component: "useTransactionHandlers",
              operation: "handleDepositSuccess",
              transactionHash: receipt.transactionHash,
              additional: {
                goalId: allocationResult.goalId,
                depositId: allocationResult.depositId,
                shares: allocationResult.shares,
                formattedShares: allocationResult.formattedShares,
                targetGoalId: allocationRequest.targetGoalId,
              },
            });

            if (allocationResult.goalCompleted && allocationResult.metaGoalId) {
              const xpResponse = await fetch("/api/xp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  metaGoalId: allocationResult.metaGoalId,
                }),
              });
              const xpData = await xpResponse.json();

              if (xpData.awarded) {
                const xpEarned = xpData.recipients
                  ? Object.values(xpData.recipients)[0]
                  : 0;
                reportInfo(`Goal completed! You earned ${xpEarned} XP!`, {
                  component: "useTransactionHandlers",
                  operation: "handleDepositSuccess",
                });
              }
            }
          } else {
            reportWarning("Deposit successful but allocation may have issues", {
              component: "useTransactionHandlers",
              operation: "handleDepositSuccess",
              transactionHash: receipt.transactionHash,
              additional: {
                allocationResult,
                targetGoalId: allocationRequest.targetGoalId,
              },
            });
          }
        } catch (allocationError) {
          reportWarning("Deposit successful but allocation tracking failed", {
            component: "useTransactionHandlers",
            operation: "handleDepositSuccess",
            transactionHash: receipt.transactionHash,
            additional: {
              targetGoalId: allocationRequest.targetGoalId,
              error: allocationError,
            },
          });
        }
      }
    } catch (error) {
      reportError(error as Error, {
        component: "useTransactionHandlers",
        operation: "handleDepositSuccess",
        transactionHash: receipt?.transactionHash,
      });
    }

    // Update data after allocation
    try {
      // Report to Divvi after successful transaction
      reportTransactionToDivvi(receipt.transactionHash, chain.id);

      // Call refresh function if provided
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      reportError(error as Error, {
        component: "useTransactionHandlers",
        operation: "handleDepositSuccess",
        transactionHash: receipt?.transactionHash,
      });
    }

    // Reset states after delay
    setTimeout(() => {
      setIsDepositLoading(false);
      setDepositSuccess(null);
      setTransactionStatus(null);
      setDepositError(null);
    }, 3000);
  };

  /**
   * Handle onramp deposit success
   */
  const handleOnrampSuccess = () => {
    setDepositError("");
    setTransactionStatus("");
    setIsDepositLoading(false);
  };

  return {
    isDepositLoading,
    setIsDepositLoading,
    depositError,
    setDepositError,
    transactionStatus,
    setTransactionStatus,
    depositSuccess,
    setDepositSuccess,
    handleDepositError,
    handleDepositSuccess,
    handleOnrampSuccess,
  };
}
