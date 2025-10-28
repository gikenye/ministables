import { NextRequest, NextResponse } from "next/server";
import { GoalService } from "@/lib/services/goalService";

/**
 * GET /api/goals/stats
 * Get goal statistics for the authenticated user
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

    const stats = await GoalService.getUserGoalStats(userId);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Error fetching goal stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch goal statistics" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals/stats/calculate-interest
 * Calculate and add interest to all user goals
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const updatedGoals = await GoalService.calculateInterest(userId);

    return NextResponse.json({
      message: "Interest calculated successfully",
      updatedGoals: updatedGoals.length,
      goals: updatedGoals,
    });
  } catch (error) {
    console.error("Error calculating interest:", error);
    return NextResponse.json(
      { error: "Failed to calculate interest" },
      { status: 500 }
    );
  }
}
