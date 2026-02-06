import { ethers } from "ethers";
import {
  DEFAULT_RPC_URL,
  VAULTS,
  resolveChainConfig,
} from "./constants";

type RpcLimiterState = {
  lastCall: number;
  queue: Promise<void>;
};

const rpcLimiters = new Map<string, RpcLimiterState>();

function getLimiterState(rpcUrl: string): RpcLimiterState {
  let state = rpcLimiters.get(rpcUrl);
  if (!state) {
    state = { lastCall: 0, queue: Promise.resolve() };
    rpcLimiters.set(rpcUrl, state);
  }
  return state;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scheduleRpc<T>(
  rpcUrl: string,
  minIntervalMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const state = getLimiterState(rpcUrl);
  const run = async () => {
    const now = Date.now();
    const wait = Math.max(0, state.lastCall + minIntervalMs - now);
    if (wait > 0) {
      await sleep(wait);
    }
    const result = await fn();
    state.lastCall = Date.now();
    return result;
  };

  const resultPromise = state.queue.then(run, run);
  state.queue = resultPromise.then(
    () => undefined,
    () => undefined
  );
  return resultPromise;
}

/**
 * Create an ethers provider using the configured RPC URL
 */
type ProviderOptions = {
  rpcUrlOverride?: string;
  chainId?: number | string | null;
  chain?: string | null;
  vaultAddress?: string | null;
  contractAddress?: string | null;
};

export function createProvider(
  options?: ProviderOptions | string
): ethers.JsonRpcProvider {
  const rpcUrlOverride = typeof options === "string" ? options : options?.rpcUrlOverride;
  const resolved = typeof options === "string" ? null : resolveChainConfig(options || {});
  const rpcUrl =
    rpcUrlOverride ||
    resolved?.config.rpcUrl ||
    DEFAULT_RPC_URL ||
    process.env.RPC_URL;
  const batchMaxCountRaw = Number.parseInt(
    process.env.RPC_BATCH_MAX || "10",
    10
  );
  const batchStallTimeRaw = Number.parseInt(
    process.env.RPC_BATCH_STALL_MS || "25",
    10
  );
  const batchMaxCount =
    Number.isFinite(batchMaxCountRaw) && batchMaxCountRaw > 0
      ? batchMaxCountRaw
      : 10;
  const batchStallTime =
    Number.isFinite(batchStallTimeRaw) && batchStallTimeRaw >= 0
      ? batchStallTimeRaw
      : 10;

  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    batchMaxCount,
    batchStallTime,
  });

  const minIntervalRaw = Number.parseInt(
    process.env.RPC_MIN_INTERVAL_MS || "0",
    10
  );
  const minIntervalMs =
    Number.isFinite(minIntervalRaw) && minIntervalRaw > 0
      ? minIntervalRaw
      : 0;

  if (minIntervalMs > 0) {
    const originalSend = provider.send.bind(provider);
    provider.send = (method: string, params: Array<any>) =>
      scheduleRpc(rpcUrl, minIntervalMs, () => originalSend(method, params));
  }

  return provider;
}

/**
 * Create a backend wallet instance for transaction signing
 */
export function createBackendWallet(
  provider: ethers.JsonRpcProvider
): ethers.Wallet {
  const privateKey = process.env.BACKEND_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("BACKEND_PRIVATE_KEY environment variable is required");
  }

  const formattedKey = privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`;
  return new ethers.Wallet(formattedKey, provider);
}

/**
 * Wait for transaction receipt with retries
 */
export async function waitForTransactionReceipt(
  provider: ethers.JsonRpcProvider,
  txHash: string,
  maxRetries = 10,
  retryDelay = 3000
): Promise<ethers.TransactionReceipt | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        return receipt;
      }
    } catch (error) {
      console.warn(`Retry ${i + 1}/${maxRetries} failed:`, error instanceof Error ? error.message : String(error));
    }
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
  return null;
}

/**
 * Find event in transaction logs
 */
export function findEventInLogs(
  logs: readonly ethers.Log[],
  contract: ethers.Contract,
  eventName: string
): ethers.LogDescription | null {
  const event = logs.find((log) => {
    try {
      const parsed = contract.interface.parseLog(log);
      return parsed?.name === eventName;
    } catch {
      return false;
    }
  });

  if (!event) return null;

  return contract.interface.parseLog(event);
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

/**
 * Format token amount from wei to human-readable format
 */
export function formatTokenAmount(amountWei: string, decimals: number): string {
  try {
    const formatted = ethers.formatUnits(amountWei, decimals);
    // Remove unnecessary trailing zeros and decimal point if needed
    const cleaned = parseFloat(formatted).toString();
    return cleaned;
  } catch (error) {
    console.error("Error formatting amount:", error);
    return amountWei; // Return original if formatting fails
  }
}

type TargetAmountTokenSource = {
  targetAmountToken?: number;
  targetAmountUSD?: number | string;
};

export function resolveTargetAmountToken(
  source?: TargetAmountTokenSource | null
): number {
  if (!source) return 0;
  const candidate = source.targetAmountToken ?? source.targetAmountUSD;
  if (typeof candidate === "number") {
    return Number.isFinite(candidate) ? candidate : 0;
  }
  if (typeof candidate === "string") {
    const parsed = Number.parseFloat(candidate);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Format amount with proper decimal places for display
 */
export function formatAmountForDisplay(
  amountWei: string,
  decimals: number,
  displayDecimals = 2
): string {
  try {
    const formatted = ethers.formatUnits(amountWei, decimals);
    const number = parseFloat(formatted);

    // For very small amounts, show more decimal places
    if (number < 0.01 && number > 0) {
      return number.toFixed(6);
    }

    // For normal amounts, use specified decimal places
    return number.toFixed(displayDecimals);
  } catch (error) {
    console.error("Error formatting amount for display:", error);
    return amountWei;
  }
}

/**
 * Map with a concurrency limit to avoid overwhelming RPC providers.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 1;
  const workerCount = Math.min(safeLimit, items.length);
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) break;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Detect asset type from vault address and return decimals
 */
export function getAssetDecimalsFromVault(vaultAddress: string): number {
  for (const config of Object.values(VAULTS)) {
    if (config.address.toLowerCase() === vaultAddress.toLowerCase()) {
      return config.decimals;
    }
  }

  // Default to 18 decimals if vault not found
  return 18;
}

/**
 * Get contract-compliant target date
 * Returns now + MIN_LOCK_PERIOD (30 days) matching GoalManager.sol
 * No extra buffer applied - callers should not add additional buffers to avoid stacking
 */
export function getContractCompliantTargetDate(): number {
  const MIN_LOCK_PERIOD_DAYS = 30;
  return Math.floor(Date.now() / 1000) + MIN_LOCK_PERIOD_DAYS * 24 * 60 * 60;
}
