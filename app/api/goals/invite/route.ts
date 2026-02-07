import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getServerSession } from "next-auth";
import { CONTRACTS, GOAL_MANAGER_ABI, getContractsForChain } from "@/lib/backend/constants";
import { connectToDatabase, getMetaGoalsCollection } from "@/lib/backend/database";
import { createBackendWallet, createProvider, isValidAddress } from "@/lib/backend/utils";
import type { ErrorResponse } from "@/lib/backend/types";
import { getGoalsForChain, resolveChainKey } from "@/lib/backend/metaGoalMapping";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ensureUserInDb } from "@/lib/services/userService";

function buildInviteMessage(params: {
  metaGoalId: string;
  invitedAddress: string;
  inviterAddress: string;
  nonce: string;
  issuedAt: string;
}): string {
  return [
    "Invite to goal",
    `metaGoalId: ${params.metaGoalId}`,
    `invitedAddress: ${params.invitedAddress}`,
    `inviterAddress: ${params.inviterAddress}`,
    `nonce: ${params.nonce}`,
    `issuedAt: ${params.issuedAt}`,
  ].join("\n");
}

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

type InviteNonce = {
  metaGoalId: string;
  inviterAddress: string;
  invitedAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: Date;
  createdAt: Date;
};

async function consumeInviteNonce(
  db: Db,
  params: {
    metaGoalId: string;
    inviterAddress: string;
    invitedAddress: string;
    nonce: string;
    issuedAt: string;
  }
): Promise<{ valid: boolean; error?: string }> {
  const collection = db.collection<InviteNonce>("invite_nonces");
  const value = await collection.findOneAndDelete({
    metaGoalId: params.metaGoalId,
    inviterAddress: params.inviterAddress,
    invitedAddress: params.invitedAddress,
    nonce: params.nonce,
    issuedAt: params.issuedAt,
  });

  if (!value) {
    return { valid: false, error: "Invalid or used nonce" };
  }

  if (value.expiresAt.getTime() <= Date.now()) {
    return { valid: false, error: "Nonce expired" };
  }

  return { valid: true };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<{ success: boolean } | ErrorResponse>> {
  try {
    const {
      metaGoalId,
      invitedAddress,
      inviterAddress,
      signature,
      issuedAt,
      nonce,
      chainId,
      chain,
    } = await request.json();
    const session = await getServerSession(authOptions);

    if (
      !metaGoalId ||
      !invitedAddress ||
      !inviterAddress ||
      !signature ||
      !issuedAt ||
      !nonce
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof metaGoalId !== "string" || metaGoalId.length > 100) {
      return NextResponse.json({ error: "Invalid metaGoalId" }, { status: 400 });
    }

    if (
      typeof invitedAddress !== "string" ||
      typeof inviterAddress !== "string" ||
      typeof signature !== "string" ||
      typeof issuedAt !== "string" ||
      typeof nonce !== "string"
    ) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    if (!isValidAddress(invitedAddress) || !isValidAddress(inviterAddress)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    if (nonce.length > 128) {
      return NextResponse.json({ error: "Invalid nonce" }, { status: 400 });
    }

    const issuedAtMs = Date.parse(issuedAt);
    if (Number.isNaN(issuedAtMs)) {
      return NextResponse.json({ error: "Invalid issuedAt" }, { status: 400 });
    }

    const collection = await getMetaGoalsCollection();
    const metaGoal = await collection.findOne({ metaGoalId });

    if (!metaGoal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const normalizedInviter = inviterAddress.toLowerCase();
    const normalizedInvited = invitedAddress.toLowerCase();
    const participants = (metaGoal.participants || []).map((participant) =>
      participant.toLowerCase()
    );
    const isCreator =
      metaGoal.creatorAddress.toLowerCase() === normalizedInviter;
    const isParticipant = participants.includes(normalizedInviter);

    if (!isCreator && !isParticipant) {
      return NextResponse.json(
        { error: "Only group members can invite users" },
        { status: 403 }
      );
    }

    // Signature binds inviter; nonce prevents replay.
    const expectedMessage = buildInviteMessage({
      metaGoalId,
      invitedAddress: normalizedInvited,
      inviterAddress: normalizedInviter,
      nonce,
      issuedAt,
    });

    try {
      const recovered = ethers.verifyMessage(expectedMessage, signature);
      if (recovered.toLowerCase() !== normalizedInviter) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } catch (signatureError) {
      console.warn("Invite signature verification failed:", signatureError);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const db = await connectToDatabase();
    await ensureUserInDb(
      db,
      normalizedInviter,
      {
        verified: session?.user?.verified,
        identityData: session?.user?.identityData,
        username: session?.user?.username,
      },
      { source: "invite.send", additional: { metaGoalId } }
    );

    const nonceStatus = await consumeInviteNonce(db, {
      metaGoalId,
      inviterAddress: normalizedInviter,
      invitedAddress: normalizedInvited,
      nonce,
      issuedAt,
    });

    if (!nonceStatus.valid) {
      return NextResponse.json(
        { error: nonceStatus.error || "Invalid nonce" },
        { status: 401 }
      );
    }

    if (participants.includes(normalizedInvited)) {
      return NextResponse.json({ success: true });
    }

    const chainParams = { chainId, chain };
    const chainKey = resolveChainKey(chainParams);
    const provider = createProvider(chainParams);
    const backendWallet = createBackendWallet(provider);
    const contracts = getContractsForChain(chainParams);
    const goalManager = new ethers.Contract(contracts.GOAL_MANAGER, GOAL_MANAGER_ABI, backendWallet);
    const chainGoals = getGoalsForChain(metaGoal, chainKey);
    const goalIds = Object.values(chainGoals || {}).filter(Boolean) as string[];

    for (const goalId of goalIds) {
      try {
        const tx = await goalManager.forceAddMember(BigInt(goalId), normalizedInvited);
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
        $addToSet: { invitedUsers: normalizedInvited, participants: normalizedInvited },
        $set: { updatedAt: new Date().toISOString() },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Invite user error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
