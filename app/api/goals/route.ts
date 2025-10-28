import { NextRequest, NextResponse } from "next/server";
import { GoalService } from "@/lib/services/goalService";
import { Goal, NewGoal } from "@/lib/models/goal";

/**
 * GET /api/goals
 * Get all goals for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const category = searchParams.get("category");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    let goals: Goal[];

    if (category) {
      goals = await GoalService.getUserGoalsByCategory(userId, category as any);
    } else {
      goals = await GoalService.getUserGoals(userId);
    }

    return NextResponse.json({ goals });
  } catch (error) {
    console.error("Error fetching goals:", error);
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals
 * Create a new goal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ...goalData } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = [
      "title",
      "category",
      "targetAmount",
      "tokenAddress",
      "tokenSymbol",
      "tokenDecimals",
    ];
    for (const field of requiredFields) {
      if (!goalData[field] && goalData[field] !== 0) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    const newGoal: NewGoal = {
      userId,
      title: goalData.title,
      description: goalData.description,
      category: goalData.category,
      status: goalData.status || "active",
      currentAmount: "0",
      targetAmount: goalData.targetAmount,
      tokenAddress: goalData.tokenAddress,
      tokenSymbol: goalData.tokenSymbol,
      tokenDecimals: goalData.tokenDecimals,
      interestRate: goalData.interestRate || 5.0,
      isPublic: goalData.isPublic || false,
      allowContributions: goalData.allowContributions || false,
      isQuickSave: false,
      targetDate: goalData.targetDate
        ? new Date(goalData.targetDate)
        : undefined,
      autoSave: goalData.autoSave,
      icon: goalData.icon,
      tags: goalData.tags,
    };

    const goal = await GoalService.createGoal(newGoal);

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    console.error("Error creating goal:", error);
    return NextResponse.json(
      { error: "Failed to create goal" },
      { status: 500 }
    );
  }
}
