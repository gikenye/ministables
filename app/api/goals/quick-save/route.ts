import { NextRequest, NextResponse } from "next/server";
import { GoalService } from "@/lib/services/goalService";
import {
  getTokens,
  getTokensBySymbol,
  hasVaultContracts,
  CHAINS,
} from "@/config/chainConfig";

/**
 * GET /api/goals/quick-save
 * Get or create the user's Quick Save goal
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const chainId = searchParams.get("chainId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    let quickSaveGoal = await GoalService.getQuickSaveGoal(userId);

    // If no Quick Save goal exists, create one
    if (!quickSaveGoal) {
      // Use the user's preferred chain or default to the first supported chain
      const defaultChainId = CHAINS[0]?.id || 42220;
      const targetChainId = chainId ? parseInt(chainId) : defaultChainId;

      // Get the default token for Quick Save (prioritize USDC, fallback to first available)
      let defaultToken;
      try {
        const tokens = getTokens(targetChainId);

        // Prioritize USDC if available
        defaultToken =
          tokens.find((token) => token.symbol.toUpperCase() === "USDC") ||
          tokens[0];

        if (!defaultToken) {
          throw new Error(`No tokens available for chain ${targetChainId}`);
        }
      } catch (error) {
        // Fallback to the first supported chain if the requested chain doesn't have tokens
        const fallbackChainId = CHAINS[0]?.id || 42220;
        const fallbackTokens = getTokens(fallbackChainId);
        defaultToken =
          fallbackTokens.find(
            (token) => token.symbol.toUpperCase() === "USDC"
          ) || fallbackTokens[0];
      }

      quickSaveGoal = await GoalService.createQuickSaveGoal(
        userId,
        defaultToken.address,
        defaultToken.symbol,
        defaultToken.decimals
      );
    }

    return NextResponse.json({ goal: quickSaveGoal });
  } catch (error) {
    console.error("Error fetching/creating Quick Save goal:", error);
    return NextResponse.json(
      { error: "Failed to get Quick Save goal" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals/quick-save/deposit
 * Quick deposit to Quick Save goal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, transactionData, chainId } = body;

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

    // Get or create Quick Save goal
    let quickSaveGoal = await GoalService.getQuickSaveGoal(userId);

    if (!quickSaveGoal) {
      // Create Quick Save goal if it doesn't exist
      // Determine token from transaction data or use chain default
      let tokenInfo;

      if (
        transactionData?.tokenAddress &&
        transactionData?.tokenSymbol &&
        transactionData?.tokenDecimals
      ) {
        // Use provided token info
        tokenInfo = {
          address: transactionData.tokenAddress,
          symbol: transactionData.tokenSymbol,
          decimals: transactionData.tokenDecimals,
        };
      } else {
        // Use chain default token
        const defaultChainId = CHAINS[0]?.id || 42220;
        const targetChainId =
          chainId || transactionData?.chainId || defaultChainId;

        try {
          const tokens = getTokens(targetChainId);
          // Prioritize USDC for Quick Save
          tokenInfo =
            tokens.find((token) => token.symbol.toUpperCase() === "USDC") ||
            tokens[0];

          if (!tokenInfo) {
            throw new Error(`No tokens available for chain ${targetChainId}`);
          }
        } catch (error) {
          // Fallback to the first supported chain
          const fallbackChainId = CHAINS[0]?.id || 42220;
          const fallbackTokens = getTokens(fallbackChainId);
          tokenInfo =
            fallbackTokens.find(
              (token) => token.symbol.toUpperCase() === "USDC"
            ) || fallbackTokens[0];
        }
      }

      quickSaveGoal = await GoalService.createQuickSaveGoal(
        userId,
        tokenInfo.address,
        tokenInfo.symbol,
        tokenInfo.decimals
      );
    }

    const result = await GoalService.depositToGoal(
      quickSaveGoal._id!.toString(),
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
    console.error("Error depositing to Quick Save:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to deposit to Quick Save" },
      { status: 500 }
    );
  }
}
