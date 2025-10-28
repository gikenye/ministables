import { NextRequest, NextResponse } from "next/server";
import { GoalService } from "@/lib/services/goalService";
import { vaultService } from "@/lib/services/vaultService";

/**
 * POST /api/goals/[goalId]/vault-deposit
 * Create a vault deposit transaction for a goal
 * This endpoint handles the backend tracking when users make vault deposits through the frontend
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const body = await request.json();
    const {
      userId,
      amount,
      chainId,
      tokenSymbol,
      lockPeriod,
      transactionHash,
      depositId,
    } = body;

    // Validate required fields
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

    if (!chainId || !tokenSymbol) {
      return NextResponse.json(
        { error: "Chain ID and token symbol are required" },
        { status: 400 }
      );
    }

    if (lockPeriod === undefined || lockPeriod === null) {
      return NextResponse.json(
        { error: "Lock period is required" },
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

    // Prepare vault deposit data
    const vaultDeposit = vaultService.prepareGoalVaultDeposit({
      chainId,
      tokenSymbol,
      amount,
      lockPeriod,
      userId,
      goalId: params.goalId,
    });

    // Add transaction hash and deposit ID if provided (from successful blockchain transaction)
    if (transactionHash) {
      vaultDeposit.transactionHash = transactionHash;
    }
    if (depositId !== undefined) {
      vaultDeposit.depositId = depositId;
    }

    // Create the vault deposit transaction in the goal system
    const result = await GoalService.createVaultDepositForGoal(
      params.goalId,
      userId,
      vaultDeposit,
      transactionHash
    );

    return NextResponse.json(
      {
        goal: result.goal,
        transaction: result.transaction,
        vaultData: {
          vaultAddress: vaultDeposit.vaultAddress,
          lockTierId: vaultDeposit.lockTierId,
          lockPeriod: vaultDeposit.lockPeriod,
          estimatedAPY: await vaultService.getEstimatedVaultAPY(
            chainId,
            tokenSymbol,
            lockPeriod
          ),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating vault deposit for goal:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create vault deposit for goal" },
      { status: 500 }
    );
  }
}
