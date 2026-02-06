import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import type { Db } from "mongodb";
import { GOAL_MANAGER_ABI, getContractsForChain } from "@/lib/backend/constants";
import { connectToDatabase, getMetaGoalsCollection } from "@/lib/backend/database";
import { createBackendWallet, createProvider, isValidAddress } from "@/lib/backend/utils";
import type { ErrorResponse, MetaGoal } from "@/lib/backend/types";
import { getGoalsForChain, resolveChainKey } from "@/lib/backend/metaGoalMapping";

type InviteLink = {
  metaGoalId: string;
  inviterAddress: string;
  token: string;
  issuedAt: string;
  expiresAt: Date;
  createdAt: Date;
};

function isAlreadyMemberError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  const reason = (error as { reason?: unknown }).reason;
  const shortMessage = (error as { shortMessage?: unknown }).shortMessage;
  const combined = [message, reason, shortMessage]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    (combined.includes("already") || combined.includes("exists")) &&
    (combined.includes("member") || combined.includes("participant"))
  );
}

function resolveChainKeyForInvite(
  metaGoal: MetaGoal,
  params: { chainId?: number | string | null; chain?: string | null }
): { chainKey: ReturnType<typeof resolveChainKey>; chainParams: { chainId?: number | string | null; chain?: string | null } } {
  let chainKey = resolveChainKey(params);
  let chainParams: { chainId?: number | string | null; chain?: string | null } = {
    chainId: params.chainId ?? undefined,
    chain: params.chain ?? undefined,
  };

  if (!chainKey && metaGoal.onChainGoalsByChain) {
    const chainEntries = Object.entries(metaGoal.onChainGoalsByChain).filter(
      ([, assetMap]) => Object.values(assetMap || {}).some((goalId) => !!goalId)
    );
    if (chainEntries.length === 1) {
      chainKey = chainEntries[0][0] as ReturnType<typeof resolveChainKey>;
      chainParams = { chain: chainKey as string };
    }
  }

  return { chainKey, chainParams };
}

export async function POST(
  request: NextRequest
): Promise<
  NextResponse<
    | {
        success: boolean;
        metaGoalId?: string;
        invitedAddress?: string;
      }
    | ErrorResponse
  >
> {
  try {
    const { metaGoalId, inviteToken, invitedAddress, chainId, chain } =
      await request.json();

    if (!metaGoalId || !inviteToken || !invitedAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof metaGoalId !== "string" || metaGoalId.length > 100) {
      return NextResponse.json({ error: "Invalid metaGoalId" }, { status: 400 });
    }

    if (typeof inviteToken !== "string" || inviteToken.length > 128) {
      return NextResponse.json({ error: "Invalid inviteToken" }, { status: 400 });
    }

    if (typeof invitedAddress !== "string" || !isValidAddress(invitedAddress)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const db = await connectToDatabase();
    const inviteCollection = db.collection<InviteLink>("invite_links");
    const inviteLink = await inviteCollection.findOne({
      metaGoalId,
      token: inviteToken,
    });

    if (!inviteLink) {
      return NextResponse.json({ error: "Invite link not found" }, { status: 404 });
    }

    if (inviteLink.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Invite link expired" }, { status: 410 });
    }

    const collection = await getMetaGoalsCollection();
    const metaGoal = (await collection.findOne({ metaGoalId })) as MetaGoal | null;

    if (!metaGoal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const normalizedInvited = invitedAddress.toLowerCase();
    const participants = (metaGoal.participants || []).map((participant) =>
      participant.toLowerCase()
    );

    if (participants.includes(normalizedInvited)) {
      return NextResponse.json({
        success: true,
        metaGoalId,
        invitedAddress: normalizedInvited,
      });
    }

    const { chainKey, chainParams } = resolveChainKeyForInvite(metaGoal, {
      chainId,
      chain,
    });
    const chainGoals = getGoalsForChain(metaGoal, chainKey);
    const goalIds = Object.values(chainGoals || {}).filter(Boolean) as string[];

    if (goalIds.length === 0) {
      return NextResponse.json(
        { error: "Unable to resolve chain goals for invite" },
        { status: 400 }
      );
    }

    const provider = createProvider(chainParams);
    const backendWallet = createBackendWallet(provider);
    const contracts = getContractsForChain(chainParams);
    const goalManager = new ethers.Contract(
      contracts.GOAL_MANAGER,
      GOAL_MANAGER_ABI,
      backendWallet
    );

    for (const goalId of goalIds) {
      try {
        const tx = await goalManager.forceAddMember(
          BigInt(goalId),
          normalizedInvited
        );
        await tx.wait();
      } catch (onChainError) {
        if (!isAlreadyMemberError(onChainError)) {
          throw onChainError;
        }
      }
    }

    await collection.updateOne(
      { metaGoalId },
      {
        $addToSet: {
          invitedUsers: normalizedInvited,
          participants: normalizedInvited,
        },
        $set: { updatedAt: new Date().toISOString() },
      }
    );

    return NextResponse.json({
      success: true,
      metaGoalId,
      invitedAddress: normalizedInvited,
    });
  } catch (error) {
    console.error("Invite accept error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
