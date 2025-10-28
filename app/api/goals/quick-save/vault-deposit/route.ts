import { NextRequest, NextResponse } from "next/server";
import { GoalService } from "@/lib/services/goalService";
import { vaultService } from "@/lib/services/vaultService";
import { getTokens, hasVaultContracts } from "@/config/chainConfig";

/**
 * POST /api/goals/quick-save/vault-deposit
 * Create a vault deposit transaction for the user's Quick Save goal
 * This endpoint handles vault deposits specifically for the Quick Save goal
 */
export async function POST(request: NextRequest) {
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
    if (!hasVaultContracts(chainId)) {
      return NextResponse.json(
        { error: `Chain ${chainId} does not support vault contracts` },
        { status: 400 }
      );
    }

    // Get or create Quick Save goal
    let quickSaveGoal = await GoalService.getQuickSaveGoal(userId);

    if (!quickSaveGoal) {
      // Create Quick Save goal with the token being deposited
      try {
        const tokens = getTokens(chainId);
        const tokenInfo = tokens.find(
          (token) => token.symbol.toUpperCase() === tokenSymbol.toUpperCase()
        );

        if (!tokenInfo) {
          return NextResponse.json(
            { error: `Token ${tokenSymbol} not found on chain ${chainId}` },
            { status: 400 }
          );
        }

        quickSaveGoal = await GoalService.createQuickSaveGoal(
          userId,
          tokenInfo.address,
          tokenInfo.symbol,
          tokenInfo.decimals
        );
      } catch (error) {
        return NextResponse.json(
          {
            error: `Failed to get token info: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate that the token matches the goal's token
    const tokens = getTokens(chainId);
    const depositToken = tokens.find(
      (token) => token.symbol.toUpperCase() === tokenSymbol.toUpperCase()
    );

    if (!depositToken) {
      return NextResponse.json(
        { error: `Token ${tokenSymbol} not found on chain ${chainId}` },
        { status: 400 }
      );
    }

    // Check if goal token matches deposit token (allow if Quick Save goal is flexible)
    if (
      quickSaveGoal.tokenSymbol.toUpperCase() !== tokenSymbol.toUpperCase() &&
      !quickSaveGoal.isQuickSave
    ) {
      return NextResponse.json(
        {
          error: `Goal token (${quickSaveGoal.tokenSymbol}) does not match deposit token (${tokenSymbol})`,
        },
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
      goalId: quickSaveGoal._id!.toString(),
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
      quickSaveGoal._id!.toString(),
      userId,
      vaultDeposit,
      transactionHash
    );

    return NextResponse.json(
      {
        goal: result.goal,
        transaction: result.transaction,
        quickSave: true,
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
    console.error("Error creating vault deposit for Quick Save:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create vault deposit for Quick Save" },
      { status: 500 }
    );
  }
}
