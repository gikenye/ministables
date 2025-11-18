import { NextRequest, NextResponse } from "next/server";
import { backendApiClient } from "@/lib/services/backendApiService";
import { getVaultAddress } from "@/config/chainConfig";
import { useChain } from "@/components/ChainProvider";

// In-memory storage for goals (for development/demo purposes)
// In production, this would be replaced with a proper database
let goalsStorage: any[] = [];

// Default fallback rates for different tokens (same as in useInterestRates hook)
const DEFAULT_RATES: { [tokenSymbol: string]: number } = {
  USDC: 4.2,
  USDT: 4.1,
  CUSD: 3.8,
};

const getTokenRate = (tokenSymbol: string): number => {
  const upperSymbol = tokenSymbol.toUpperCase();
  return DEFAULT_RATES[upperSymbol] || 4.0;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (userId) {
      // Filter goals for this user
      const userGoals = goalsStorage.filter(goal => goal.userId === userId);

      // Calculate stats
      const totalGoals = userGoals.length;
      const activeGoals = userGoals.filter(g => g.status === 'active').length;
      const completedGoals = userGoals.filter(g => g.status === 'completed').length;
      const totalSaved = userGoals.reduce((sum, goal) => sum + parseFloat(goal.currentAmount || '0'), 0).toString();
      const totalInterestEarned = userGoals.reduce((sum, goal) => sum + parseFloat(goal.totalInterestEarned || '0'), 0).toString();
      const averageProgress = totalGoals > 0
        ? userGoals.reduce((sum, goal) => sum + (goal.progress || 0), 0) / totalGoals
        : 0;

      return NextResponse.json({
        goals: userGoals,
        stats: {
          totalGoals,
          activeGoals,
          completedGoals,
          totalSaved,
          totalInterestEarned,
          averageProgress,
        },
      });
    }

    return NextResponse.json(
      { error: "userId parameter is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[API] Goals API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      title,
      description,
      category,
      targetAmount,
      tokenAddress,
      tokenSymbol,
      tokenDecimals,
      timeline,
      isQuickSave = false,
    } = body;

    // Validate required fields
    if (!userId || !title || !targetAmount || !tokenAddress || !tokenSymbol) {
      return NextResponse.json(
        { error: "Missing required fields: userId, title, targetAmount, tokenAddress, tokenSymbol" },
        { status: 400 }
      );
    }

    // Validate targetAmount is a valid number
    const targetAmountNum = parseFloat(targetAmount);
    if (isNaN(targetAmountNum) || targetAmountNum <= 0) {
      return NextResponse.json(
        { error: "targetAmount must be a positive number" },
        { status: 400 }
      );
    }

    // Get vault address for the token
    let vaultAddress: string;
    try {
      // For now, assume Celo chain (42220) - in production this should be dynamic
      vaultAddress = getVaultAddress(42220, tokenSymbol);
      if (!vaultAddress) {
        throw new Error(`No vault found for ${tokenSymbol}`);
      }
    } catch (error) {
      console.error("[API] Error getting vault address:", error);
      return NextResponse.json(
        { error: `Unable to find vault for token ${tokenSymbol}` },
        { status: 400 }
      );
    }

    // Calculate target date (timeline in months from now)
    const targetDate = timeline
      ? Math.floor((Date.now() + parseInt(timeline) * 30 * 24 * 60 * 60 * 1000) / 1000).toString()
      : Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1000) / 1000).toString(); // Default 1 year

    // Create metadata URI (simplified for now)
    const metadataURI = `ipfs://goal-metadata/${Date.now()}`;

    // Step 1: Call backend blockchain API to create goal on smart contract
    console.log("[API] Calling backend to create goal on blockchain:", {
      userAddress: userId,
      vaultAddress,
      targetAmount: targetAmountNum.toString(),
      targetDate,
      metadataURI,
    });

    const createGoalRequest = {
      userAddress: userId,
      vaultAddress,
      targetAmount: targetAmountNum.toString(),
      targetDate,
      metadataURI,
    };

    const blockchainResult = await backendApiClient.createGoal(createGoalRequest);

    if (!blockchainResult.success) {
      throw new Error("Failed to create goal on blockchain");
    }

    console.log("[API] Blockchain goal created:", {
      goalId: blockchainResult.goalId,
      transactionHash: blockchainResult.transactionHash,
    });

    // Step 2: Retrieve goal data from backend worker
    console.log("[API] Retrieving goal data from backend...");
    const goalDetails = await backendApiClient.getGoalDetails(blockchainResult.goalId);

    // Step 3: Store goal locally with blockchain data
    const interestRate = getTokenRate(tokenSymbol);

    const newGoal = {
      id: blockchainResult.goalId,
      title,
      description: description || `Custom goal for ${title}`,
      category: category || "personal",
      status: "active",
      currentAmount: goalDetails.totalValue || "0",
      targetAmount: targetAmountNum.toString(),
      progress: 0, // Will be calculated from blockchain data
      tokenAddress,
      tokenSymbol,
      tokenDecimals: tokenDecimals || 6,
      interestRate,
      totalInterestEarned: "0",
      isPublic: false,
      allowContributions: false,
      isQuickSave,
      userId,
      createdAt: new Date(parseInt(goalDetails.createdAt) * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      targetDate: new Date(parseInt(goalDetails.targetDate) * 1000).toISOString(),
      completedAt: undefined,
      blockchainGoalId: blockchainResult.goalId,
      transactionHash: blockchainResult.transactionHash,
      vaultAddress,
      metadataURI,
    };

    // Store the goal locally
    goalsStorage.push(newGoal);

    console.log("[API] Goal created and stored locally:", newGoal);

    return NextResponse.json(
      {
        goal: newGoal,
        blockchainResult,
        message: "Goal created successfully on blockchain"
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Error creating goal:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
