import { ethers } from "ethers";

interface GasRequest {
  userAddress: string;
  timestamp: number;
  gasAmount: string;
}

class GasSponsorshipService {
  private requestHistory: Map<string, GasRequest[]> = new Map();
  private readonly MAX_REQUESTS_PER_HOUR = 5;
  private readonly MAX_GAS_PER_DAY = ethers.utils.parseEther("0.01");
  private readonly HOUR_MS = 60 * 60 * 1000;
  private readonly DAY_MS = 24 * this.HOUR_MS;

  private cleanOldRequests(userAddress: string) {
    const requests = this.requestHistory.get(userAddress) || [];
    const now = Date.now();
    const filtered = requests.filter(req => now - req.timestamp < this.DAY_MS);
    this.requestHistory.set(userAddress, filtered);
  }

  private getRecentRequests(userAddress: string, timeWindow: number): GasRequest[] {
    const requests = this.requestHistory.get(userAddress) || [];
    const now = Date.now();
    return requests.filter(req => now - req.timestamp < timeWindow);
  }

  private validateRequest(userAddress: string, gasAmount: ethers.BigNumber): { valid: boolean; error?: string } {
    if (!ethers.utils.isAddress(userAddress)) {
      return { valid: false, error: "Invalid user address" };
    }

    if (gasAmount.lte(0)) {
      return { valid: false, error: "Invalid gas amount" };
    }

    this.cleanOldRequests(userAddress);

    const hourlyRequests = this.getRecentRequests(userAddress, this.HOUR_MS);
    if (hourlyRequests.length >= this.MAX_REQUESTS_PER_HOUR) {
      return { valid: false, error: "Hourly request limit exceeded" };
    }

    const dailyRequests = this.getRecentRequests(userAddress, this.DAY_MS);
    const dailyTotal = dailyRequests.reduce(
      (sum, req) => sum.add(ethers.BigNumber.from(req.gasAmount)),
      ethers.BigNumber.from(0)
    );
    if (dailyTotal.add(gasAmount).gt(this.MAX_GAS_PER_DAY)) {
      return { valid: false, error: "Daily gas limit exceeded" };
    }

    return { valid: true };
  }

  private recordRequest(userAddress: string, gasAmount: ethers.BigNumber) {
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
    estimatedGas: ethers.BigNumber,
    provider: ethers.providers.Provider,
    sponsorWallet: ethers.Wallet
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    console.log("[Gas Sponsorship Service] sponsorGas - Step 1: Starting", {
      userAddress,
      estimatedGas: ethers.utils.formatEther(estimatedGas),
      sponsorWalletAddress: sponsorWallet.address,
    });

    try {
      console.log("[Gas Sponsorship Service] sponsorGas - Step 2: Validating request");
      const validation = this.validateRequest(userAddress, estimatedGas);
      if (!validation.valid) {
        console.error("[Gas Sponsorship Service] sponsorGas - Validation failed:", validation.error);
        return { success: false, error: validation.error };
      }
      console.log("[Gas Sponsorship Service] sponsorGas - Step 3: Validation passed");

      console.log("[Gas Sponsorship Service] sponsorGas - Step 4: Checking sponsor balance");
      const balance = await provider.getBalance(sponsorWallet.address);
      console.log("[Gas Sponsorship Service] sponsorGas - Sponsor wallet balance:", ethers.utils.formatEther(balance));
      
      if (balance.lt(estimatedGas)) {
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
    provider: ethers.providers.Provider,
    sponsorWallet: ethers.Wallet,
    transactionCallback: () => Promise<T>,
    gasLimit: number = 100000
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    console.log("[Gas Sponsorship Service] Step 1: Starting sponsorTransaction", { userAddress, gasLimit });

    try {
      console.log("[Gas Sponsorship Service] Step 2: Getting fee data");
      const feeData = await provider.getFeeData();
      const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || ethers.BigNumber.from(0);
      const estimatedGas = maxFeePerGas.mul(gasLimit);

      console.log("[Gas Sponsorship Service] Step 3: Estimated gas:", {
        maxFeePerGas: ethers.utils.formatUnits(maxFeePerGas, "gwei") + " gwei",
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas 
          ? ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, "gwei") + " gwei"
          : "N/A",
        gasLimit: gasLimit.toString(),
        total: ethers.utils.formatEther(estimatedGas),
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
    const hourlyRequests = this.getRecentRequests(userAddress, this.HOUR_MS);
    const dailyRequests = this.getRecentRequests(userAddress, this.DAY_MS);
    const dailyTotal = dailyRequests.reduce(
      (sum, req) => sum.add(ethers.BigNumber.from(req.gasAmount)),
      ethers.BigNumber.from(0)
    );
    
    return {
      hourly: this.MAX_REQUESTS_PER_HOUR - hourlyRequests.length,
      daily: ethers.utils.formatEther(this.MAX_GAS_PER_DAY.sub(dailyTotal)),
    };
  }
}

export const gasSponsorshipService = new GasSponsorshipService();
