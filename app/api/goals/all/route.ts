import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { CONTRACTS, GOAL_MANAGER_ABI, getContractsForChain } from "@/lib/backend/constants";
import { createProvider, resolveTargetAmountToken } from "@/lib/backend/utils";
import { getMetaGoalsCollection } from "@/lib/backend/database";
import type { ErrorResponse, MetaGoalWithProgress, VaultAsset } from "@/lib/backend/types";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse<MetaGoalWithProgress[] | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const MAX_LIMIT = 100;
    const DEFAULT_LIMIT = 50;
    const rawLimit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT));
    const rawSkip = parseInt(searchParams.get("skip") || "0");
    const chainParams = {
      chainId: searchParams.get("chainId"),
      chain: searchParams.get("chain"),
    };
    
    const limit = Math.min(isNaN(rawLimit) ? DEFAULT_LIMIT : Math.max(1, rawLimit), MAX_LIMIT);
    const skip = isNaN(rawSkip) ? 0 : Math.max(0, rawSkip);

    const collection = await getMetaGoalsCollection();
    const metaGoals = await collection
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const provider = createProvider(chainParams);
    const contracts = getContractsForChain(chainParams);
    const goalManager = new ethers.Contract(contracts.GOAL_MANAGER, GOAL_MANAGER_ABI, provider);

    const goalsWithProgress: MetaGoalWithProgress[] = await Promise.all(
      metaGoals.map(async (metaGoal) => {
        const targetAmountToken = resolveTargetAmountToken(metaGoal);
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

        let totalProgressUSD = 0;

        const progressPromises = Object.entries(metaGoal.onChainGoals).map(
          async ([asset, goalIdStr]: [string, unknown]) => {
            try {
              const goalId = BigInt(goalIdStr as string);
              const [, percentBps] = await goalManager.getGoalProgressFull(goalId);
              const progressUSD =
                (Number(percentBps) / 10000) * targetAmountToken;
              const progressPercent = Number(percentBps) / 100;
              const attachmentCount = Number(await goalManager.attachmentCount(goalId));

              return {
                asset: asset as VaultAsset,
                data: { goalId: goalIdStr as string, progressUSD, progressPercent, attachmentCount },
              };
            } catch {
              return {
                asset: asset as VaultAsset,
                data: { goalId: goalIdStr as string, progressUSD: 0, progressPercent: 0, attachmentCount: 0 },
              };
            }
          }
        );

        const progressResults = await Promise.all(progressPromises);
        
        const participantsSet = new Set<string>();
        const MAX_ATTACHMENTS_PER_GOAL = 50;
        
        for (const { asset, data } of progressResults) {
          vaultProgress[asset] = data;
          totalProgressUSD += data.progressUSD;
          
          if (data.attachmentCount > 0) {
            try {
              const goalId = BigInt(data.goalId);
              const fetchCount = Math.min(data.attachmentCount, MAX_ATTACHMENTS_PER_GOAL);
              const attachmentPromises = [];
              
              for (let i = 0; i < fetchCount; i++) {
                attachmentPromises.push(goalManager.attachmentAt(goalId, i));
              }
              
              const attachments = await Promise.all(attachmentPromises);
              attachments.forEach(attachment => participantsSet.add(attachment.owner));
            } catch (error) {
              console.error(`Error fetching attachments for goal ${data.goalId}:`, error);
            }
          }
        }

        const progressPercent =
          targetAmountToken > 0
            ? (totalProgressUSD / targetAmountToken) * 100
            : 0;

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const inviteLink = `${baseUrl}/goals/${metaGoal.metaGoalId}`;

        const { targetAmountUSD: _legacyTargetAmount, ...metaGoalBase } =
          metaGoal as typeof metaGoal & { targetAmountUSD?: number };
        return {
          ...metaGoalBase,
          targetAmountToken,
          totalProgressUSD,
          progressPercent,
          vaultProgress,
          participants: Array.from(participantsSet),
          userBalance: "0",
          userBalanceUSD: "0.00",
          inviteLink,
        };
      })
    );

    return NextResponse.json(goalsWithProgress);
  } catch (error) {
    console.error("Get all meta-goals error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
