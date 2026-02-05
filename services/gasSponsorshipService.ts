
import { ethers } from "ethers";

interface GasRequest {
  userAddress: string;
  timestamp: number;
  gasAmount: string;
}

class GasSponsorshipService {
  private requestHistory: Map<string, GasRequest[]> = new Map();
  private readonly HOUR_MS = 60 * 60 * 1000;

  private cleanOldRequests(userAddress: string) {
    const requests = this.requestHistory.get(userAddress) || [];
    const now = Date.now();
    const filtered = requests.filter((req) => now - req.timestamp < this.HOUR_MS);
    this.requestHistory.set(userAddress, filtered);
  }

  private getRecentRequests(userAddress: string, timeWindow: number): GasRequest[] {
    const requests = this.requestHistory.get(userAddress) || [];
    const now = Date.now();
    return requests.filter((req) => now - req.timestamp < timeWindow);
  }

  private validateRequest(userAddress: string, gasAmount: bigint): { valid: boolean; error?: string } {
    if (!ethers.isAddress(userAddress)) {
      return { valid: false, error: "Invalid user address" };
    }

    if (gasAmount <= 0n) {
      return { valid: false, error: "Invalid gas amount" };
    }

    this.cleanOldRequests(userAddress);

    return { valid: true };
  }

  private recordRequest(userAddress: string, gasAmount: bigint) {
    const requests = this.requestHistory.get(userAddress) || [];
    requests.push({
      userAddress,
      timestamp: Date.now(),
      gasAmount: gasAmount.toString(),
    });
    this.requestHistory.set(userAddress, requests);
  }

  async sponsorGas(
    userAddress: string,
    estimatedGas: bigint,
    provider: ethers.Provider,
    sponsorWallet: ethers.Wallet
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    console.log("[Gas Sponsorship Service] sponsorGas - Step 1: Starting", {
      userAddress,
      estimatedGas: ethers.formatEther(estimatedGas),
      sponsorWalletAddress: sponsorWallet.address,
    });

    try {
      console.log("[Gas Sponsorship Service] sponsorGas - Step 2: Validating request");
      const validation = this.validateRequest(userAddress, estimatedGas);
      if (!validation.valid) {
        console.error(
          "[Gas Sponsorship Service] sponsorGas - Validation failed:",
          validation.error
        );
        return { success: false, error: validation.error };
      }
      console.log("[Gas Sponsorship Service] sponsorGas - Step 3: Validation passed");

      console.log("[Gas Sponsorship Service] sponsorGas - Step 4: Checking sponsor balance");
      const balance = await provider.getBalance(sponsorWallet.address);
      console.log(
        "[Gas Sponsorship Service] sponsorGas - Sponsor wallet balance:",
        ethers.formatEther(balance)
      );

      if (balance < estimatedGas) {
        console.error("[Gas Sponsorship Service] sponsorGas - Insufficient sponsor balance");
        return { success: false, error: "Insufficient sponsor balance" };
      }

      console.log("[Gas Sponsorship Service] sponsorGas - Step 5: Sending gas to user wallet");
      const tx = await sponsorWallet.sendTransaction({
        to: userAddress,
        value: estimatedGas,
      });

      console.log("[Gas Sponsorship Service] sponsorGas - Step 6: Transaction sent, hash:", tx.hash);
      console.log("[Gas Sponsorship Service] sponsorGas - Step 7: Waiting for confirmation");
      await tx.wait();
      console.log("[Gas Sponsorship Service] sponsorGas - Step 8: Transaction confirmed");

      this.recordRequest(userAddress, estimatedGas);
      console.log("[Gas Sponsorship Service] sponsorGas - Step 9: Request recorded");

      return { success: true, txHash: tx.hash };
    } catch (error: any) {
      console.error("[Gas Sponsorship Service] sponsorGas - Error:", error);
      return { success: false, error: error.message || "Gas sponsorship failed" };
    }
  }

  async sponsorTransaction<T>(
    userAddress: string,
    provider: ethers.Provider,
    sponsorWallet: ethers.Wallet,
    transactionCallback: () => Promise<T>,
    gasLimit: number = 100000
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    console.log("[Gas Sponsorship Service] Step 1: Starting sponsorTransaction", { userAddress, gasLimit });

    try {
      console.log("[Gas Sponsorship Service] Step 2: Getting fee data");
      const feeData = await provider.getFeeData();
      const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
      const estimatedGas = maxFeePerGas * BigInt(gasLimit);

      console.log("[Gas Sponsorship Service] Step 3: Estimated gas:", {
        maxFeePerGas: ethers.formatUnits(maxFeePerGas, "gwei") + " gwei",
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
          ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") + " gwei"
          : "N/A",
        gasLimit: gasLimit.toString(),
        total: ethers.formatEther(estimatedGas),
      });

      console.log("[Gas Sponsorship Service] Step 4: Calling sponsorGas");
      const sponsorResult = await this.sponsorGas(
        userAddress,
        estimatedGas,
        provider,
        sponsorWallet
      );

      if (!sponsorResult.success) {
        console.error("[Gas Sponsorship Service] Step 5: Sponsorship failed", sponsorResult.error);
        return { success: false, error: sponsorResult.error };
      }

      console.log("[Gas Sponsorship Service] Step 6: Gas sponsored successfully, txHash:", sponsorResult.txHash);
      console.log("[Gas Sponsorship Service] Step 7: Executing transaction callback");

      const result = await transactionCallback();

      console.log("[Gas Sponsorship Service] Step 8: Transaction executed successfully");
      return { success: true, result };
    } catch (error: any) {
      console.error("[Gas Sponsorship Service] Error in sponsorTransaction:", error);
      return { success: false, error: error.message || "Transaction failed" };
    }
  }

  getRemainingQuota(userAddress: string): { hourly: number; daily: string } {
    this.cleanOldRequests(userAddress);
    return {
      hourly: 0,
      daily: "unlimited",
    };
  }
}

export const gasSponsorshipService = new GasSponsorshipService();
