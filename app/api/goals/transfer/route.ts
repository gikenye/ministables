import { NextRequest, NextResponse } from "next/server";
import { GoalService } from "@/lib/services/goalService";

/**
 * POST /api/goals/transfer
 * Transfer money between goals
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, fromGoalId, toGoalId, amount } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (!fromGoalId || !toGoalId) {
      return NextResponse.json(
        { error: "Both source and destination goal IDs are required" },
        { status: 400 }
      );
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    if (fromGoalId === toGoalId) {
      return NextResponse.json(
        { error: "Cannot transfer to the same goal" },
        { status: 400 }
      );
    }

    const result = await GoalService.transferBetweenGoals(
      fromGoalId,
      toGoalId,
      userId,
      amount
    );

    return NextResponse.json(
      {
        fromGoal: result.fromGoal,
        toGoal: result.toGoal,
        transaction: result.transaction,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error transferring between goals:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to transfer between goals" },
      { status: 500 }
    );
  }
}
