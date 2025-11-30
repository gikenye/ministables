import { NextRequest, NextResponse } from "next/server";
import {
  backendApiClient,
  AllocateRequest,
  mapTokenSymbolToAsset,
  isValidEthereumAddress,
  isValidTransactionHash,
} from "@/lib/services/backendApiService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenSymbol, userAddress, amount, txHash, targetGoalId, lockTier } = body;

    // Validate required fields
    if (!tokenSymbol || !userAddress || !amount || !txHash) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: tokenSymbol, userAddress, amount, txHash",
        },
        { status: 400 }
      );
    }

    // Validate user address format
    if (!isValidEthereumAddress(userAddress)) {
      return NextResponse.json(
        { error: "Invalid userAddress format" },
        { status: 400 }
      );
    }

    // Validate transaction hash format
    if (!isValidTransactionHash(txHash)) {
      return NextResponse.json(
        { error: "Invalid transaction hash format" },
        { status: 400 }
      );
    }

    // Validate amount
    if (!amount || amount === "0") {
      return NextResponse.json(
        { error: "Invalid amount provided" },
        { status: 400 }
      );
    }

    // Map token symbol to supported asset
    const asset = mapTokenSymbolToAsset(tokenSymbol);
    if (!asset) {
      return NextResponse.json(
        {
          error: `Unsupported token: ${tokenSymbol}. Supported tokens: USDC, cUSD, USDT, cKES`,
        },
        { status: 400 }
      );
    }

    // Prepare allocation request
    const allocateRequest: AllocateRequest = {
      asset,
      userAddress,
      amount,
      txHash,
      targetGoalId, // Pass the target goal ID if provided
      lockTier: lockTier || 30, // Default to 30-day lock tier
    };

    console.log("[API] Calling backend allocation service:", {
      asset,
      userAddress,
      amount: amount.substring(0, 10) + "...", // Log truncated amount for privacy
      txHash,
      targetGoalId: targetGoalId || 'quicksave (default)',
      lockTier: lockTier || 30,
    });

    console.log("[API] FULL REQUEST PAYLOAD TO REMOTE SERVER:", JSON.stringify(allocateRequest, null, 2));

    // Call backend allocation service
    const result = await backendApiClient.allocateDeposit(allocateRequest);

    console.log("[API] Backend allocation successful:", {
      success: result.success,
      depositId: result.depositId,
      quicksaveGoalId: result.quicksaveGoalId,
      allocationTxHash: result.allocationTxHash,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Backend allocation failed:", error);

    // Return appropriate error response
    if (error instanceof Error) {
      // Check if it's a network error or backend error
      if (
        error.message.includes("fetch") ||
        error.message.includes("network")
      ) {
        return NextResponse.json(
          { error: "Backend service unavailable. Please try again later." },
          { status: 503 }
        );
      }

      // Check if it's a validation error from backend
      if (
        error.message.includes("Invalid") ||
        error.message.includes("HTTP 400")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}
