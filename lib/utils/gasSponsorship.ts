import { ethers } from "ethers";
import { GAS_SPONSORSHIP_CONFIG } from "@/config/chainConfig";
import { gasSponsorshipService } from "@/services/gasSponsorshipService";

/**
 * Execute a transaction with optional gas sponsorship
 */
export async function executeWithGasSponsorship<T>(
  userAddress: string,
  transactionCallback: () => Promise<T>,
  options: {
    sponsorGas: boolean;
    gasLimit?: number;
  }
): Promise<T> {
  const { sponsorGas, gasLimit = 150000 } = options;

  console.log("[Gas Sponsorship] executeWithGasSponsorship called", { userAddress, sponsorGas, gasLimit });

  if (!sponsorGas || !GAS_SPONSORSHIP_CONFIG.ENABLED || !GAS_SPONSORSHIP_CONFIG.SPONSOR_PK) {
    console.log("[Gas Sponsorship] Skipping sponsorship", { 
      sponsorGas, 
      enabled: GAS_SPONSORSHIP_CONFIG.ENABLED,
      hasPrivateKey: !!GAS_SPONSORSHIP_CONFIG.SPONSOR_PK 
    });
    return await transactionCallback();
  }

  console.log("[Gas Sponsorship] Starting gas sponsorship process");

  if (typeof window === "undefined" || !window.ethereum) {
    console.error("[Gas Sponsorship] Ethereum provider not available");
    throw new Error("Ethereum provider not available");
  }

  console.log("[Gas Sponsorship] Creating provider and sponsor wallet");
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const sponsorWallet = new ethers.Wallet(
    GAS_SPONSORSHIP_CONFIG.SPONSOR_PK,
    provider
  );

  console.log("[Gas Sponsorship] Sponsor wallet address:", sponsorWallet.address);

  const result = await gasSponsorshipService.sponsorTransaction(
    userAddress,
    provider,
    sponsorWallet,
    transactionCallback,
    gasLimit
  );

  if (!result.success) {
    console.error("[Gas Sponsorship] Sponsorship failed:", result.error);
    throw new Error(result.error || "Gas sponsorship failed");
  }

  console.log("[Gas Sponsorship] Sponsorship successful");
  return result.result!;
}

/**
 * Log gas information for a transaction
 */
export async function logGasInfo(userAddress: string, gasLimit: number = 150000) {
  if (typeof window === "undefined" || !window.ethereum) return;

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const userBalance = await provider.getBalance(userAddress);
  const feeData = await provider.getFeeData();

  const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.BigNumber.from(0);
  const estimatedGasCost = maxFeePerGas ? maxFeePerGas.mul(gasLimit) : ethers.BigNumber.from(0);

  console.log("[Gas Info]", {
    userBalance: ethers.utils.formatEther(userBalance),
    maxFeePerGas: maxFeePerGas ? ethers.utils.formatUnits(maxFeePerGas, "gwei") + " gwei" : "N/A",
    maxPriorityFeePerGas: ethers.utils.formatUnits(maxPriorityFeePerGas, "gwei") + " gwei",
    gasLimit,
    estimatedGasCost: ethers.utils.formatEther(estimatedGasCost),
    shortfall: userBalance.lt(estimatedGasCost)
      ? ethers.utils.formatEther(estimatedGasCost.sub(userBalance))
      : "0",
  });
}
