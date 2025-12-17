import { NextRequest, NextResponse } from "next/server";
import { backendApiClient } from "@/lib/services/backendApiService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("userAddress");
    const action = searchParams.get("action");

    if (!userAddress) {
      return NextResponse.json(
        { error: "userAddress is required" },
        { status: 400 }
      );
    }

    if (action === "history") {
      const xpHistory = await backendApiClient.getUserXpHistory(userAddress);
      return NextResponse.json(xpHistory);
    }

    const xpData = await backendApiClient.getUserXp(userAddress);
    return NextResponse.json(xpData);
  } catch (error) {
    console.error("[API] Failed to get XP data:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get XP data",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metaGoalId } = body;

    if (!metaGoalId) {
      return NextResponse.json(
        { error: "metaGoalId is required" },
        { status: 400 }
      );
    }

    const result = await backendApiClient.awardXP(metaGoalId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Failed to award XP:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to award XP",
      },
      { status: 500 }
    );
  }
}
