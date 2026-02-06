import { NextRequest, NextResponse } from "next/server";
import { createProvider } from "@/lib/backend/utils";
import { getContractsForChain, getVaultsForChain } from "@/lib/backend/constants";
import { getUserXPCollection, connectToDatabase } from "@/lib/backend/database";
import { XPService } from "@/lib/backend/services/xp.service";
import type { SelfVerification } from "@/lib/backend/types";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("userAddress");
    const action = searchParams.get("action");

    if (action === "leaderboard") {
      const limit = parseInt(searchParams.get("limit") || "100");
      const collection = await getUserXPCollection();
      const leaderboard = await collection
        .aggregate([
          {
            $project: {
              userAddress: { $toLower: "$userAddress" },
              totalXP: "$totalXP",
              updatedAt: "$updatedAt",
            },
          },
          {
            $group: {
              _id: "$userAddress",
              totalXP: { $max: "$totalXP" },
              updatedAt: { $max: "$updatedAt" },
            },
          },
          { $sort: { totalXP: -1, updatedAt: -1 } },
          { $limit: limit },
        ])
        .toArray();
      return NextResponse.json({
        leaderboard: leaderboard.map((entry) => ({
          userAddress: entry._id,
          totalXP: entry.totalXP ?? 0,
          updatedAt: entry.updatedAt ?? null,
        })),
      });
    }

    if (!userAddress) {
      return NextResponse.json({ error: "userAddress required" }, { status: 400 });
    }

    const collection = await getUserXPCollection();
    const userXP = await collection.findOne({ userAddress: userAddress.toLowerCase() });

    return NextResponse.json(userXP || { userAddress: userAddress.toLowerCase(), totalXP: 0, xpHistory: [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metaGoalId, attestationId, walletAddress, chainId, chain, action, userAddress } = body;
    const chainParams = { chainId, chain };

    if (attestationId && walletAddress) {
      const db = await connectToDatabase();
      
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      const collectionName = collectionNames.find(name => 
        name.toLowerCase() === "selfverifications"
      ) || "SelfVerifications";
      
      const verification = await db.collection<SelfVerification>(collectionName).findOne({ 
        attestationId,
        walletAddress
      });
      
      if (!verification) {
        return NextResponse.json({ 
          error: "Verification not found",
          debug: { attestationId, walletAddress, availableCollections: collectionNames }
        }, { status: 404 });
      }

      const provider = createProvider(chainParams);
      const xpService = new XPService(
        provider,
        getContractsForChain(chainParams),
        getVaultsForChain(chainParams)
      );
      const result = await xpService.awardSelfVerificationXP(walletAddress);

      return NextResponse.json({ 
        success: true, 
        awarded: result.awarded, 
        totalXP: result.totalXP 
      });
    }

    if (action === "activity") {
      if (!userAddress) {
        return NextResponse.json({ error: "userAddress required" }, { status: 400 });
      }
      const provider = createProvider(chainParams);
      const xpService = new XPService(
        provider,
        getContractsForChain(chainParams),
        getVaultsForChain(chainParams)
      );
      const result = await xpService.awardActivityXP(userAddress);
      return NextResponse.json({ success: true, ...result });
    }

    if (!metaGoalId) {
      return NextResponse.json(
        { error: "metaGoalId or attestationId/walletAddress required" },
        { status: 400 }
      );
    }

    const provider = createProvider(chainParams);
    const xpService = new XPService(
      provider,
      getContractsForChain(chainParams),
      getVaultsForChain(chainParams)
    );
    const result = await xpService.checkAndAwardXP(metaGoalId);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
