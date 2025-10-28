import { NextRequest, NextResponse } from "next/server";
import { GoalService } from "@/lib/services/goalService";

/**
 * POST /api/goals/[goalId]/deposit
 * Deposit money to a goal
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const body = await request.json();
    const { userId, amount, transactionData } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }

    const result = await GoalService.depositToGoal(
      params.goalId,
      userId,
      amount,
      transactionData || {}
    );

    return NextResponse.json(
      {
        goal: result.goal,
        transaction: result.transaction,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error depositing to goal:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to deposit to goal" },
      { status: 500 }
    );
  }
}
