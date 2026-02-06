import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { allocateOnrampDeposit } from "@/lib/services/onrampAllocation";
import { logger } from "@/lib/services/logger";

export async function POST(request: NextRequest) {
  try {
    logger.info("Retrying allocation", {
      component: "onramp.retry",
      operation: "request",
    });

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

    // Check if allocation was already successful
    if (transaction.allocation?.success === true) {
      return NextResponse.json({
        success: true,
        message: "Allocation already completed",
        allocation: transaction.allocation,
      });
    }

    logger.info("Retrying allocation via backendApiService", {
      component: "onramp.retry",
      operation: "allocate",
      additional: { transactionCode },
    });
    const allocationResult = await allocateOnrampDeposit({
      transactionCode,
      asset: transaction.asset,
      userAddress: transaction.userAddress,
      amountInUsd: transaction.amountInUsd,
      amountFallback: transaction.amount,
      txHash: transaction.txHash,
      providerPayload: transaction.provider?.lastWebhookPayload || transaction.provider?.lastStatusPayload,
      targetGoalId: transaction.targetGoalId,
      source: "retry",
      chain: transaction.chain,
      chainId: transaction.chainId,
      vaultAddress: transaction.vaultAddress,
    });

    if (allocationResult.success && !allocationResult.skipped) {
      logger.info("Retry allocation completed", {
        component: "onramp.retry",
        operation: "success",
        additional: { transactionCode },
      });
      return NextResponse.json({
        success: true,
        allocation: allocationResult.response,
      });
    }

    if (allocationResult.skipped) {
      return NextResponse.json({
        success: true,
        message: "Allocation already in progress or completed",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: allocationResult.error || "Allocation failed",
        details: allocationResult.data || allocationResult,
      },
      { status: 500 }
    );
  } catch (error: any) {
    logger.error(error, {
      component: "onramp.retry",
      operation: "error",
    });
    return NextResponse.json(
      {
        error: error.message || "Failed to retry allocation",
      },
      { status: 500 }
    );
  }
}
