
import { ethers } from "ethers";

const GAS_SPONSORSHIP_ENABLED =
  process.env.NEXT_PUBLIC_GAS_SPONSORSHIP_ENABLED === "true";

export class GasSponsorshipError extends Error {
  isSponsorshipError = true;

  constructor(message: string) {
    super(message);
    this.name = "GasSponsorshipError";
  }
}

/**
 * Execute a transaction with optional gas sponsorship
 */
export async function executeWithGasSponsorship<T>(
  userAddress: string,
  transactionCallback: () => Promise<T>,
  options: {
    sponsorGas: boolean;
    gasLimit?: number;
    chainId: number;
  }
): Promise<T> {
  const { sponsorGas, gasLimit = 150000, chainId } = options;

  console.log("[Gas Sponsorship] executeWithGasSponsorship called", {
    userAddress,
    sponsorGas,
    gasLimit,
    chainId,
  });

  if (!sponsorGas || !GAS_SPONSORSHIP_ENABLED) {
    console.log("[Gas Sponsorship] Skipping sponsorship", {
      sponsorGas,
      enabled: GAS_SPONSORSHIP_ENABLED,
    });
    return await transactionCallback();
  }

  if (!chainId) {
    console.warn("[Gas Sponsorship] Missing chainId, skipping sponsorship");
    return await transactionCallback();
  }

  console.log("[Gas Sponsorship] Requesting server-side sponsorship");

  try {
    const response = await fetch("/api/sponsor-transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAddress, chainId, gasLimit }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData?.error ||
        `Gas sponsorship failed (status ${response.status})`;
      console.error("[Gas Sponsorship] Sponsorship failed:", errorMessage);
      throw new GasSponsorshipError(errorMessage);
    }

    const sponsorResult = await response.json().catch(() => ({}));
    if (!sponsorResult?.success) {
      const errorMessage =
        sponsorResult?.error || "Gas sponsorship failed on server";
      console.error("[Gas Sponsorship] Sponsorship failed:", errorMessage);
      throw new GasSponsorshipError(errorMessage);
    }
  } catch (error) {
    if (error instanceof GasSponsorshipError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Gas sponsorship failed";
    throw new GasSponsorshipError(message);
  }

  console.log("[Gas Sponsorship] Sponsorship successful");
  return await transactionCallback();
}

/**
 * Log gas information for a transaction
 */
export async function logGasInfo(userAddress: string, gasLimit: number = 150000) {
  if (typeof window === "undefined" || !window.ethereum) return;

  const provider = new ethers.BrowserProvider(window.ethereum);
  const userBalance = await provider.getBalance(userAddress);
  const feeData = await provider.getFeeData();

  const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 0n;
  const estimatedGasCost = maxFeePerGas * BigInt(gasLimit);

  console.log("[Gas Info]", {
    userBalance: ethers.formatEther(userBalance),
    maxFeePerGas: maxFeePerGas ? ethers.formatUnits(maxFeePerGas, "gwei") + " gwei" : "N/A",
    maxPriorityFeePerGas: ethers.formatUnits(maxPriorityFeePerGas, "gwei") + " gwei",
    gasLimit,
    estimatedGasCost: ethers.formatEther(estimatedGasCost),
    shortfall: userBalance < estimatedGasCost
      ? ethers.formatEther(estimatedGasCost - userBalance)
      : "0",
  });
}
