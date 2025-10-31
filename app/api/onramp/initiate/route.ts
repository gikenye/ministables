import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { getVaultAddress } from "@/config/chainConfig";
import { parseUnits } from "viem";
import { base, celo, scroll } from "thirdweb/chains";

const PRETIUM_BASE_URI = process.env.PRETIUM_BASE_URI;
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY;
const ALLOCATE_API_URL = process.env.ALLOCATE_API_URL;

console.log(
  "🔧 Initiate route loaded with ALLOCATE_API_URL:",
  ALLOCATE_API_URL
);

const ASSET_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  cUSD: 18,
  CUSD: 18,
  cKES: 18,
  CKES: 18,
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

export async function POST(request: NextRequest) {
  try {
    console.log("💳 Initiating onramp - API route called");

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
    } = body;

    console.log("📥 Received request body:", JSON.stringify(body, null, 2));

    if (
      !shortcode ||
      !amount ||
      !mobile_network ||
      !chain ||
      !asset ||
      !address
    ) {
      console.log("❌ Onramp failed - Missing required fields");
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
      console.log("❌ Unsupported chain for vault lookup:", chain);
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
      console.log("❌ Unsupported chain:", chain);
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
      address: vaultAddr,
      callback_url,
    };

    console.log("📤 Sending to Pretium API:", {
      endpoint: `${PRETIUM_BASE_URI}${endpoint}`,
      requestBody: JSON.stringify(requestBody, null, 2),
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
      console.log("❌ Pretium API Error Response:", {
        status: response.status,
        statusText: response.statusText,
        data: JSON.stringify(data, null, 2),
      });
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
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
      phoneNumber: shortcode,
      mobileNetwork: mobile_network,
      countryCode: currency_code,
      status: "PENDING",
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
          asset
        ),
      5000
    );

    console.log("✅ Onramp initiated successfully:", data);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("❌ Onramp initiation error:", error.message);
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
  asset: string
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

      if (txData?.status === "COMPLETE" && txData?.transaction_hash) {
        console.log("✅ Transaction COMPLETE detected:", transactionCode);
        const onrampCollection = await getCollection("onramp_deposits");
        const decimals = ASSET_DECIMALS[asset.toUpperCase()] || 18;
        const amountInWei = parseUnits(
          txData.amount_in_usd,
          decimals
        ).toString();

        console.log("💾 Updating database with:", {
          status: "COMPLETED",
          txHash: txData.transaction_hash,
          receiptNumber: txData.receipt_number,
          amountInUsd: txData.amount_in_usd,
          amountInWei,
        });

        await onrampCollection.updateOne(
          { transactionCode },
          {
            $set: {
              status: "COMPLETED",
              txHash: txData.transaction_hash,
              receiptNumber: txData.receipt_number,
              amountInUsd: txData.amount_in_usd,
              updatedAt: new Date(),
            },
          }
        );

        if (ALLOCATE_API_URL) {
          const allocatePayload = {
            asset: asset.toUpperCase(),
            userAddress,
            amount: amountInWei,
            txHash: txData.transaction_hash,
          };
          console.log(
            "📦 Calling allocation API at:",
            `${ALLOCATE_API_URL}/allocate`
          );
          console.log("📦 Payload:", JSON.stringify(allocatePayload, null, 2));

          try {
            const allocateResponse = await fetch(
              `${ALLOCATE_API_URL}/allocate`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify(allocatePayload),
              }
            );

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
              "✅ Allocation response status:",
              allocateResponse.status
            );
            console.log(
              "✅ Allocation response:",
              JSON.stringify(allocateResult, null, 2)
            );

            // Update database with allocation result
            await onrampCollection.updateOne(
              { transactionCode },
              {
                $set: {
                  allocation: {
                    ...allocateResult,
                    responseStatus: allocateResponse.status,
                    timestamp: new Date(),
                  },
                  updatedAt: new Date(),
                },
              }
            );

            // Log success/failure clearly
            if (allocateResponse.ok && allocateResult.success !== false) {
              console.log(
                "🎉 Allocation completed successfully for transaction:",
                transactionCode
              );
            } else {
              console.error("❌ Allocation failed with response:", {
                status: allocateResponse.status,
                result: allocateResult,
              });
            }
          } catch (allocError: any) {
            console.error("❌ Allocation API call failed:", {
              error: allocError.message,
              transactionCode,
              userAddress,
              amount: amountInWei,
            });

            await onrampCollection.updateOne(
              { transactionCode },
              {
                $set: {
                  allocation: {
                    success: false,
                    error: allocError.message,
                    timestamp: new Date(),
                    retryable: true,
                  },
                  updatedAt: new Date(),
                },
              }
            );
          }
        } else {
          console.log(
            "⚠️ ALLOCATE_API_URL not configured, skipping allocation"
          );

          // Update database to indicate allocation was skipped
          await onrampCollection.updateOne(
            { transactionCode },
            {
              $set: {
                allocation: {
                  success: false,
                  error: "ALLOCATE_API_URL not configured",
                  skipped: true,
                  timestamp: new Date(),
                },
                updatedAt: new Date(),
              },
            }
          );
        }
        return;
      }

      if (txData?.status === "FAILED" || txData?.status === "CANCELLED") {
        console.log("❌ Transaction FAILED/CANCELLED detected:", {
          transactionCode,
          status: txData.status,
          message: txData.message,
          failureReason:
            txData.message || "Transaction was cancelled or failed",
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

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      }
    } catch (error) {
      console.error("❌ Polling error:", error);
    }
  };

  poll();
}
