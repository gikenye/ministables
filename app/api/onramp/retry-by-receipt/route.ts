import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { allocateOnrampDeposit } from "@/lib/services/onrampAllocation";
import { logger } from "@/lib/services/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { receiptNumber } = body;

    if (!receiptNumber) {
      return NextResponse.json(
        { error: "receiptNumber is required" },
        { status: 400 }
      );
    }

    if (typeof receiptNumber !== "string") {
      return NextResponse.json(
        { error: "receiptNumber must be a string" },
        { status: 400 }
      );
    }

    const normalizedReceipt = receiptNumber.trim().toLowerCase();
    if (!normalizedReceipt) {
      return NextResponse.json(
        { error: "receiptNumber is required" },
        { status: 400 }
      );
    }

    const onrampCollection = await getCollection("onramp_deposits");
    const transaction = await onrampCollection.findOne({
      receiptNumber: normalizedReceipt,
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found for receipt number" },
        { status: 404 }
      );
    }

    if (transaction.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Transaction is not completed yet" },
        { status: 400 }
      );
    }

    if (!transaction.userAddress || !transaction.asset) {
      return NextResponse.json(
        { error: "Transaction missing required allocation fields" },
        { status: 400 }
      );
    }

    if (transaction.allocation?.success === true) {
      return NextResponse.json({
        success: true,
        message: "Allocation already completed",
        allocation: transaction.allocation,
      });
    }

    logger.info("Retry allocation by receipt", {
      component: "onramp.retryReceipt",
      operation: "allocate",
      additional: { receiptNumber: normalizedReceipt },
    });

    const allocationResult = await allocateOnrampDeposit({
      transactionCode: transaction.transactionCode,
      asset: transaction.asset,
      userAddress: transaction.userAddress,
      amountInUsd: transaction.amountInUsd,
      amountFallback: transaction.amount,
      txHash: transaction.txHash,
      providerPayload:
        transaction.provider?.lastWebhookPayload ||
        transaction.provider?.lastStatusPayload,
      source: "retry",
    });

    if (allocationResult.success && !allocationResult.skipped) {
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
      component: "onramp.retryReceipt",
      operation: "error",
    });
    return NextResponse.json(
      { error: error.message || "Failed to retry allocation" },
      { status: 500 }
    );
  }
}
