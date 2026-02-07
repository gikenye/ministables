import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { connectToDatabase, getMetaGoalsCollection } from "@/lib/backend/database";
import { isValidAddress } from "@/lib/backend/utils";
import type { ErrorResponse } from "@/lib/backend/types";
import { ensureUserInDb } from "@/lib/services/userService";
import type { InviteLinkAction } from "@/lib/utils/inviteLinkMessage";

const INVITE_LINK_NONCE_TTL_MS = 5 * 60 * 1000;

type InviteLinkNonce = {
  metaGoalId: string;
  inviterAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: Date;
  createdAt: Date;
  action: InviteLinkAction;
};

const VALID_ACTIONS: InviteLinkAction[] = ["invite-link:create", "invite-link:revoke"];

export async function POST(
  request: NextRequest
): Promise<
  NextResponse<
    | {
        success: boolean;
        nonce?: string;
        issuedAt?: string;
        expiresAt?: string;
      }
    | ErrorResponse
  >
> {
  try {
    const { metaGoalId, inviterAddress, action } = await request.json();

    if (!metaGoalId || !inviterAddress || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (typeof metaGoalId !== "string" || metaGoalId.length > 100) {
      return NextResponse.json({ error: "Invalid metaGoalId" }, { status: 400 });
    }

    if (typeof inviterAddress !== "string" || typeof action !== "string") {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    if (!VALID_ACTIONS.includes(action as InviteLinkAction)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
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
    await ensureUserInDb(db, normalizedInviter, {}, {
      source: "invite-link.challenge",
      additional: { metaGoalId, action },
    });

    const nonce = randomBytes(16).toString("hex");
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + INVITE_LINK_NONCE_TTL_MS);

    const nonceCollection = db.collection<InviteLinkNonce>("invite_link_nonces");
    await nonceCollection.deleteMany({
      metaGoalId,
      inviterAddress: normalizedInviter,
      action,
    });
    await nonceCollection.insertOne({
      metaGoalId,
      inviterAddress: normalizedInviter,
      nonce,
      issuedAt,
      expiresAt,
      createdAt: new Date(),
      action,
    });

    return NextResponse.json({
      success: true,
      nonce,
      issuedAt,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Invite link challenge error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
