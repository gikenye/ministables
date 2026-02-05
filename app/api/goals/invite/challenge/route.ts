import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import type { Db } from "mongodb";
import { connectToDatabase, getMetaGoalsCollection } from "@/lib/backend/database";
import { isValidAddress } from "@/lib/backend/utils";
import type { ErrorResponse } from "@/lib/backend/types";

const INVITE_NONCE_TTL_MS = 5 * 60 * 1000;

type InviteNonce = {
  metaGoalId: string;
  inviterAddress: string;
  invitedAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: Date;
  createdAt: Date;
};

async function isKnownUser(db: Db, address: string): Promise<boolean> {
  const normalizedAddress = address.toLowerCase();
  const user = await db
    .collection("users")
    .findOne({ address: normalizedAddress }, { projection: { _id: 1 } });

  return Boolean(user);
}

export async function POST(
  request: NextRequest
): Promise<
  NextResponse<
    | {
        success: boolean;
        nonce?: string;
        issuedAt?: string;
        expiresAt?: string;
        alreadyInvited?: boolean;
      }
    | ErrorResponse
  >
> {
  try {
    const { metaGoalId, invitedAddress, inviterAddress } = await request.json();

    if (!metaGoalId || !invitedAddress || !inviterAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof metaGoalId !== "string" || metaGoalId.length > 100) {
      return NextResponse.json({ error: "Invalid metaGoalId" }, { status: 400 });
    }

    if (typeof invitedAddress !== "string" || typeof inviterAddress !== "string") {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    if (!isValidAddress(invitedAddress) || !isValidAddress(inviterAddress)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
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
    const invitedUsers = (metaGoal.invitedUsers || []).map((invited) =>
      invited.toLowerCase()
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

    const db = await connectToDatabase();
    const inviterExists = await isKnownUser(db, normalizedInviter);

    if (!inviterExists) {
      return NextResponse.json({ error: "Inviter not found" }, { status: 403 });
    }

    if (
      participants.includes(normalizedInvited) ||
      invitedUsers.includes(normalizedInvited)
    ) {
      return NextResponse.json({ success: true, alreadyInvited: true });
    }

    const nonce = randomBytes(16).toString("hex");
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + INVITE_NONCE_TTL_MS);

    const nonceCollection = db.collection<InviteNonce>("invite_nonces");
    await nonceCollection.deleteMany({
      metaGoalId,
      inviterAddress: normalizedInviter,
      invitedAddress: normalizedInvited,
    });
    await nonceCollection.insertOne({
      metaGoalId,
      inviterAddress: normalizedInviter,
      invitedAddress: normalizedInvited,
      nonce,
      issuedAt,
      expiresAt,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      nonce,
      issuedAt,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Invite challenge error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
