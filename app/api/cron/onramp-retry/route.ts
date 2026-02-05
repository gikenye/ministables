import { NextRequest, NextResponse } from "next/server";
import type { UpdateFilter, WithId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { allocateOnrampDeposit } from "@/lib/services/onrampAllocation";
import { logger } from "@/lib/services/logger";
import type { OnrampDeposit } from "@/lib/models/onrampDeposit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const DEFAULT_LIMIT = Number(process.env.ONRAMP_RETRY_LIMIT || 20);
const DEFAULT_STALE_MINUTES = Number(
  process.env.ONRAMP_ALLOCATION_STALE_MINUTES || 20
);

type OnrampCollection = {
  find: (filter: unknown) => {
    sort: (sort: unknown) => {
      limit: (limit: number) => {
        toArray: () => Promise<WithId<OnrampDeposit>[]>;
      };
    };
  };
  updateOne: (
    filter: unknown,
    update: UpdateFilter<OnrampDeposit>
  ) => Promise<unknown>;
};

type VerificationResult = {
  ok: boolean;
  reason?: string;
  details?: Record<string, unknown>;
};

export async function GET(request: NextRequest) {
  try {
    const requiredToken = process.env.ONRAMP_RETRY_TOKEN;
    if (requiredToken) {
      const tokenFromHeader = request.headers.get("x-cron-token");
      const tokenFromQuery = request.nextUrl.searchParams.get("token");
      if (tokenFromHeader !== requiredToken && tokenFromQuery !== requiredToken) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : DEFAULT_LIMIT;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT;
    const debugEnabled =
      request.nextUrl.searchParams.get("debug") === "true" ||
      request.nextUrl.searchParams.get("debug") === "1";
    const transactionCodeFilter =
      request.nextUrl.searchParams.get("transactionCode") ||
      request.nextUrl.searchParams.get("tx");
    const staleMinutesParam = request.nextUrl.searchParams.get("staleMinutes");
    const staleMinutesEnv = DEFAULT_STALE_MINUTES;
    const staleMinutes = staleMinutesParam
      ? Number(staleMinutesParam)
      : staleMinutesEnv;
    const safeStaleMinutes =
      Number.isFinite(staleMinutes) && staleMinutes > 0
        ? staleMinutes
        : DEFAULT_STALE_MINUTES;
    const staleCutoff = new Date(Date.now() - safeStaleMinutes * 60 * 1000);

    const onrampCollection = (await getCollection(
      "onramp_deposits"
    )) as unknown as OnrampCollection;
    const deposits = await onrampCollection
      .find(
        transactionCodeFilter
          ? { transactionCode: transactionCodeFilter }
          : {
              $or: [
                { status: { $in: ["AWAITING_TX_HASH", "AWAITING_AMOUNT"] } },
                { status: "COMPLETED", txHash: { $exists: false } },
                { "allocation.status": "FAILED" },
                {
                  "allocation.status": "IN_PROGRESS",
                  $or: [
                    { "allocation.lastAttemptAt": { $lte: staleCutoff } },
                    { "allocation.startedAt": { $lte: staleCutoff } },
                    {
                      "allocation.lastAttemptAt": { $exists: false },
                      "allocation.startedAt": { $exists: false },
                    },
                  ],
                },
              ],
            }
      )
      .sort({ updatedAt: 1 })
      .limit(safeLimit)
      .toArray();

    if (deposits.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    let processed = 0;
    let allocated = 0;
    let awaitingTxHash = 0;
    let awaitingAmount = 0;
    let failed = 0;
    const debug: Array<{
      transactionCode: string;
      status?: string;
      allocationStatus?: string;
      reason: string;
      details?: Record<string, unknown>;
    }> = [];
    const pushDebug = (entry: {
      transactionCode: string;
      status?: string;
      allocationStatus?: string;
      reason: string;
      details?: Record<string, unknown>;
    }) => {
      if (debugEnabled) debug.push(entry);
    };

    for (const deposit of deposits) {
      processed += 1;
      const transactionCode = deposit.transactionCode as string | undefined;
      if (!transactionCode) {
        logger.warn("Skipping onramp retry with missing transactionCode", {
          component: "onramp.cron",
          operation: "skip",
        });
        pushDebug({
          transactionCode: "unknown",
          reason: "missing_transaction_code",
        });
        continue;
      }

      const allocationStatus = deposit.allocation?.status;
      const allocationTimestamp =
        deposit.allocation?.lastAttemptAt || deposit.allocation?.startedAt;
      const isStaleInProgress =
        allocationStatus === "IN_PROGRESS" &&
        (!allocationTimestamp || allocationTimestamp <= staleCutoff);

      if (isStaleInProgress) {
        await onrampCollection.updateOne(
          { transactionCode },
          {
            $set: {
              "allocation.status": "FAILED",
              "allocation.success": false,
              "allocation.error": "Stale allocation retry",
              "allocation.lastAttemptAt": new Date(),
              updatedAt: new Date(),
            },
          }
        );
        pushDebug({
          transactionCode,
          allocationStatus,
          reason: "stale_allocation_reset",
        });
      }

      if (
        deposit.txHash &&
        deposit.amountInUsd &&
        deposit.userAddress &&
        deposit.asset
      ) {
        const allocationResult = await allocateOnrampDeposit({
          transactionCode,
          asset: deposit.asset,
          userAddress: deposit.userAddress,
          amountInUsd: deposit.amountInUsd,
          amountFallback: deposit.amountInUsd || deposit.amount,
          txHash: deposit.txHash,
          providerPayload: { transaction_code: transactionCode },
          targetGoalId: deposit.targetGoalId,
          source: "retry",
          force: true,
        });

        if (allocationResult.success && !allocationResult.skipped) {
          allocated += 1;
          pushDebug({
            transactionCode,
            allocationStatus,
            reason: "direct_allocated_from_db",
          });
        } else if (allocationResult.skipped) {
          pushDebug({
            transactionCode,
            allocationStatus,
            reason: allocationResult.reason || "allocation_skipped",
          });
        } else {
          pushDebug({
            transactionCode,
            allocationStatus,
            reason: allocationResult.error || "allocation_failed",
          });
        }
        continue;
      }

      // Fallback: extract txHash from provider payload if not at root
      const txHashFromProvider = 
        deposit.provider?.lastStatusPayload?.data?.transaction_hash ||
        deposit.provider?.lastWebhookPayload?.data?.transaction_hash;
      
      if (
        txHashFromProvider &&
        deposit.amountInUsd &&
        deposit.userAddress &&
        deposit.asset
      ) {
        // Update the document with extracted txHash
        await onrampCollection.updateOne(
          { transactionCode },
          { $set: { txHash: txHashFromProvider, updatedAt: new Date() } }
        );
        
        const allocationResult = await allocateOnrampDeposit({
          transactionCode,
          asset: deposit.asset,
          userAddress: deposit.userAddress,
          amountInUsd: deposit.amountInUsd,
          amountFallback: deposit.amountInUsd || deposit.amount,
          txHash: txHashFromProvider,
          providerPayload: { transaction_code: transactionCode },
          targetGoalId: deposit.targetGoalId,
          source: "retry",
          force: true,
        });

        if (allocationResult.success && !allocationResult.skipped) {
          allocated += 1;
          pushDebug({
            transactionCode,
            allocationStatus,
            reason: "allocated_with_extracted_txhash",
          });
        } else if (allocationResult.skipped) {
          pushDebug({
            transactionCode,
            allocationStatus,
            reason: allocationResult.reason || "allocation_skipped",
          });
        } else {
          pushDebug({
            transactionCode,
            allocationStatus,
            reason: allocationResult.error || "allocation_failed",
          });
        }
        continue;
      }

      const missing: string[] = [];
      if (!deposit.txHash) missing.push("txHash");
      if (!deposit.amountInUsd) missing.push("amountInUsd");
      if (!deposit.userAddress) missing.push("userAddress");
      if (!deposit.asset) missing.push("asset");
      if (missing.length > 0) {
        if (!deposit.txHash) awaitingTxHash += 1;
        if (!deposit.amountInUsd) awaitingAmount += 1;
        pushDebug({
          transactionCode,
          allocationStatus,
          reason: "missing_required_fields",
          details: { missing },
        });
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      allocated,
      awaitingTxHash,
      awaitingAmount,
      failed,
      ...(debugEnabled ? { debug } : {}),
    });
  } catch (error) {
    logger.error(error as Error, {
      component: "onramp.cron",
      operation: "error",
    });
    return NextResponse.json(
      { error: "Failed to retry onramp allocations" },
      { status: 500 }
    );
  }
}
