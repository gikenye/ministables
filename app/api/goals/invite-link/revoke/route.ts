import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import type { Db } from "mongodb";
import { connectToDatabase, getMetaGoalsCollection } from "@/lib/backend/database";
import { isValidAddress } from "@/lib/backend/utils";
import type { ErrorResponse } from "@/lib/backend/types";

const INVITE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type InviteLink = {
  metaGoalId: string;
  inviterAddress: string;
  token: string;
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
        inviteToken?: string;
        shareLink?: string;
        issuedAt?: string;
        expiresAt?: string;
      }
    | ErrorResponse
  >
> {
  try {
    const { metaGoalId, inviterAddress } = await request.json();

    if (!metaGoalId || !inviterAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof metaGoalId !== "string" || metaGoalId.length > 100) {
      return NextResponse.json({ error: "Invalid metaGoalId" }, { status: 400 });
    }

    if (typeof inviterAddress !== "string") {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    if (!isValidAddress(inviterAddress)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
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
        { error: "Only group members can invite users" },
        { status: 403 }
      );
    }

    const db = await connectToDatabase();
    const inviterExists = await isKnownUser(db, normalizedInviter);

    if (!inviterExists) {
      return NextResponse.json({ error: "Inviter not found" }, { status: 403 });
    }

    const token = randomBytes(18).toString("hex");
    const issuedAt = new Date().toISOString();
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
      issuedAt,
      expiresAt,
      createdAt: new Date(),
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareLink = `${baseUrl}/goals/${metaGoalId}?invite=${token}`;

    return NextResponse.json({
      success: true,
      inviteToken: token,
      shareLink,
      issuedAt,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Invite link revoke error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
