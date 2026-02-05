import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  VAULTS,
  CONTRACTS,
  GOAL_MANAGER_ABI,
  getContractsForChain,
  getVaultsForChain,
} from "@/lib/backend/constants";
import { createProvider, createBackendWallet, findEventInLogs, getContractCompliantTargetDate } from "@/lib/backend/utils";
import { getMetaGoalsCollection } from "@/lib/backend/database";
import type { ErrorResponse, VaultAsset } from "@/lib/backend/types";

interface ExpandGoalRequest {
  goalId: string;
  newVaults: VaultAsset[];
  userAddress: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<{ success: boolean; metaGoalId: string; newOnChainGoals: Partial<Record<VaultAsset, string>> } | ErrorResponse>> {
  try {
    const body: ExpandGoalRequest = await request.json();
    const { goalId, newVaults, userAddress } = body;
    const chainParams = {
      chainId: (body as { chainId?: string | number }).chainId,
      chain: (body as { chain?: string }).chain,
    };

    const provider = createProvider(chainParams);
    const backendWallet = createBackendWallet(provider);
    const contracts = getContractsForChain(chainParams);
    const goalManager = new ethers.Contract(contracts.GOAL_MANAGER, GOAL_MANAGER_ABI, backendWallet);
    const collection = await getMetaGoalsCollection();
    const vaults = getVaultsForChain(chainParams);

    let metaGoal;
    let isNewMetaGoal = false;

    if (goalId.includes('-')) {
      metaGoal = await collection.findOne({ metaGoalId: goalId });
    } else {
      const onChainGoal = await goalManager.goals(goalId);
      let existingVault: VaultAsset | null = null;
      for (const [asset, config] of Object.entries(vaults)) {
        if (config.address.toLowerCase() === onChainGoal.vault.toLowerCase()) {
          existingVault = asset as VaultAsset;
          break;
        }
      }

      metaGoal = {
        metaGoalId: `expanded-${goalId}-${Date.now()}`,
        name: onChainGoal.metadataURI || `Goal ${goalId}`,
        targetAmountUSD: 1000,
        targetDate: new Date(Number(onChainGoal.targetDate) * 1000).toISOString(),
        creatorAddress: userAddress,
        onChainGoals: { [existingVault!]: goalId } as Record<VaultAsset, string>,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      isNewMetaGoal = true;
    }

    const newOnChainGoals: Partial<Record<VaultAsset, string>> = {};
    for (const asset of newVaults) {
      if (metaGoal!.onChainGoals[asset]) continue;

      const vaultConfig = vaults[asset];
      const targetAmountWei = ethers.parseUnits(metaGoal!.targetAmountUSD.toString(), vaultConfig.decimals);
      const parsedTargetDate = getContractCompliantTargetDate();

      const tx = await goalManager.createGoalFor(
        userAddress,
        vaultConfig.address,
        targetAmountWei,
        parsedTargetDate,
        metaGoal!.name
      );

      const receipt = await tx.wait();
      const goalEvent = findEventInLogs(receipt.logs, goalManager, "GoalCreated");
      
      if (goalEvent) {
        newOnChainGoals[asset] = goalEvent.args.goalId.toString();
        metaGoal!.onChainGoals[asset] = goalEvent.args.goalId.toString();
      }
    }

    console.log(`Created on-chain goals for meta-goal ${metaGoal?.metaGoalId}:`, newOnChainGoals);

    if (isNewMetaGoal && metaGoal) {
      await collection.insertOne(metaGoal);
    } else if (metaGoal) {
      await collection.updateOne(
        { metaGoalId: metaGoal!.metaGoalId },
        { $set: { onChainGoals: metaGoal!.onChainGoals, updatedAt: new Date().toISOString() } }
      );
    }

    return NextResponse.json({
      success: true,
      metaGoalId: metaGoal!.metaGoalId,
      newOnChainGoals
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
