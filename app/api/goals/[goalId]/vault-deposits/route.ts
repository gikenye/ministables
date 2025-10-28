import { NextRequest, NextResponse } from "next/server";
import { GoalService } from "@/lib/services/goalService";

/**
 * GET /api/goals/[goalId]/vault-deposits?userId=0x123
 * Get all vault deposits for a specific goal
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

    // Get vault deposits for the goal
    const deposits = await GoalService.getGoalVaultDeposits(
      params.goalId,
      userId
    );

    // Format the response to include vault-specific data
    const formattedDeposits = deposits.map((deposit) => ({
      transactionId: deposit.transactionId,
      transactionHash: deposit.transactionHash,
      amount: deposit.amount,
      tokenSymbol: deposit.tokenSymbol,
      status: deposit.status,
      createdAt: deposit.createdAt,
      confirmedAt: deposit.confirmedAt,
      vaultData: {
        vaultAddress: deposit.contractData?.vaultAddress,
        depositId: deposit.contractData?.depositId,
        lockTierId: deposit.contractData?.lockTierId,
        lockPeriod: deposit.contractData?.lockPeriod,
        lockEnd: deposit.contractData?.lockEnd,
        shares: deposit.contractData?.shares,
        currentValue: deposit.contractData?.currentValue,
      },
      metadata: deposit.metadata,
    }));

    return NextResponse.json({
      goalId: params.goalId,
      userId,
      deposits: formattedDeposits,
      totalDeposits: formattedDeposits.length,
    });
  } catch (error) {
    console.error("Error getting vault deposits for goal:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to get vault deposits for goal" },
      { status: 500 }
    );
  }
}
