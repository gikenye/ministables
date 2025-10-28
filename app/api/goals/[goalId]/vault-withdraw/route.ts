import { NextRequest, NextResponse } from "next/server";
import { GoalService } from "@/lib/services/goalService";
import { vaultService } from "@/lib/services/vaultService";

/**
 * POST /api/goals/[goalId]/vault-withdraw
 * Create a vault withdrawal transaction for a goal
 * This endpoint handles the backend tracking when users make vault withdrawals through the frontend
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const body = await request.json();
    const {
      userId,
      chainId,
      depositId,
      transactionHash,
      withdrawnAmount,
      yieldEarned,
    } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    if (!chainId) {
      return NextResponse.json(
        { error: "Chain ID is required" },
        { status: 400 }
      );
    }

    if (depositId === undefined || depositId === null) {
      return NextResponse.json(
        { error: "Deposit ID is required" },
        { status: 400 }
      );
    }

    // Validate that the chain supports vault contracts
    if (!vaultService.isVaultChainSupported(chainId)) {
      return NextResponse.json(
        { error: `Chain ${chainId} does not support vault contracts` },
        { status: 400 }
      );
    }

    // Get the goal to determine the token information
    const goal = await GoalService.getGoalById(params.goalId, userId);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Get vault address for this token
    const vaultAddress = vaultService.getGoalVaultAddress(
      chainId,
      goal.tokenSymbol
    );

    // Prepare vault withdrawal data
    const vaultWithdrawal = {
      chainId,
      vaultAddress,
      userId,
      depositId,
      goalId: params.goalId,
      transactionHash,
      withdrawnAmount,
      yieldEarned,
    };

    // Create the vault withdrawal transaction in the goal system
    const result = await GoalService.createVaultWithdrawalForGoal(
      params.goalId,
      userId,
      vaultWithdrawal,
      transactionHash
    );

    return NextResponse.json(
      {
        goal: result.goal,
        transaction: result.transaction,
        vaultData: {
          vaultAddress,
          depositId,
          withdrawnAmount,
          yieldEarned,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating vault withdrawal for goal:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create vault withdrawal for goal" },
      { status: 500 }
    );
  }
}
