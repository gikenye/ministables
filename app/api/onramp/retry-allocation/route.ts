import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { parseUnits } from "viem";

const ALLOCATE_API_URL = process.env.ALLOCATE_API_URL;

const ASSET_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  cUSD: 18,
  CUSD: 18,
  cKES: 18,
  CKES: 18,
};

/**
 * Retry asset allocation for a completed onramp transaction identified by `transactionCode`.
 *
 * Validates input and configuration, retrieves the transaction, invokes the external allocation service,
 * persists the allocation response and metadata to the database, and returns the allocation result or an error.
 *
 * @returns A NextResponse containing JSON: on success `{ success: true, allocation: <allocationResult> }`; on failure an error object with an appropriate HTTP status and details.
 */
export async function POST(request: NextRequest) {
  try {
    console.log("🔄 Retrying allocation - API route called");

    const body = await request.json();
    const { transactionCode } = body;

    if (!transactionCode) {
      return NextResponse.json(
        {
          error: "Transaction code is required",
        },
        { status: 400 }
      );
    }

    if (!ALLOCATE_API_URL) {
      return NextResponse.json(
        {
          error: "ALLOCATE_API_URL not configured",
        },
        { status: 500 }
      );
    }

    // Get the completed transaction from database
    const onrampCollection = await getCollection("onramp_deposits");
    const transaction = await onrampCollection.findOne({ transactionCode });

    if (!transaction) {
      return NextResponse.json(
        {
          error: "Transaction not found",
        },
        { status: 404 }
      );
    }

    if (transaction.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: "Transaction is not completed yet",
        },
        { status: 400 }
      );
    }

    if (!transaction.txHash) {
      return NextResponse.json(
        {
          error: "Transaction hash not available",
        },
        { status: 400 }
      );
    }

    // Check if allocation was already successful
    if (transaction.allocation?.success === true) {
      return NextResponse.json({
        success: true,
        message: "Allocation already completed",
        allocation: transaction.allocation,
      });
    }

    // Prepare allocation payload
    const decimals = ASSET_DECIMALS[transaction.asset.toUpperCase()] || 18;
    const amountInWei = parseUnits(
      transaction.amountInUsd,
      decimals
    ).toString();

    const allocatePayload = {
      asset: transaction.asset.toUpperCase(),
      userAddress: transaction.userAddress,
      amount: amountInWei,
      txHash: transaction.txHash,
    };

    console.log(
      "🔄 Retrying allocation with payload:",
      JSON.stringify(allocatePayload, null, 2)
    );

    try {
      const allocateResponse = await fetch(`${ALLOCATE_API_URL}/allocate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(allocatePayload),
      });

      let allocateResult;
      try {
        allocateResult = await allocateResponse.json();
      } catch (parseError) {
        console.error(
          "❌ Failed to parse allocation response as JSON:",
          parseError
        );
        allocateResult = {
          success: false,
          error: "Invalid response format from allocation service",
          rawResponse: await allocateResponse.text(),
        };
      }

      console.log(
        "✅ Retry allocation response status:",
        allocateResponse.status
      );
      console.log(
        "✅ Retry allocation response:",
        JSON.stringify(allocateResult, null, 2)
      );

      // Update database with new allocation result
      await onrampCollection.updateOne(
        { transactionCode },
        {
          $set: {
            allocation: {
              ...allocateResult,
              responseStatus: allocateResponse.status,
              timestamp: new Date(),
              retryAttempt: true,
            },
            updatedAt: new Date(),
          },
        }
      );

      if (allocateResponse.ok && allocateResult.success !== false) {
        console.log(
          "🎉 Retry allocation completed successfully for transaction:",
          transactionCode
        );
        return NextResponse.json({
          success: true,
          allocation: allocateResult,
        });
      } else {
        console.error("❌ Retry allocation failed:", allocateResult);
        return NextResponse.json(
          {
            success: false,
            error: "Allocation failed",
            details: allocateResult,
          },
          { status: 500 }
        );
      }
    } catch (allocError: any) {
      console.error("❌ Retry allocation API call failed:", allocError.message);

      await onrampCollection.updateOne(
        { transactionCode },
        {
          $set: {
            allocation: {
              success: false,
              error: allocError.message,
              timestamp: new Date(),
              retryAttempt: true,
              retryable: true,
            },
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json(
        {
          success: false,
          error: allocError.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("❌ Retry allocation error:", error.message);
    return NextResponse.json(
      {
        error: error.message || "Failed to retry allocation",
      },
      { status: 500 }
    );
  }
}