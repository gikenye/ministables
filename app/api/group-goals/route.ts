import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { GroupGoalService } from "@/lib/services/groupGoalService";
import { NewGroupGoal } from "@/lib/models/groupGoal";
import type { GoalCategory } from "@/lib/models/goal";
import {
  isClientError,
  GroupGoalValidationError,
} from "@/lib/errors/GroupGoalErrors";

/**
 * GET /api/group-goals
 * Get group goals for the authenticated user or public group goals
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type"); // "user", "owned", "public"
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const categoryFilter: GoalCategory | undefined =
      typeof category === "string" ? (category as GoalCategory) : undefined;

    if (search) {
      // Handle search
      const results = await GroupGoalService.searchGroupGoals(
        search,
        userId || undefined,
        categoryFilter,
        limit
      );
      return NextResponse.json({ groupGoals: results });
    }

    if (type === "public") {
      // Get public group goals for discovery
      const groupGoals = await GroupGoalService.getPublicGroupGoals(
        limit,
        offset,
        categoryFilter
      );
      return NextResponse.json({ groupGoals });
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required for user-specific requests" },
        { status: 400 }
      );
    }

    let groupGoals;
    if (type === "owned") {
      // Get group goals owned by the user
      groupGoals = await GroupGoalService.getOwnedGroupGoals(userId);
    } else {
      // Get all group goals for the user (as member or owner)
      groupGoals = await GroupGoalService.getUserGroupGoals(userId);
    }

    return NextResponse.json({ groupGoals });
  } catch (error) {
    console.error("Error fetching group goals:", error);
    return NextResponse.json(
      { error: "Failed to fetch group goals" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/group-goals
 * Create a new group goal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ...groupGoalData } = body;

    if (!userId) {
      throw new GroupGoalValidationError("User ID is required");
    }

    // Validate required fields
    const requiredFields = [
      "title",
      "targetAmount",
      "tokenAddress",
      "tokenSymbol",
      "tokenDecimals",
    ];
    for (const field of requiredFields) {
      if (!groupGoalData[field]) {
        throw new GroupGoalValidationError(`${field} is required`);
      }
    }

    const newGroupGoal: NewGroupGoal = {
      ...groupGoalData,
      ownerId: userId,
      status: "active",
      visibility: groupGoalData.visibility || "public",
      // Set default rules if not provided
      rules: groupGoalData.rules || {
        minimumContribution: "0",
        maximumContribution: undefined,
        contributionDeadline: undefined,
        allowWithdrawals: false,
        withdrawalPenalty: 0,
        votingRequired: false,
        votingThreshold: 50,
        autoDistribute: false,
        distributionDate: undefined,
      },
      // Set default social settings
      isPublic: groupGoalData.isPublic !== false,
      allowInvites: groupGoalData.allowInvites !== false,
      requireApproval: groupGoalData.requireApproval || false,
      chatEnabled: groupGoalData.chatEnabled !== false,
    };

    const groupGoal = await GroupGoalService.createGroupGoal(newGroupGoal);

    return NextResponse.json({ groupGoal }, { status: 201 });
  } catch (error) {
    console.error("Error creating group goal:", error);

    // Check error type
    if (error instanceof Error && isClientError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Log error details
    if (error instanceof Error) {
      console.error("Error creating group goal:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    } else {
      console.error("Unknown error creating group goal:", error);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
