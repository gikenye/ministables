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
  source: AllocationSource;
}

function resolveAmountInWei(asset: string, amountValue: string): string {
  const decimals = ASSET_DECIMALS[asset.toUpperCase()] || 18;
  return parseUnits(amountValue, decimals).toString();
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

  const deposit = claim.value as {
    amount?: string;
    amountInUsd?: string;
    asset?: string;
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

  const allocationRequest: AllocateRequest = {
    asset: normalizedAsset,
    userAddress: input.userAddress,
    amount: amountInWei,
    txHash: input.txHash,
    ...(providerPayload ? { providerPayload } : {}),
  };

  const baseUrl =
    process.env.ALLOCATE_API_URL || process.env.NEXT_PUBLIC_ALLOCATE_API_URL || "";
  if (!baseUrl) {
    await onrampCollection.updateOne(
      { transactionCode: input.transactionCode },
      {
        $set: {
          allocation: {
            success: false,
            status: "FAILED",
            error: "ALLOCATE_API_URL not configured",
            request: allocationRequest,
            lastAttemptAt: new Date(),
            retryable: false,
          },
          updatedAt: new Date(),
        },
      }
    );
    return { success: false, skipped: false, error: "ALLOCATE_API_URL not configured" };
  }
  const client = new BackendApiClient(baseUrl);

  const attemptedAt = new Date();

  try {
    const response = await client.allocateDeposit(allocationRequest);
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
          allocation: {
            success: true,
            status: "SUCCESS",
            response,
            request: allocationRequest,
            lastAttemptAt: attemptedAt,
          },
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
          allocation: {
            success: false,
            status: "FAILED",
            error: message,
            response: data,
            responseStatus: status,
            request: allocationRequest,
            lastAttemptAt: attemptedAt,
            retryable: true,
          },
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
