import { NextRequest, NextResponse } from "next/server";
import { backendApiClient } from "@/lib/services/backendApiService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("userAddress");
    const start = searchParams.get("start");
    const limit = searchParams.get("limit");

    // If userAddress is provided, return user score
    if (userAddress) {
      try {
        const userScore = await backendApiClient.getUserScore(userAddress);
        return NextResponse.json(userScore);
      } catch (error) {
        console.error("[API] Failed to get user score:", error);
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to get user score",
          },
          { status: 500 }
        );
      }
    }

    // Otherwise, return leaderboard with pagination
    const startNum = start ? parseInt(start, 10) : 0;
    const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 10; // Cap at 100

    if (startNum < 0 || limitNum <= 0) {
      return NextResponse.json(
        { error: "Invalid pagination parameters" },
        { status: 400 }
      );
    }

    try {
      const leaderboard = await backendApiClient.getLeaderboard(
        startNum,
        limitNum
      );
      return NextResponse.json(leaderboard);
    } catch (error) {
      console.error("[API] Failed to get leaderboard:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to get leaderboard",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[API] Leaderboard API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    { error: "Method not allowed. Use GET." },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed. Use GET." },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed. Use GET." },
    { status: 405 }
  );
}
