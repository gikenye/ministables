import { NextRequest, NextResponse } from "next/server";
import { GoalService } from "@/lib/services/goalService";

/**
 * GET /api/goals/[goalId]/transactions
 * Get transactions for a specific goal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const transactions = await GoalService.getGoalTransactions(
      params.goalId,
      userId,
      limit
    );

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("Error fetching goal transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
