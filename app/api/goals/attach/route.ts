import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  VAULTS,
  CONTRACTS,
  GOAL_MANAGER_ABI,
  getContractsForChain,
  getVaultsForChain,
} from "@/lib/backend/constants";
import { createProvider, createBackendWallet, isValidAddress } from "@/lib/backend/utils";
import { getMetaGoalsCollection } from "@/lib/backend/database";
import { getGoalsForChain, resolveChainKey } from "@/lib/backend/metaGoalMapping";
import type {
  AttachDepositRequest,
  AttachDepositResponse,
  ErrorResponse,
  VaultAsset,
} from "@/lib/backend/types";

export async function POST(request: NextRequest): Promise<NextResponse<AttachDepositResponse | ErrorResponse>> {
  try {
    const body: AttachDepositRequest = await request.json();
    const { metaGoalId, depositVault, depositId, userAddress } = body;
    const chainParams = {
      chainId: (body as { chainId?: string | number }).chainId,
      chain: (body as { chain?: string }).chain,
      vaultAddress: depositVault,
    };
    const chainKey = resolveChainKey(chainParams);

    if (!metaGoalId || !depositVault || !depositId || !userAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!isValidAddress(depositVault) || !isValidAddress(userAddress)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    // Find meta-goal in database
    const collection = await getMetaGoalsCollection();
    const metaGoal = await collection.findOne({ metaGoalId });

    if (!metaGoal) {
      return NextResponse.json({ error: "Meta-goal not found" }, { status: 404 });
    }

    // Find the correct vault asset for the deposit
    let targetAsset: VaultAsset | null = null;
    const vaults = getVaultsForChain(chainParams);
    for (const [asset, config] of Object.entries(vaults)) {
      if (config.address.toLowerCase() === depositVault.toLowerCase()) {
        targetAsset = asset as VaultAsset;
        break;
      }
    }

    if (!targetAsset) {
      return NextResponse.json({ error: "Invalid deposit vault" }, { status: 400 });
    }

    // Get the corresponding on-chain goal ID
    const chainGoals = getGoalsForChain(metaGoal, chainKey);
    const onChainGoalId = chainGoals[targetAsset];
    if (!onChainGoalId) {
      return NextResponse.json({ 
        error: `No on-chain goal found for ${targetAsset} vault in this meta-goal` 
      }, { status: 400 });
    }

    // Attach deposit to the correct on-chain goal
    const provider = createProvider(chainParams);
    const backendWallet = createBackendWallet(provider);
    const contracts = getContractsForChain(chainParams);
    const goalManager = new ethers.Contract(contracts.GOAL_MANAGER, GOAL_MANAGER_ABI, backendWallet);

    const attachTx = await goalManager.attachDepositsOnBehalf(
      onChainGoalId,
      userAddress,
      [depositId]
    );

    await attachTx.wait();

    return NextResponse.json({
      success: true,
      metaGoalId,
      attachedToGoalId: onChainGoalId,
      vault: depositVault,
      attachTxHash: attachTx.hash,
    });
  } catch (error) {
    console.error("Attach deposit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
