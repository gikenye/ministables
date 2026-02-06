import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createProvider } from "@/lib/backend/utils";
import { getContractsForChain, getVaultsForChain } from "@/lib/backend/constants";
import { getUserXPCollection, connectToDatabase } from "@/lib/backend/database";
import { XPService } from "@/lib/backend/services/xp.service";
import type { SelfVerification } from "@/lib/backend/types";

export const dynamic = 'force-dynamic';

const ACTIVITY_RATE_LIMIT_WINDOW_MS = Number.parseInt(
  process.env.XP_ACTIVITY_RATE_LIMIT_WINDOW_MS ?? "60000",
  10
);
const ACTIVITY_RATE_LIMIT_MAX = Number.parseInt(
  process.env.XP_ACTIVITY_RATE_LIMIT_MAX ?? "10",
  10
);
const ACTIVITY_RATE_LIMIT_GLOBAL_MAX = Number.parseInt(
  process.env.XP_ACTIVITY_RATE_LIMIT_GLOBAL_MAX ?? "100",
  10
);
const ACTIVITY_RATE_LIMIT_WINDOW = Number.isFinite(ACTIVITY_RATE_LIMIT_WINDOW_MS) && ACTIVITY_RATE_LIMIT_WINDOW_MS > 0
  ? ACTIVITY_RATE_LIMIT_WINDOW_MS
  : 60000;
const ACTIVITY_RATE_LIMIT_PER_USER = Number.isFinite(ACTIVITY_RATE_LIMIT_MAX) && ACTIVITY_RATE_LIMIT_MAX > 0
  ? ACTIVITY_RATE_LIMIT_MAX
  : 10;
const ACTIVITY_RATE_LIMIT_GLOBAL = Number.isFinite(ACTIVITY_RATE_LIMIT_GLOBAL_MAX) && ACTIVITY_RATE_LIMIT_GLOBAL_MAX > 0
  ? ACTIVITY_RATE_LIMIT_GLOBAL_MAX
  : 100;

const activityRateLimitBuckets = new Map<string, number[]>();

function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = activityRateLimitBuckets.get(key) ?? [];
  const recent = timestamps.filter((timestamp) => timestamp > cutoff);
  if (recent.length >= limit) {
    activityRateLimitBuckets.set(key, recent);
    return true;
  }
  recent.push(now);
  activityRateLimitBuckets.set(key, recent);
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("userAddress");
    const action = searchParams.get("action");

    if (action === "leaderboard") {
      const limitParam = searchParams.get("limit");
      const parsedLimit = Number.parseInt(limitParam || "100", 10);
      const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 1000)
        : 100;
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

    if (action === "activity") {
      const expectedApiKey = process.env.XP_API_KEY;
      const providedApiKey = request.headers.get("x-api-key");
      const apiKeyValid = Boolean(
        expectedApiKey && providedApiKey && providedApiKey === expectedApiKey
      );
      let sessionAddress: string | null = null;
      if (!apiKeyValid) {
        const session = await getServerSession(authOptions);
        sessionAddress = session?.user?.address ?? null;
      }

      if (!apiKeyValid && !sessionAddress) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: providedApiKey ? 403 : 401 }
        );
      }

      if (!userAddress) {
        return NextResponse.json({ error: "userAddress required" }, { status: 400 });
      }

      if (
        sessionAddress &&
        sessionAddress.toLowerCase() !== userAddress.toLowerCase()
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const normalizedAddress = userAddress.toLowerCase();
      if (
        isRateLimited(
          `activity:user:${normalizedAddress}`,
          ACTIVITY_RATE_LIMIT_PER_USER,
          ACTIVITY_RATE_LIMIT_WINDOW
        ) ||
        isRateLimited(
          "activity:global",
          ACTIVITY_RATE_LIMIT_GLOBAL,
          ACTIVITY_RATE_LIMIT_WINDOW
        )
      ) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429 }
        );
      }

      const result = await XPService.awardActivityXP(normalizedAddress);
      return NextResponse.json({ success: true, ...result });
    }

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
