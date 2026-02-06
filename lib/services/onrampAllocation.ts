import { parseUnits } from "viem";
import { getCollection } from "@/lib/mongodb";
import {
  BackendApiClient,
  SUPPORTED_ASSETS,
  type AllocateRequest,
  type AllocateResponse,
  type SupportedAsset,
} from "@/lib/services/backendApiService";
import {
  findChainByVaultAddress,
  resolveChainConfig,
} from "@/lib/backend/constants";
import { createProvider } from "@/lib/backend/utils";
import { ActivityIndexer } from "@/lib/backend/services/activity-indexer.service";

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

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ALLOCATION_TIMEOUT_MS}ms`));
    }, ALLOCATION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

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
  chainId?: number;
  chain?: string;
  vaultAddress?: string;
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

function extractChainFromProviderPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.chain === "string") return record.chain;
  const data = record.data;
  if (data && typeof data === "object") {
    const dataRecord = data as Record<string, unknown>;
    if (typeof dataRecord.chain === "string") return dataRecord.chain;
  }
  return undefined;
}

function resolveAllocationChainParams(args: {
  input: AllocateOnrampInput;
  deposit?: {
    chain?: string;
    chainId?: number;
    vaultAddress?: string;
    provider?: {
      lastWebhookPayload?: unknown;
      lastStatusPayload?: unknown;
      initiateResponse?: unknown;
    };
  } | null;
}): { chainId?: number; chain?: string } {
  const { input, deposit } = args;
  let chainId = input.chainId ?? deposit?.chainId;
  let chain =
    input.chain ??
    deposit?.chain ??
    extractChainFromProviderPayload(input.providerPayload) ??
    extractChainFromProviderPayload(deposit?.provider?.lastWebhookPayload) ??
    extractChainFromProviderPayload(deposit?.provider?.lastStatusPayload) ??
    extractChainFromProviderPayload(deposit?.provider?.initiateResponse);

  if (!chainId && chain) {
    const resolved = resolveChainConfig({ chain });
    if (resolved) chainId = resolved.config.id;
  }

  if (chainId && !chain) {
    const resolved = resolveChainConfig({ chainId });
    if (resolved) {
      chain = resolved.key;
      chainId = resolved.config.id;
    }
  }

  if (!chain || !chainId) {
    const vaultAddress = input.vaultAddress || deposit?.vaultAddress;
    if (vaultAddress) {
      const byVault = findChainByVaultAddress(vaultAddress);
      if (byVault) {
        chainId = chainId ?? byVault.config.id;
        chain = chain ?? byVault.key;
      }
    }
  }

  return {
    chainId,
    chain,
  };
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
        chain?: string;
        chainId?: number;
        vaultAddress?: string;
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
    chain?: string;
    chainId?: number;
    vaultAddress?: string;
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

  const allocationChain = resolveAllocationChainParams({
    input,
    deposit,
  });
  if (allocationChain.chainId) allocationRequest.chainId = allocationChain.chainId;
  if (allocationChain.chain) allocationRequest.chain = allocationChain.chain;

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

    try {
      const activityChain =
        allocationChain.chain ||
        (allocationChain.chainId
          ? resolveChainConfig({ chainId: allocationChain.chainId })?.key
          : undefined) ||
        deposit.chain;
      const activityTxHash = response.allocationTxHash || input.txHash;
      if (activityChain && activityTxHash) {
        let blockNumber: number | undefined;
        const responseBlockNumber =
          (response as { blockNumber?: number }).blockNumber ??
          (response as { allocationReceipt?: { blockNumber?: number } })
            .allocationReceipt?.blockNumber ??
          (response as { receipt?: { blockNumber?: number } }).receipt
            ?.blockNumber;
        try {
          const provider = createProvider({
            chain: activityChain,
            chainId: allocationChain.chainId,
          });
          if (typeof responseBlockNumber === "number") {
            blockNumber = responseBlockNumber;
          } else {
            const receipt = await withTimeout(
              provider.getTransactionReceipt(activityTxHash),
              "getTransactionReceipt"
            );
            if (receipt?.blockNumber) {
              blockNumber = receipt.blockNumber;
            } else {
              blockNumber = await withTimeout(
                provider.getBlockNumber(),
                "getBlockNumber"
              );
            }
          }
        } catch {
          blockNumber = undefined;
        }

        const activityPayload: Parameters<
          typeof ActivityIndexer.recordActivity
        >[0] = {
          userAddress: input.userAddress,
          chain: activityChain,
          type: "onramp_completed",
          txHash: activityTxHash,
          timestamp: attemptedAt.toISOString(),
          data: {
            goalId: response.goalId,
            depositId: response.depositId,
            asset: normalizedAsset,
            amount: amountValue?.toString(),
            source: input.source,
          },
        };
        if (typeof blockNumber === "number") {
          activityPayload.blockNumber = blockNumber;
        }

        await ActivityIndexer.recordActivity(activityPayload);
      }
    } catch (activityError) {
      console.warn("Failed to record onramp activity", activityError);
    }

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
