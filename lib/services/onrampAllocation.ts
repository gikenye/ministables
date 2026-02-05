import { parseUnits } from "viem";
import { getCollection } from "@/lib/mongodb";
import {
  BackendApiClient,
  SUPPORTED_ASSETS,
  type AllocateRequest,
  type AllocateResponse,
  type SupportedAsset,
} from "@/lib/services/backendApiService";

const ASSET_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  cUSD: 18,
  CUSD: 18,
  cKES: 6,
  CKES: 6,
};
const ALLOCATION_TIMEOUT_MS = Number(
  process.env.ONRAMP_ALLOCATION_TIMEOUT_MS || 15000
);

type AllocationSource = "poller" | "webhook" | "retry";

interface AllocationAttempt {
  status: "SUCCESS" | "FAILED";
  source: AllocationSource;
  attemptedAt: Date;
  request: AllocateRequest;
  response?: AllocateResponse | { error?: string; [key: string]: unknown };
  responseStatus?: number;
  error?: string;
}

interface AllocateOnrampInput {
  transactionCode: string;
  asset: string;
  userAddress: string;
  amountInUsd?: string;
  amountFallback?: string;
  txHash?: string;
  providerPayload?: unknown;
  targetGoalId?: string;
  source: AllocationSource;
  force?: boolean;
}

function resolveAmountInWei(asset: string, amountValue: string): string {
  const decimals = ASSET_DECIMALS[asset.toUpperCase()] || 18;
  return parseUnits(amountValue, decimals).toString();
}

function ensureTransactionCodeInPayload(
  payload: unknown,
  transactionCode: string
): unknown {
  if (!transactionCode) return payload;
  if (!payload || typeof payload !== "object") {
    return { transaction_code: transactionCode };
  }

  const record = payload as Record<string, unknown>;
  const existingTopLevel = record.transaction_code;
  const dataRecord =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : null;
  const existingData = dataRecord?.transaction_code;

  if (
    (typeof existingTopLevel === "string" && existingTopLevel.length > 0) ||
    (typeof existingData === "string" && existingData.length > 0)
  ) {
    return payload;
  }

  return {
    ...record,
    transaction_code: transactionCode,
    data: {
      ...(dataRecord || {}),
      transaction_code: transactionCode,
    },
  };
}

function normalizeAsset(asset: string): SupportedAsset | null {
  const normalized = asset.toLowerCase();
  const match = SUPPORTED_ASSETS.find(
    (supported) => supported.toLowerCase() === normalized
  );
  return match || null;
}

export async function allocateOnrampDeposit(input: AllocateOnrampInput) {
  const onrampCollection = await getCollection("onramp_deposits");
  const normalizedAsset = normalizeAsset(input.asset);

  if (!normalizedAsset) {
    await onrampCollection.updateOne(
      { transactionCode: input.transactionCode },
      {
        $set: {
          allocation: {
            success: false,
            status: "FAILED",
            error: `Unsupported asset for allocation: ${input.asset}`,
            lastAttemptAt: new Date(),
            retryable: false,
          },
          updatedAt: new Date(),
        },
      }
    );
    return { success: false, error: "Unsupported asset", skipped: false };
  }

  if (!input.txHash) {
    await onrampCollection.updateOne(
      { transactionCode: input.transactionCode },
      {
        $set: {
          allocation: {
            success: false,
            status: "FAILED",
            error: "Missing transaction hash for allocation",
            lastAttemptAt: new Date(),
            retryable: true,
          },
          updatedAt: new Date(),
        },
      }
    );
    return { success: false, error: "Missing transaction hash", skipped: false };
  }

  let depositRecord:
    | {
        amount?: string;
        amountInUsd?: string;
        asset?: string;
        targetGoalId?: string;
        allocation?: { status?: string };
        provider?: {
          lastWebhookPayload?: unknown;
          lastStatusPayload?: unknown;
          initiateResponse?: unknown;
        };
      }
    | null = null;

  if (input.force) {
    const existing = await onrampCollection.findOne({
      transactionCode: input.transactionCode,
    });
    if (!existing) {
      return {
        success: false,
        skipped: false,
        reason: "Transaction not found",
        error: "Transaction not found",
      };
    }
    const existingAllocationStatus =
      (existing as { allocation?: { status?: string } }).allocation?.status ||
      "";
    if (existingAllocationStatus === "SUCCESS") {
      return {
        success: true,
        skipped: true,
        reason: "Allocation already completed",
      };
    }
    await onrampCollection.updateOne(
      { transactionCode: input.transactionCode },
      {
        $set: {
          "allocation.status": "IN_PROGRESS",
          "allocation.startedAt": new Date(),
          updatedAt: new Date(),
        },
      }
    );
    depositRecord = existing as typeof depositRecord;
  } else {
    const claim = await onrampCollection.findOneAndUpdate(
      {
        transactionCode: input.transactionCode,
        $or: [
          { "allocation.status": { $exists: false } },
          { "allocation.status": { $nin: ["IN_PROGRESS", "SUCCESS"] } },
        ],
      },
      {
        $set: {
          "allocation.status": "IN_PROGRESS",
          "allocation.startedAt": new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!claim || !claim.value) {
      const existing = await onrampCollection.findOne({
        transactionCode: input.transactionCode,
      });
      if (!existing) {
        return {
          success: false,
          skipped: false,
          reason: "Transaction not found",
          error: "Transaction not found",
        };
      }
      return {
        success: true,
        skipped: true,
        reason: "Allocation already in progress or completed",
      };
    }
    depositRecord = claim.value as typeof depositRecord;
  }

  const deposit = (depositRecord || {}) as {
    amount?: string;
    amountInUsd?: string;
    asset?: string;
    targetGoalId?: string;
    provider?: {
      lastWebhookPayload?: unknown;
      lastStatusPayload?: unknown;
      initiateResponse?: unknown;
    };
  };

  const amountValue =
    input.amountInUsd ||
    deposit.amountInUsd ||
    input.amountFallback ||
    deposit.amount;

  if (!amountValue) {
    await onrampCollection.updateOne(
      { transactionCode: input.transactionCode },
      {
        $set: {
          allocation: {
            success: false,
            status: "FAILED",
            error: "Missing amount for allocation",
            lastAttemptAt: new Date(),
            retryable: true,
          },
          updatedAt: new Date(),
        },
      }
    );
    return { success: false, error: "Missing amount", skipped: false };
  }

  let amountInWei: string;
  try {
    amountInWei = resolveAmountInWei(normalizedAsset, amountValue.toString());
  } catch (error) {
    await onrampCollection.updateOne(
      { transactionCode: input.transactionCode },
      {
        $set: {
          allocation: {
            success: false,
            status: "FAILED",
            error: "Invalid amount format for allocation",
            lastAttemptAt: new Date(),
            retryable: false,
          },
          updatedAt: new Date(),
        },
      }
    );
    return { success: false, error: "Invalid amount", skipped: false };
  }

  const providerPayload =
    input.providerPayload ||
    deposit?.provider?.lastWebhookPayload ||
    deposit?.provider?.lastStatusPayload ||
    deposit?.provider?.initiateResponse ||
    { data: { transaction_code: input.transactionCode } };
  const normalizedProviderPayload = ensureTransactionCodeInPayload(
    providerPayload,
    input.transactionCode
  );

  const allocationRequest: AllocateRequest = {
    asset: normalizedAsset,
    userAddress: input.userAddress,
    amount: amountInWei,
    txHash: input.txHash,
    targetGoalId: input.targetGoalId || deposit.targetGoalId,
    ...(normalizedProviderPayload
      ? { providerPayload: normalizedProviderPayload }
      : {}),
  };

  const baseUrl =
    process.env.ALLOCATE_API_URL ||
    process.env.NEXT_PUBLIC_ALLOCATE_API_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const client = new BackendApiClient(baseUrl);

  const attemptedAt = new Date();

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const response = await Promise.race([
      client.allocateDeposit(allocationRequest),
      new Promise<AllocateResponse>((_, reject) => {
        timeoutId = setTimeout(() => {
          const error = new Error(
            `Allocation timed out after ${ALLOCATION_TIMEOUT_MS}ms`
          ) as Error & { status?: number };
          error.status = 504;
          reject(error);
        }, ALLOCATION_TIMEOUT_MS);
      }),
    ]);
    if (timeoutId) clearTimeout(timeoutId);
    const attempt: AllocationAttempt = {
      status: "SUCCESS",
      source: input.source,
      attemptedAt,
      request: allocationRequest,
      response,
    };

    await onrampCollection.updateOne(
      { transactionCode: input.transactionCode },
      {
        $set: {
          "allocation.success": true,
          "allocation.status": "SUCCESS",
          "allocation.response": response,
          "allocation.request": allocationRequest,
          "allocation.lastAttemptAt": attemptedAt,
          updatedAt: new Date(),
        },
        $push: {
          "allocation.attempts": {
            $each: [attempt],
            $slice: -20,
          },
        },
      }
    );

    return { success: true, skipped: false, response };
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    const message =
      error instanceof Error ? error.message : "Allocation failed";
    const status = (error as { status?: number }).status;
    const data = (error as { data?: unknown }).data;
    const attempt: AllocationAttempt = {
      status: "FAILED",
      source: input.source,
      attemptedAt,
      request: allocationRequest,
      response: data as { error?: string },
      responseStatus: status,
      error: message,
    };

    await onrampCollection.updateOne(
      { transactionCode: input.transactionCode },
      {
        $set: {
          "allocation.success": false,
          "allocation.status": "FAILED",
          "allocation.error": message,
          "allocation.response": data,
          "allocation.responseStatus": status,
          "allocation.request": allocationRequest,
          "allocation.lastAttemptAt": attemptedAt,
          "allocation.retryable": true,
          updatedAt: new Date(),
        },
        $push: {
          "allocation.attempts": {
            $each: [attempt],
            $slice: -20,
          },
        },
      }
    );

    return { success: false, skipped: false, error: message, status, data };
  }
}
