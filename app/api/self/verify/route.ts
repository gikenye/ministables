import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { SelfVerification } from "@/lib/models/selfVerification";
import { decrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json(
      { error: "User ID required" },
      { status: 400 }
    );
  }

  const walletAddress = decrypt(userId);

  try {
    // First check if verification already exists in database
    const collection = await getCollection("selfVerifications");
    const existingVerification = await collection.findOne({ userId });

    if (existingVerification) {
      return NextResponse.json({
        nationality: existingVerification.nationality,
        olderThan: existingVerification.olderThan,
      });
    }

    // Try calling the external verification service with the requestor address first
    // From blockchain data, requestor is usually 0x4ea3a08de3d5cc74a5b2e20ba813af1ab3765956
    const requestorAddress = "0x4ea3a08de3d5cc74a5b2e20ba813af1ab3765956";

    let verificationResponse = await fetch(
      `https://selfda1.vercel.app/api/verification?userAddress=${requestorAddress}`
    );

    // If that doesn't work, try with the wallet address
    if (!verificationResponse.ok) {
      verificationResponse = await fetch(
        `https://selfda1.vercel.app/api/verification?userAddress=${walletAddress}`
      );
    }

    if (!verificationResponse.ok) {
      return NextResponse.json(
        { error: "No verification found" },
        { status: 404 }
      );
    }

    const verificationData = await verificationResponse.json();

    // Save to database
    const now = new Date();
    const verification: SelfVerification = {
      userId,
      walletAddress,
      sessionId: verificationData.transactionHash,
      attestationId: verificationData.attestationId,
      userIdentifier: verificationData.userIdentifier.toString(),
      nullifier: verificationData.nullifier,
      nationality: verificationData.nationality,
      olderThan: verificationData.olderThan,
      ofac: verificationData.ofac,
      forbiddenCountriesListPacked:
        verificationData.forbiddenCountriesListPacked.map((n: number) =>
          n.toString()
        ),
      userData: "Minilend verification",
      chainId: 42220,
      endpoint: "0xe57f4773bd9c9d8b6cd70431117d353298b9f5bf",
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(verification);

    return NextResponse.json({
      nationality: verificationData.nationality,
      olderThan: verificationData.olderThan,
    });
  } catch (error) {
    console.error("Error fetching verification data:", error);
    return NextResponse.json(
      { error: "Failed to fetch verification data" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "User ID is required" },
      { status: 400 }
    );
  }

  try {
    // ONLY check database - do not fallback to blockchain
    const collection = await getCollection("selfVerifications");
    const existingVerification = await collection.findOne({
      userId,
    });

    if (existingVerification) {
      return NextResponse.json({
        nationality: existingVerification.nationality,
        olderThan: existingVerification.olderThan,
      });
    }

    // If no verification found in database, return 404
    // Do NOT fallback to blockchain service
    return NextResponse.json(
      { error: "No verification found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error fetching verification data:", error);
    return NextResponse.json(
      { error: "Failed to fetch verification data" },
      { status: 500 }
    );
  }
}
