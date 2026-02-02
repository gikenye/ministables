import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { GroupGoalService } from "@/lib/services/groupGoalService";

/**
 * GET /api/group-goals/stats
 * Get group goal statistics for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const stats = await GroupGoalService.getUserGroupGoalStats(userId);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Error fetching group goal stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch group goal stats" },
      { status: 500 }
    );
  }
}
