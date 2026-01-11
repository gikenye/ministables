import { useState } from "react";
import { reportError } from "@/lib/services/errorReportingService";
import { vaultService } from "@/lib/services/vaultService";
import type { VaultPosition, VaultDeposit } from "@/lib/services/vaultService";

export interface WithdrawableDeposit {
  depositId: number;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  withdrawableAmount: string;
  lockTier: number;
  depositTime: number;
  unlockTime: number;
}

/**
 * Format token amounts from raw decimals to human-readable strings
 */
export const formatTokenAmount = (amount: string, decimals: number): string => {
  const value = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;

  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");

  return trimmedFractional
    ? `${wholePart}.${trimmedFractional}`
    : wholePart.toString();
};

/**
 * Custom hook to fetch and manage vault positions
 */
export function useVaultPositions() {
  const [vaultPositions, setVaultPositions] = useState<WithdrawableDeposit[]>(
    []
  );
  const [vaultPositionsLoading, setVaultPositionsLoading] = useState(false);
  const [vaultPositionsError, setVaultPositionsError] = useState<string | null>(
    null
  );

  const fetchVaultPositions = async (
    chain: any,
    address: string,
    tokenSymbols: string[]
  ) => {
    if (!address || !chain || !tokenSymbols?.length) {
      return;
    }

    setVaultPositionsLoading(true);
    setVaultPositionsError(null);

    try {
      const positions = await vaultService.getAllVaultPositions(
        chain,
        address,
        tokenSymbols
      );

      // Transform service VaultPosition[] to WithdrawableDeposit[]
      const withdrawableDeposits: WithdrawableDeposit[] = [];

      positions.forEach((position: VaultPosition) => {
        position.deposits.forEach((deposit: VaultDeposit) => {
          // Convert raw amounts to human-readable using token decimals
          const formattedPrincipal = formatTokenAmount(
            deposit.principal,
            position.decimals
          );
          const formattedCurrentValue = formatTokenAmount(
            deposit.currentValue,
            position.decimals
          );

          const withdrawableAmount = deposit.canWithdraw
            ? formattedCurrentValue
            : "0";

          withdrawableDeposits.push({
            depositId: deposit.depositId,
            tokenAddress: position.tokenAddress,
            tokenSymbol: position.tokenSymbol,
            amount: formattedPrincipal,
            withdrawableAmount,
            lockTier: 0, // Default value since not in service interface
            depositTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // Default to 30 days ago
            unlockTime: deposit.lockEnd * 1000, // Convert to milliseconds
          });
        });
      });

      setVaultPositions(withdrawableDeposits);
      return withdrawableDeposits;
    } catch (error) {
      reportError("Failed to fetch vault positions", {
        component: "useVaultPositions",
        operation: "fetchVaultPositions",
        chainId: chain?.id,
        additional: { error },
      });
      setVaultPositionsError("Failed to load your positions");
      setVaultPositions([]);
      return [];
    } finally {
      setVaultPositionsLoading(false);
    }
  };

  return {
    vaultPositions,
    vaultPositionsLoading,
    vaultPositionsError,
    fetchVaultPositions,
  };
}
