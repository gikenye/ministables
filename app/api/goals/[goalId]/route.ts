import { NextRequest, NextResponse } from "next/server";
import { GoalService } from "@/lib/services/goalService";

/**
 * GET /api/goals/[goalId]
 * Get a specific goal by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const goal = await GoalService.getGoalById(params.goalId, userId);

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    return NextResponse.json({ goal });
  } catch (error) {
    console.error("Error fetching goal:", error);
    return NextResponse.json(
      { error: "Failed to fetch goal" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/goals/[goalId]
 * Update a goal
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const body = await request.json();
    const { userId, ...updateData } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Remove fields that shouldn't be updated directly
    delete updateData.currentAmount;
    delete updateData.progress;
    delete updateData.totalInterestEarned;
    delete updateData.createdAt;
    delete updateData.isQuickSave;

    const goal = await GoalService.updateGoal(
      params.goalId,
      userId,
      updateData
    );

    if (!goal) {
      return NextResponse.json(
        { error: "Goal not found or update failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({ goal });
  } catch (error) {
    console.error("Error updating goal:", error);
    return NextResponse.json(
      { error: "Failed to update goal" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/goals/[goalId]
 * Delete a goal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const success = await GoalService.deleteGoal(params.goalId, userId);

    if (!success) {
      return NextResponse.json(
        { error: "Goal not found or could not be deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Goal deleted successfully" });
  } catch (error) {
    console.error("Error deleting goal:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to delete goal" },
      { status: 500 }
    );
  }
}
