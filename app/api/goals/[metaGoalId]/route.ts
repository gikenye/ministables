import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  VAULTS,
  CONTRACTS,
  GOAL_MANAGER_ABI,
  getContractsForChain,
  getVaultsForChain,
} from "@/lib/backend/constants";
import { createProvider, formatAmountForDisplay, isValidAddress } from "@/lib/backend/utils";
import { getMetaGoalsCollection } from "@/lib/backend/database";
import { GoalSyncService } from "@/lib/backend/services/goal-sync.service";
import type { ErrorResponse, VaultAsset, MetaGoalWithProgress } from "@/lib/backend/types";

type ChainParams = {
  chainId?: string | number | null;
  chain?: string | null;
  vaultAddress?: string | null;
  contractAddress?: string | null;
};

function resolveChainContext(params: ChainParams) {
  const vaults = getVaultsForChain(params);
  const contracts = getContractsForChain(params);
  const provider = createProvider(params);
  return { vaults, contracts, provider };
}

const isGoalNotFoundError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  const reason = (error as { reason?: unknown }).reason;
  const shortMessage = (error as { shortMessage?: unknown }).shortMessage;

  return [message, reason, shortMessage].some(
    (value) => typeof value === "string" && value.includes("Not found")
  );
};

export async function GET(
  request: NextRequest,
  { params }: { params: { metaGoalId: string } }
): Promise<NextResponse<Partial<MetaGoalWithProgress> | ErrorResponse>> {
  try {
    const { metaGoalId } = params;
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("userAddress");
    const invitedBy = searchParams.get("invitedBy");
    const chainParams: ChainParams = {
      chainId: searchParams.get("chainId"),
      chain: searchParams.get("chain"),
    };

    if (!metaGoalId || typeof metaGoalId !== 'string' || metaGoalId.length > 100) {
      return NextResponse.json({ error: "Invalid metaGoalId" }, { status: 400 });
    }

    const collection = await getMetaGoalsCollection();
    let metaGoal = await collection.findOne({ metaGoalId });

    if (!metaGoal) {
      // Try to find by on-chain goal ID (if metaGoalId is actually a goalId)
      const { provider, contracts, vaults } = resolveChainContext(chainParams);
      const syncService = new GoalSyncService(provider, contracts, vaults);
      const result = await syncService.getGoalWithFallback(metaGoalId);
      
      if (!result.metaGoal) {
        return NextResponse.json({ error: "Meta-goal not found" }, { status: 404 });
      }
      
      metaGoal = await collection.findOne({ metaGoalId: result.metaGoal.metaGoalId });
      if (!metaGoal) {
        return NextResponse.json({ error: "Meta-goal not found" }, { status: 404 });
      }
    }

    // Access control for private goals
    if (metaGoal.isPublic === false) {
      if (!userAddress) {
        return NextResponse.json({ error: "Authentication required for private goals." }, { status: 401 });
      }
      const normalizedUser = userAddress.toLowerCase();
      const isCreator = metaGoal.creatorAddress.toLowerCase() === normalizedUser;
      const isParticipant = metaGoal.participants?.includes(normalizedUser);
      const isInvited = metaGoal.invitedUsers?.includes(normalizedUser);
      
      if (invitedBy && !isInvited && !isCreator && !isParticipant) {
        if (!isValidAddress(invitedBy) || invitedBy.toLowerCase() !== metaGoal.creatorAddress.toLowerCase()) {
          return NextResponse.json({ error: "Invalid invitation" }, { status: 403 });
        }
        await collection.updateOne(
          { metaGoalId },
          { $addToSet: { invitedUsers: normalizedUser }, $set: { updatedAt: new Date().toISOString() } }
        );
      } else if (!isCreator && !isParticipant && !isInvited) {
        return NextResponse.json({ error: "Access denied. This is a private goal." }, { status: 403 });
      }
    }

    const { provider, contracts, vaults } = resolveChainContext(chainParams);
    const goalManager = new ethers.Contract(contracts.GOAL_MANAGER, GOAL_MANAGER_ABI, provider);

    let totalProgressUSD = 0;
    const vaultProgress: Record<VaultAsset, {
      goalId: string;
      progressUSD: number;
      progressPercent: number;
      attachmentCount: number;
    }> = {} as Record<VaultAsset, {
      goalId: string;
      progressUSD: number;
      progressPercent: number;
      attachmentCount: number;
    }>;

    const progressPromises = Object.entries(metaGoal.onChainGoals).map(
      async ([asset, goalId]) => {
        try {
          const [totalValue] = await goalManager.getGoalProgressFull(goalId);
          const attachmentCount = await goalManager.attachmentCount(goalId);
          const vaultConfig = vaults[asset as VaultAsset];
          const progressUSD = parseFloat(formatAmountForDisplay(totalValue.toString(), vaultConfig.decimals));
          return { asset, goalId, progressUSD, attachmentCount: Number(attachmentCount) };
        } catch (error) {
          if (isGoalNotFoundError(error)) {
            console.warn(`Goal ${goalId} not found on-chain; returning zero progress.`);
          } else {
            console.error(`Error getting progress for goal ${goalId}:`, error);
          }
          return { asset, goalId, progressUSD: 0, attachmentCount: 0 };
        }
      }
    );

    const results = await Promise.all(progressPromises);
    results.forEach(({ asset, goalId, progressUSD, attachmentCount }) => {
      totalProgressUSD += progressUSD;
      vaultProgress[asset as VaultAsset] = {
        goalId,
        progressUSD,
        progressPercent: metaGoal.targetAmountUSD > 0 ? (progressUSD / metaGoal.targetAmountUSD) * 100 : 0,
        attachmentCount,
      };
    });

    const overallProgressPercent = metaGoal.targetAmountUSD > 0 ? 
      (totalProgressUSD / metaGoal.targetAmountUSD) * 100 : 0;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteLink = `${baseUrl}/goals/${metaGoalId}`;

    return NextResponse.json({
      metaGoalId,
      name: metaGoal.name,
      targetAmountUSD: metaGoal.targetAmountUSD,
      targetDate: metaGoal.targetDate,
      creatorAddress: metaGoal.creatorAddress,
      totalProgressUSD,
      progressPercent: Math.min(overallProgressPercent, 100),
      vaultProgress,
      inviteLink,
    });
  } catch (error) {
    console.error("Get meta-goal progress error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
