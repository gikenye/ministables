import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { getVaultAddress } from "@/config/chainConfig";
import { parseUnits } from "viem";
import { base, celo, scroll } from "thirdweb/chains";
import { allocateOnrampDeposit } from "@/lib/services/onrampAllocation";
import { logger } from "@/lib/services/logger";
import { sanitizeOnrampInitiatePayload } from "@/lib/utils/logSanitizer";

const PRETIUM_BASE_URI = process.env.PRETIUM_BASE_URI;
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY;
const ASSET_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  cUSD: 18,
  CUSD: 18,
};

// Map chain names to Pretium API format
const CHAIN_MAPPING: Record<string, string> = {
  "Celo Mainnet": "CELO",
  Celo: "CELO",
  CELO: "CELO",
  Base: "BASE",
  BASE: "BASE",
  Stellar: "STELLAR",
  STELLAR: "STELLAR",
};

// Map chain names to numeric chain IDs (based on chainConfig.ts)
const CHAIN_ID_MAPPING: Record<string, number> = {
  "Celo Mainnet": celo.id,
  Celo: celo.id,
  CELO: celo.id,
  Base: base.id,
  BASE: base.id,
  Scroll: scroll.id,
  SCROLL: scroll.id,
};

const SOURCE_ALLOWLIST = new Set(["app", "widget", "api"]);
const DEFAULT_SOURCE = "app";

function sanitizeSource(input: unknown): string {
  if (typeof input !== "string") return DEFAULT_SOURCE;
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_SOURCE;
  const clipped = trimmed.slice(0, 32);
  const normalized = clipped.toLowerCase();
  if (!SOURCE_ALLOWLIST.has(normalized)) return DEFAULT_SOURCE;
  return normalized;
}

export async function POST(request: NextRequest) {
  try {
    logger.info("Initiating onramp", {
      component: "onramp.initiate",
      operation: "request",
    });

    const body = await request.json();
    const {
      shortcode,
      amount,
      fee,
      mobile_network,
      chain,
      asset,
      address,
      callback_url,
      currency_code = "KES",
      vault_address,
      target_goal_id,
      targetGoalId: targetGoalIdFromBody,
      source: sourceInput,
    } = body;
    const targetGoalId = target_goal_id || targetGoalIdFromBody;
    const source = sanitizeSource(sourceInput);

    const sanitizedRequestBody = sanitizeOnrampInitiatePayload(body);

    logger.info("Received onramp request", {
      component: "onramp.initiate",
      operation: "payload",
      additional: { body: sanitizedRequestBody },
    });

    if (
      !shortcode ||
      !amount ||
      !mobile_network ||
      !chain ||
      !asset ||
      !address
    ) {
      logger.warn("Onramp missing required fields", {
        component: "onramp.initiate",
        operation: "validation",
      });
      return NextResponse.json(
        {
          error:
            "Shortcode, amount, mobile_network, chain, asset, and address are required",
        },
        { status: 400 }
      );
    }

    if (!PRETIUM_BASE_URI || !PRETIUM_API_KEY) {
      throw new Error("PRETIUM configuration missing");
    }

    // Resolve chain name to numeric chain ID
    const vaultChainId = CHAIN_ID_MAPPING[chain];
    if (!vaultChainId) {
      logger.warn("Unsupported chain for vault lookup", {
        component: "onramp.initiate",
        operation: "validation",
        additional: { chain },
      });
      return NextResponse.json(
        {
          error: `Unsupported chain: ${chain}. Supported chains: ${Object.keys(CHAIN_ID_MAPPING).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const endpoint = `/v1/onramp/${currency_code}`;
    const vaultAddr = vault_address || getVaultAddress(vaultChainId, asset);

    // Map chain name to Pretium API format
    const pretiumChain = CHAIN_MAPPING[chain];
    if (!pretiumChain) {
      logger.warn("Unsupported chain", {
        component: "onramp.initiate",
        operation: "validation",
        additional: { chain },
      });
      return NextResponse.json(
        {
          error: `Unsupported chain: ${chain}. Supported chains: ${Object.keys(CHAIN_MAPPING).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const requestBody = {
      shortcode,
      amount,
      fee,
      mobile_network,
      chain: pretiumChain,
      asset,
      address: vaultAddr, // Funds go to vault contract
      callback_url,
    };

    logger.info("Sending to Pretium API", {
      component: "onramp.initiate",
      operation: "pretium.request",
      additional: {
        endpoint: `${PRETIUM_BASE_URI}${endpoint}`,
        requestBody,
      },
    });

    const response = await fetch(`${PRETIUM_BASE_URI}${endpoint}`, {
      method: "POST",
      headers: {
        "x-api-key": PRETIUM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.warn("Pretium API error response", {
        component: "onramp.initiate",
        operation: "pretium.response",
        additional: {
          status: response.status,
          statusText: response.statusText,
          data,
        },
      });
      return NextResponse.json({
        success: false,
        error:
          data?.message || data?.error || "Ensure the amount is greater than 100 KES",
          code: data?.code || response.status
      },
      { status: 200}
    );

    }

    const transactionCode =
      data.data?.transaction_code || data.transaction_code;
    const onrampCollection = await getCollection("onramp_deposits");
    await onrampCollection.insertOne({
      userAddress: address,
      vaultAddress: vaultAddr,
      asset,
      amount: amount.toString(),
      transactionCode,
      targetGoalId: targetGoalId || undefined,
      source,
      chain,
      chainId: vaultChainId,
      phoneNumber: shortcode,
      mobileNetwork: mobile_network,
      countryCode: currency_code,
      status: "PENDING",
      provider: {
        name: "pretium",
        initiateResponse: data,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Start polling for completion
    setTimeout(
      () =>
        pollAndAllocate(
          transactionCode,
          currency_code,
          address,
          vaultAddr,
          asset,
          chain,
          vaultChainId,
          targetGoalId || undefined
        ),
      5000
    );

    logger.info("Onramp initiated successfully", {
      component: "onramp.initiate",
      operation: "success",
      additional: { data },
    });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    logger.error(error, {
      component: "onramp.initiate",
      operation: "error",
    });
    return NextResponse.json(
      {
        error: error.message || "Failed to initiate onramp",
      },
      { status: 500 }
    );
  }
}

async function pollAndAllocate(
  transactionCode: string,
  currencyCode: string,
  userAddress: string,
  vaultAddress: string,
  asset: string,
  chain: string,
  chainId?: number,
  targetGoalId?: string
) {
  let attempts = 0;
  const maxAttempts = 60;

  const poll = async () => {
    try {
      const statusResponse = await fetch(`${PRETIUM_BASE_URI}/v1/status`, {
        method: "POST",
        headers: {
          "x-api-key": PRETIUM_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transaction_code: transactionCode }),
      });

      const statusData = await statusResponse.json();
      const txData = statusData.data?.data || statusData.data;

      const onrampCollection = await getCollection("onramp_deposits");
      await onrampCollection.updateOne(
        { transactionCode },
        {
          $set: {
            "provider.name": "pretium",
            "provider.lastStatusPayload": statusData,
            "provider.lastStatusAt": new Date(),
            updatedAt: new Date(),
          },
          $push: {
            "provider.statusHistory": {
              $each: [{ receivedAt: new Date(), payload: statusData }],
              $slice: -20,
            },
          },
        }
      );

      const scheduleNextPoll = () => {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        }
      };

      if (txData?.status === "COMPLETE") {
        logger.info("Transaction complete detected", {
          component: "onramp.poller",
          operation: "complete",
          additional: { transactionCode },
        });
        if (!txData.amount_in_usd) {
          logger.warn("amount_in_usd missing from status response", {
            component: "onramp.poller",
            operation: "status",
            additional: { transactionCode },
          });
          await onrampCollection.updateOne(
            { transactionCode },
            {
              $set: {
                status: "AWAITING_AMOUNT",
                lastRetryAttemptAt: new Date(),
                updatedAt: new Date(),
              },
            }
          );
          scheduleNextPoll();
          return;
        }
        if (!txData.transaction_hash) {
          logger.warn("transaction_hash missing from status response", {
            component: "onramp.poller",
            operation: "status",
            additional: {
              transactionCode,
              isReleased: txData.is_released,
            },
          });
          await onrampCollection.updateOne(
            { transactionCode },
            {
              $set: {
                status: "AWAITING_TX_HASH",
                receiptNumber: txData.receipt_number,
                amountInUsd: txData.amount_in_usd,
                lastRetryAttemptAt: new Date(),
                updatedAt: new Date(),
              },
            }
          );
          scheduleNextPoll();
          return;
        }
        const decimals = ASSET_DECIMALS[asset.toUpperCase()] || 18;
        let amountInWei = "0";
        amountInWei = parseUnits(txData.amount_in_usd, decimals).toString();

        logger.info("Updating onramp deposit status", {
          component: "onramp.poller",
          operation: "db.update",
          additional: {
            status: "COMPLETED",
            txHash: txData.transaction_hash,
            receiptNumber: txData.receipt_number,
            amountInUsd: txData.amount_in_usd,
            amountInWei,
          },
        });

        await onrampCollection.updateOne(
          { transactionCode },
          {
            $set: {
              status: "COMPLETED",
                ...(txData.transaction_hash
                  ? { txHash: txData.transaction_hash }
                  : {}),
                receiptNumber: txData.receipt_number,
                amountInUsd: txData.amount_in_usd,
                updatedAt: new Date(),
            },
          }
        );

        logger.info("Triggering allocation", {
          component: "onramp.poller",
          operation: "allocate",
          additional: { transactionCode },
        });
        await allocateOnrampDeposit({
          transactionCode,
          asset,
          userAddress,
          amountInUsd: txData.amount_in_usd,
          txHash: txData.transaction_hash,
          providerPayload: statusData,
          targetGoalId,
          source: "poller",
          chain,
          chainId,
          vaultAddress,
        });
        return;
      }

      if (txData?.status === "FAILED" || txData?.status === "CANCELLED") {
        logger.warn("Transaction failed or cancelled", {
          component: "onramp.poller",
          operation: "failed",
          additional: {
            transactionCode,
            status: txData.status,
            message: txData.message,
            failureReason:
              txData.message || "Transaction was cancelled or failed",
          },
        });

        const onrampCollection = await getCollection("onramp_deposits");
        await onrampCollection.updateOne(
          { transactionCode },
          {
            $set: {
              status: "FAILED",
              failureReason:
                txData.message || "Transaction was cancelled or failed",
              updatedAt: new Date(),
            },
          }
        );
        return;
      }

      scheduleNextPoll();
    } catch (error) {
      logger.error(error as Error, {
        component: "onramp.poller",
        operation: "error",
      });
    }
  };

  poll();
}
