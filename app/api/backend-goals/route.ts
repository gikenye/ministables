import { NextRequest, NextResponse } from "next/server";
import { backendApiClient } from "@/lib/services/backendApiService";
import { getVaultAddress } from "@/config/chainConfig";
import { celo } from "thirdweb/chains";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get("goalId");
    const userAddress = searchParams.get("userAddress");
    const vaultAddress = searchParams.get("vaultAddress");
    const tokenSymbol = searchParams.get("tokenSymbol");

    // If goalId is provided, fetch specific goal details
    if (goalId) {
      // Validate goalId - must be a positive integer (goal IDs start from 1 in the contract)
      const goalIdNum = parseInt(goalId, 10);
      if (isNaN(goalIdNum) || goalIdNum <= 0) {
        return NextResponse.json(
          {
            error: `Invalid goal ID: ${goalId}. Goal ID must be a positive integer.`,
          },
          { status: 400 }
        );
      }

      try {
        const goal = await backendApiClient.getGoalDetails(goalId);
        return NextResponse.json(goal);
      } catch (error) {
        console.error("[API] Failed to get goal details:", error);
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to get goal details",
          },
          { status: 500 }
        );
      }
    }

    // If userAddress is provided, get quicksave goal
    if (userAddress) {
      let finalVaultAddress = vaultAddress;

      // If vaultAddress not provided but tokenSymbol is, derive it from config
      if (!finalVaultAddress && tokenSymbol) {
        try {
          finalVaultAddress = getVaultAddress(celo.id, tokenSymbol);
        } catch (error) {
          return NextResponse.json(
            { error: `Invalid token symbol: ${tokenSymbol}` },
            { status: 400 }
          );
        }
      }

      if (!finalVaultAddress) {
        return NextResponse.json(
          {
            error:
              "Either vaultAddress or tokenSymbol must be provided with userAddress",
          },
          { status: 400 }
        );
      }

      try {
        const quicksaveGoal = await backendApiClient.getQuicksaveGoal(
          userAddress,
          finalVaultAddress
        );
        return NextResponse.json(quicksaveGoal);
      } catch (error) {
        console.error("[API] Failed to get quicksave goal:", error);
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to get quicksave goal",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error:
          "Either goalId or (userAddress + vaultAddress/tokenSymbol) must be provided",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("[API] Backend goals API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const goalData = await request.json();
    
    if (!goalData.userAddress || !goalData.targetAmount || !goalData.name) {
      return NextResponse.json(
        { error: 'userAddress, targetAmount, and name are required' },
        { status: 400 }
      );
    }
    
    const vaultAddress = getVaultAddress(celo.id, goalData.tokenSymbol || 'USDC');
    
    const result = await backendApiClient.createGoal({
      vaultAddress,
      targetAmount: goalData.targetAmount,
      name: goalData.name,
      creatorAddress: goalData.userAddress,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Failed to create goal:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create goal' },
      { status: 500 }
    );
  }
}

export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed. Use GET." },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed. Use GET." },
    { status: 405 }
  );
}
