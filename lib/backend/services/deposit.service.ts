import { ethers } from "ethers";
import type { VaultConfig } from "../constants";
import { BlockchainService } from "./blockchain.service";
import { formatAmountForDisplay } from "../utils";
import type { UserDeposit, AssetBalance } from "../types";

export class DepositService {
  constructor(private blockchainService: BlockchainService) {}

  async processVaultDeposits(
    vaultAddress: string,
    assetName: string,
    userAddress: string,
    vaultConfig: VaultConfig
  ): Promise<{ deposits: UserDeposit[]; assetBalance: AssetBalance }> {
    const vault = this.blockchainService.getVault(vaultAddress);
    const depositCount = await vault.depositCount(userAddress);

    if (Number(depositCount) === 0) {
      return {
        deposits: [],
        assetBalance: this.createEmptyAssetBalance(assetName, vaultAddress),
      };
    }

    const depositPromises = Array.from({ length: Number(depositCount) }, (_, i) =>
      vault.deposits(userAddress, i).catch(() => null)
    );

    const depositResults = await Promise.all(depositPromises);
    const deposits: UserDeposit[] = [];
    const assetBalance = this.createEmptyAssetBalance(assetName, vaultAddress);

    depositResults.forEach((deposit, i) => {
      if (!deposit || (deposit.principal.toString() === "0" && deposit.shares.toString() === "0")) {
        return;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const timeRemaining =
        Number(deposit.lockEnd) > currentTime ? Number(deposit.lockEnd) - currentTime : null;

      deposits.push({
        depositId: i.toString(),
        vault: vaultAddress,
        asset: assetName,
        amountWei: deposit.principal.toString(),
        amountUSD: formatAmountForDisplay(deposit.principal.toString(), vaultConfig.decimals),
        sharesWei: deposit.shares.toString(),
        sharesUSD: formatAmountForDisplay(deposit.shares.toString(), vaultConfig.decimals),
        lockTier: "0",
        lockedUntil: deposit.lockEnd.toString(),
        unlocked: Number(deposit.lockEnd) <= currentTime,
        timeRemaining,
      });

      assetBalance.totalAmountWei = (
        BigInt(assetBalance.totalAmountWei) + BigInt(deposit.principal)
      ).toString();
      assetBalance.totalSharesWei = (
        BigInt(assetBalance.totalSharesWei) + BigInt(deposit.shares)
      ).toString();
      assetBalance.depositCount++;
    });

    assetBalance.totalAmountUSD = formatAmountForDisplay(
      assetBalance.totalAmountWei,
      vaultConfig.decimals
    );
    assetBalance.totalSharesUSD = formatAmountForDisplay(
      assetBalance.totalSharesWei,
      vaultConfig.decimals
    );

    return { deposits, assetBalance };
  }

  async getUnattachedDepositIndices(
    vaultAddress: string,
    userAddress: string,
    depositCount: number
  ): Promise<number[]> {
    const vault = this.blockchainService.getVault(vaultAddress);
    const goalManager = this.blockchainService.getGoalManager();

    const checkPromises = Array.from({ length: depositCount }, async (_, i) => {
      try {
        const deposit = await vault.deposits(userAddress, i);
        
        if (deposit.principal.toString() === "0" && deposit.shares.toString() === "0") {
          return null;
        }

        const key = ethers.solidityPackedKeccak256(
          ["address", "address", "uint256"],
          [vaultAddress, userAddress, i]
        );

        const attachedGoalId = await goalManager.depositToGoal(key);
        return attachedGoalId.toString() === "0" ? i : null;
      } catch (error) {
        console.error(`Error checking attachment for deposit ${i}:`, error);
        return null;
      }
    });

    const results = await Promise.all(checkPromises);
    return results.filter((idx): idx is number => idx !== null);
  }

  private createEmptyAssetBalance(asset: string, vault: string): AssetBalance {
    return {
      asset,
      vault,
      totalAmountWei: "0",
      totalAmountUSD: "0",
      totalSharesWei: "0",
      totalSharesUSD: "0",
      depositCount: 0,
    };
  }
}
