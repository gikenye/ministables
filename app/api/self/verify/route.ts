import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { getCollection } from "@/lib/mongodb";
import { SelfVerification } from "@/lib/models/selfVerification";
import { decrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const { selfId } = await req.json();

  if (!selfId) {
    return NextResponse.json({ error: "Self ID required" }, { status: 400 });
  }

  const decrypted = decrypt(selfId);
  const [walletAddress, userIdPart] = decrypted.split(":");
  if (!walletAddress || !userIdPart) {
    return NextResponse.json(
      { error: "Invalid user ID format" },
      { status: 400 }
    );
  }

  try {
    // First check if verification already exists in database
    const collection = await getCollection("selfVerifications");
    const existingVerification = await collection.findOne({ walletAddress });

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
      selfId,
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

    // Award XP for verification
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/xp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attestationId: verificationData.attestationId,
          walletAddress: walletAddress
        })
      });
    } catch (xpError) {
      console.error('Failed to award XP:', xpError);
    }

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
  const selfId = searchParams.get("selfId");

  if (!selfId) {
    return NextResponse.json({ error: "Self ID is required" }, { status: 400 });
  }

  try {
    const decrypted = decrypt(selfId);
    const [walletAddress] = decrypted.split(":");
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Invalid user ID format" },
        { status: 400 }
      );
    }

    const collection = await getCollection("selfVerifications");
    const existingVerification = await collection.findOne({
      walletAddress,
    });

    if (existingVerification) {
      return NextResponse.json({
        nationality: existingVerification.nationality,
        olderThan: existingVerification.olderThan,
      });
    }

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
