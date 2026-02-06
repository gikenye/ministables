import { NextRequest, NextResponse } from "next/server";
import { RequestValidator } from "@/lib/backend/validators/request.validator";
import { ActivityIndexer } from "@/lib/backend/services/activity-indexer.service";
import type { ActivityResponse, ErrorResponse } from "@/lib/backend/types";
import { XPService } from "@/lib/backend/services/xp.service";
import { createProvider } from "@/lib/backend/utils";
import { getContractsForChain, getVaultsForChain } from "@/lib/backend/constants";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(
  request: NextRequest
): Promise<NextResponse<ActivityResponse | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("userAddress");

    const validation = RequestValidator.validateUserAddress(userAddress);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error! }, { status: 400 });
    }

    const limitParam = searchParams.get("limit");
    const limit = Number.parseInt(limitParam || String(DEFAULT_LIMIT), 10);
    if (Number.isNaN(limit) || limit < 1 || limit > MAX_LIMIT) {
      return NextResponse.json(
        { error: `Invalid limit parameter. Must be between 1 and ${MAX_LIMIT}.` },
        { status: 400 }
      );
    }

    const normalizedAddress = userAddress!.toLowerCase();
    const activities = await ActivityIndexer.getActivities(normalizedAddress, limit);
    try {
      const provider = createProvider();
      const xpService = new XPService(
        provider,
        getContractsForChain({}),
        getVaultsForChain({})
      );
      await xpService.awardActivityXP(normalizedAddress);
    } catch (xpError) {
      console.warn("Failed to award activity XP", xpError);
    }

    const response: ActivityResponse = {
      userAddress: normalizedAddress,
      startBlock: 0,
      endBlock: 0,
      limit,
      activities,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Activity API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

