import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import { getServerSession } from "next-auth";
import { connectToDatabase, getMetaGoalsCollection } from "@/lib/backend/database";
import { isValidAddress } from "@/lib/backend/utils";
import type { ErrorResponse } from "@/lib/backend/types";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ensureUserInDb } from "@/lib/services/userService";
import { buildInviteLinkMessage } from "@/lib/utils/inviteLinkMessage";

const INVITE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type InviteLink = {
  metaGoalId: string;
  inviterAddress: string;
  token: string;
  issuedAt: string;
  expiresAt: Date;
  createdAt: Date;
};

type InviteLinkNonce = {
  metaGoalId: string;
  inviterAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: Date;
  createdAt: Date;
  action: "invite-link:create";
};

function getInviteDebug(session: { user?: { address?: string } } | null, inviterAddress: string) {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }
  return {
    sessionAddress: session?.user?.address ?? null,
    inviterAddress,
  };
}

async function consumeInviteLinkNonce(
  db: Awaited<ReturnType<typeof connectToDatabase>>,
  params: {
    metaGoalId: string;
    inviterAddress: string;
    nonce: string;
    issuedAt: string;
  }
): Promise<{ valid: boolean; error?: string }> {
  const collection = db.collection<InviteLinkNonce>("invite_link_nonces");
  const value = await collection.findOneAndDelete({
    metaGoalId: params.metaGoalId,
    inviterAddress: params.inviterAddress,
    nonce: params.nonce,
    issuedAt: params.issuedAt,
    action: "invite-link:create",
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
): Promise<
  NextResponse<
    | {
        success: boolean;
        inviteToken?: string;
        shareLink?: string;
        issuedAt?: string;
        expiresAt?: string;
      }
    | ErrorResponse
  >
> {
  try {
    const { metaGoalId, inviterAddress, signature, issuedAt, nonce } =
      await request.json();
    const session = await getServerSession(authOptions);
    const debug = getInviteDebug(session, inviterAddress);

    if (!metaGoalId || !inviterAddress || !signature || !issuedAt || !nonce) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof metaGoalId !== "string" || metaGoalId.length > 100) {
      return NextResponse.json({ error: "Invalid metaGoalId" }, { status: 400 });
    }

    if (
      typeof inviterAddress !== "string" ||
      typeof signature !== "string" ||
      typeof issuedAt !== "string" ||
      typeof nonce !== "string"
    ) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    if (!isValidAddress(inviterAddress)) {
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
    const participants = (metaGoal.participants || []).map((participant) =>
      participant.toLowerCase()
    );
    const isCreator =
      metaGoal.creatorAddress.toLowerCase() === normalizedInviter;
    const isParticipant = participants.includes(normalizedInviter);

    if (!isCreator && !isParticipant) {
      return NextResponse.json(
        { error: "Only group members can invite users", ...(debug ? { debug } : {}) },
        { status: 403 }
      );
    }

    const expectedMessage = buildInviteLinkMessage({
      metaGoalId,
      inviterAddress: normalizedInviter,
      nonce,
      issuedAt,
      action: "invite-link:create",
    });

    try {
      const recovered = ethers.verifyMessage(expectedMessage, signature);
      if (recovered.toLowerCase() !== normalizedInviter) {
        return NextResponse.json(
          { error: "Invalid signature", ...(debug ? { debug } : {}) },
          { status: 401 }
        );
      }
    } catch (signatureError) {
      console.warn("Invite link signature verification failed:", signatureError);
      return NextResponse.json(
        { error: "Invalid signature", ...(debug ? { debug } : {}) },
        { status: 401 }
      );
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
      { source: "invite-link", additional: { metaGoalId } }
    );

    const nonceStatus = await consumeInviteLinkNonce(db, {
      metaGoalId,
      inviterAddress: normalizedInviter,
      nonce,
      issuedAt,
    });

    if (!nonceStatus.valid) {
      return NextResponse.json(
        { error: nonceStatus.error || "Invalid nonce", ...(debug ? { debug } : {}) },
        { status: 401 }
      );
    }

    const token = randomBytes(18).toString("hex");
    const linkIssuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + INVITE_LINK_TTL_MS);

    const inviteCollection = db.collection<InviteLink>("invite_links");
    await inviteCollection.deleteMany({
      metaGoalId,
      inviterAddress: normalizedInviter,
    });
    await inviteCollection.insertOne({
      metaGoalId,
      inviterAddress: normalizedInviter,
      token,
      issuedAt: linkIssuedAt,
      expiresAt,
      createdAt: new Date(),
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareLink = `${baseUrl}/goals/${metaGoalId}?invite=${token}`;

    return NextResponse.json({
      success: true,
      inviteToken: token,
      shareLink,
      issuedAt: linkIssuedAt,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Invite link error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
