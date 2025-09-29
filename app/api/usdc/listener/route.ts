import { NextRequest, NextResponse } from "next/server";
import { usdcEventListener } from "@/lib/services/usdcEventListener";
import { getDatabase } from "@/lib/mongodb";
import { scroll } from "thirdweb/chains";
import { getTokensBySymbol, getExplorerUrl } from "@/config/chainConfig";
import crypto from "crypto";
import { ethers } from "ethers";

// Set up Scroll mainnet provider
const provider = new ethers.providers.JsonRpcProvider("https://rpc.scroll.io");

// Get USDC address from chain config
const scrollTokens = getTokensBySymbol(scroll.id);
const USDC_ADDRESS = scrollTokens.USDC?.address?.toLowerCase();
const SETTLEMENT_ADDRESS = process.env.USDC_SETTLEMENT_ADDRESS?.toLowerCase();

if (!USDC_ADDRESS) {
  throw new Error("USDC address not found in chain configuration for Scroll");
}
if (!SETTLEMENT_ADDRESS) {
  throw new Error(
    "USDC_SETTLEMENT_ADDRESS not configured in environment variables"
  );
}

// Ensure unique index on transactionHash to prevent duplicates
async function ensureUniqueTransactionIndex() {
  try {
    const db = await getDatabase();
    const collection = db.collection("usdc_webhook_queue");

    // Create unique index on transactionHash (only for documents that have transactionHash)
    await collection.createIndex(
      { transactionHash: 1 },
      {
        unique: true,
        sparse: true, // Only index documents that have transactionHash field
        background: true,
      }
    );
  } catch (error) {
    // Index might already exist, which is fine
    console.log(
      "Transaction hash index setup:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Helper to verify webhook signature (if signature verification is needed)
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return true; // Skip verification if no signature or secret

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// Helper to verify USDC transfer transaction on-chain
async function verifyUsdcTransfer(txHash: string): Promise<{
  isValid: boolean;
  details: any;
  error?: string;
}> {
  try {
    if (!USDC_ADDRESS || !SETTLEMENT_ADDRESS) {
      return {
        isValid: false,
        details: null,
        error: "USDC or settlement address not properly configured",
      };
    }

    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return {
        isValid: false,
        details: null,
        error: "Transaction not found on Scroll network",
      };
    }

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return {
        isValid: false,
        details: null,
        error: "Transaction receipt not found",
      };
    }

    // Verify transaction was successful
    if (receipt.status !== 1) {
      return {
        isValid: false,
        details: null,
        error: `Transaction failed with status ${receipt.status}`,
      };
    }

    const TRANSFER_TOPIC0 = ethers.utils.id(
      "Transfer(address,address,uint256)"
    );

    // Check all logs for USDC Transfer events to settlement address
    for (const log of receipt.logs) {
      if (
        log.address.toLowerCase() === USDC_ADDRESS &&
        log.topics[0].toLowerCase() === TRANSFER_TOPIC0 &&
        "0x" + log.topics[2].slice(-40).toLowerCase() === SETTLEMENT_ADDRESS
      ) {
        // Confirmed real USDC contract and correct destination
        const usdcToken = scrollTokens.USDC;
        return {
          isValid: true,
          details: {
            from: "0x" + log.topics[1].slice(-40),
            to: "0x" + log.topics[2].slice(-40),
            value: ethers.BigNumber.from(log.data).toString(),
            valueFormatted: ethers.utils.formatUnits(
              log.data,
              usdcToken?.decimals || 6
            ),
            usdcContract: log.address.toLowerCase(),
            txHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
            status: receipt.status,
            chainId: scroll.id,
            chainName: scroll.name,
            explorerUrl: `${getExplorerUrl(scroll.id)}/tx/${txHash}`,
            token: {
              symbol: "USDC",
              decimals: usdcToken?.decimals || 6,
              address: USDC_ADDRESS,
            },
          },
        };
      }
    }

    // If no matching USDC transfer to settlement address found
    return {
      isValid: false,
      details: null,
      error: `No valid USDC transfer to settlement address ${SETTLEMENT_ADDRESS} found in transaction logs`,
    };
  } catch (error) {
    console.error("Transaction verification error:", error);
    return {
      isValid: false,
      details: null,
      error:
        error instanceof Error ? error.message : "Unknown verification error",
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "status":
        const status = usdcEventListener.getStatus();
        return NextResponse.json({
          success: true,
          status,
        });

      case "transfers":
        // Get recent USDC transfers from the old collection
        const limit = parseInt(searchParams.get("limit") || "10");
        const db = await getDatabase();
        const transfers = await db
          .collection("usdc_transfers")
          .find({})
          .sort({ timestamp: -1 })
          .limit(limit)
          .toArray();

        return NextResponse.json({
          success: true,
          transfers: transfers.map((transfer) => ({
            ...transfer,
            _id: transfer._id.toString(),
          })),
        });

      case "queue":
        // Get recent webhook queue entries
        const queueLimit = parseInt(searchParams.get("limit") || "20");
        const queueStatus = searchParams.get("status"); // pending, processing, completed, failed
        const rampType = searchParams.get("rampType"); // onramp, offramp

        const database = await getDatabase();
        const filter: any = {};
        if (queueStatus) filter.status = queueStatus;
        if (rampType) filter.rampType = rampType;

        const queueEntries = await database
          .collection("usdc_webhook_queue")
          .find(filter)
          .sort({ receivedAt: -1 })
          .limit(queueLimit)
          .toArray();

        return NextResponse.json({
          success: true,
          queue: queueEntries.map((entry) => ({
            ...entry,
            _id: entry._id.toString(),
          })),
          filter: filter,
          totalCount: queueEntries.length,
        });

      case "ramps":
        // Get fiat ramp transactions specifically
        const rampLimit = parseInt(searchParams.get("limit") || "50");
        const rampDatabase = await getDatabase();
        const rampEntries = await rampDatabase
          .collection("usdc_webhook_queue")
          .find({
            isSettlementTransaction: true,
            $or: [{ rampType: "onramp" }, { rampType: "offramp" }],
          })
          .sort({ receivedAt: -1 })
          .limit(rampLimit)
          .toArray();

        return NextResponse.json({
          success: true,
          ramps: rampEntries.map((entry) => ({
            ...entry,
            _id: entry._id.toString(),
          })),
          totalCount: rampEntries.length,
        });

      case "lookup":
        // Lookup specific transactions for support/debugging
        const txHash = searchParams.get("txHash");
        const userAddress = searchParams.get("address");
        const webhookId = searchParams.get("webhookId");
        const lookupDatabase = await getDatabase();

        let lookupQuery: any = {};
        let responseData: any = {};

        if (txHash) {
          // Look up by transaction hash
          lookupQuery = {
            $or: [
              { transactionHash: txHash },
              { "payload.result.transactionHash": txHash },
              { "verification.details.txHash": txHash },
            ],
          };
          responseData.searchType = "transaction_hash";
          responseData.searchValue = txHash;
        } else if (userAddress) {
          // Look up by user address (from or to)
          const normalizedAddress = userAddress.toLowerCase();
          lookupQuery = {
            $or: [
              { from: normalizedAddress },
              { to: normalizedAddress },
              { "payload.result.from": normalizedAddress },
              { "payload.result.to": normalizedAddress },
              { "verification.details.from": normalizedAddress },
              { "verification.details.to": normalizedAddress },
            ],
          };
          responseData.searchType = "user_address";
          responseData.searchValue = normalizedAddress;
        } else if (webhookId) {
          // Look up by webhook ID
          try {
            const { ObjectId } = require("mongodb");
            lookupQuery = {
              $or: [
                { _id: new ObjectId(webhookId) },
                { webhookId: new ObjectId(webhookId) },
              ],
            };
            responseData.searchType = "webhook_id";
            responseData.searchValue = webhookId;
          } catch (error) {
            return NextResponse.json(
              {
                success: false,
                error: "Invalid webhook ID format",
                message: "Please provide a valid MongoDB ObjectId",
              },
              { status: 400 }
            );
          }
        } else {
          return NextResponse.json(
            {
              success: false,
              error: "Missing search parameter",
              message: "Please provide txHash, address, or webhookId parameter",
            },
            { status: 400 }
          );
        }

        const lookupResults = await lookupDatabase
          .collection("usdc_webhook_queue")
          .find(lookupQuery)
          .sort({ receivedAt: -1 })
          .limit(20)
          .toArray();

        // Also check old transfers collection
        const oldTransfers = await lookupDatabase
          .collection("usdc_transfers")
          .find(lookupQuery)
          .sort({ timestamp: -1 })
          .limit(10)
          .toArray();

        return NextResponse.json({
          success: true,
          ...responseData,
          results: {
            webhookQueue: lookupResults.map((entry) => ({
              ...entry,
              _id: entry._id.toString(),
              webhookId: entry.webhookId?.toString(),
            })),
            oldTransfers: oldTransfers.map((transfer) => ({
              ...transfer,
              _id: transfer._id.toString(),
            })),
          },
          summary: {
            webhookQueueCount: lookupResults.length,
            oldTransfersCount: oldTransfers.length,
            totalFound: lookupResults.length + oldTransfers.length,
          },
          debugInfo: {
            query: lookupQuery,
            timestamp: new Date().toISOString(),
          },
        });

      case "support":
        // Support endpoint with debugging information and common resolutions
        const supportTxHash = searchParams.get("txHash");
        const supportDatabase = await getDatabase();

        if (!supportTxHash) {
          return NextResponse.json({
            success: true,
            message: "USDC Transaction Support Center",
            usage:
              "GET ?action=support&txHash=0x... for detailed transaction analysis",
            commonIssues: {
              "Transaction not found":
                "Verify transaction exists on Scroll network and is confirmed",
              "USDC not credited":
                "Check if transaction was sent to correct settlement address",
              "Verification failed":
                "Ensure transaction includes USDC transfer to settlement address",
              "Webhook not processed":
                "Check if webhook signature is valid and transaction is verified",
            },
            troubleshooting: {
              step1: "Verify transaction on Scroll explorer",
              step2:
                "Check transaction recipient address matches settlement address",
              step3: "Confirm USDC contract address is correct",
              step4: "Check webhook processing status",
              step5: "Contact support with transaction hash if issue persists",
            },
            configuration: {
              chain: scroll.name,
              chainId: scroll.id,
              usdcAddress: USDC_ADDRESS,
              settlementAddress: SETTLEMENT_ADDRESS,
              explorer: getExplorerUrl(scroll.id),
            },
          });
        }

        // Detailed transaction analysis
        try {
          // Check our database first
          const dbResults = await supportDatabase
            .collection("usdc_webhook_queue")
            .find({
              $or: [
                { transactionHash: supportTxHash },
                { "payload.result.transactionHash": supportTxHash },
              ],
            })
            .toArray();

          // Verify transaction on-chain
          const verification = await verifyUsdcTransfer(supportTxHash);

          // Get transaction details from blockchain
          let blockchainData = null;
          try {
            const tx = await provider.getTransaction(supportTxHash);
            const receipt = await provider.getTransactionReceipt(supportTxHash);
            blockchainData = {
              exists: !!tx,
              confirmed: !!receipt,
              status: receipt?.status,
              blockNumber: receipt?.blockNumber,
              from: tx?.from,
              to: tx?.to,
              value: tx?.value?.toString(),
              gasUsed: receipt?.gasUsed?.toString(),
              explorerUrl: `${getExplorerUrl(scroll.id)}/tx/${supportTxHash}`,
            };
          } catch (blockchainError) {
            blockchainData = {
              exists: false,
              error:
                blockchainError instanceof Error
                  ? blockchainError.message
                  : "Unknown error",
            };
          }

          return NextResponse.json({
            success: true,
            transactionHash: supportTxHash,
            analysis: {
              databaseFound: dbResults.length > 0,
              verificationPassed: verification.isValid,
              blockchainExists: blockchainData?.exists || false,
              blockchainConfirmed: blockchainData?.confirmed || false,
            },
            databaseRecords: dbResults.map((record) => ({
              ...record,
              _id: record._id.toString(),
              webhookId: record.webhookId?.toString(),
            })),
            verification,
            blockchain: blockchainData,
            diagnosis: {
              issue: !verification.isValid
                ? "Transaction verification failed"
                : dbResults.length === 0
                  ? "Transaction not in webhook queue"
                  : !blockchainData?.exists
                    ? "Transaction not found on blockchain"
                    : blockchainData?.status !== 1
                      ? "Transaction failed on blockchain"
                      : "Transaction appears normal",
              recommendation: !verification.isValid
                ? "Check if transaction contains valid USDC transfer to settlement address"
                : dbResults.length === 0
                  ? "Webhook may not have been received or processed"
                  : !blockchainData?.exists
                    ? "Verify transaction hash is correct and on Scroll network"
                    : blockchainData?.status !== 1
                      ? "Transaction failed - check gas and execution"
                      : "Check processing status and contact support if needed",
            },
            nextSteps: [
              "Verify transaction hash is correct",
              "Check transaction exists on Scroll blockchain",
              "Confirm USDC transfer to settlement address",
              "Check webhook processing status",
              "Contact support with this analysis if issue persists",
            ],
          });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: "Support analysis failed",
              transactionHash: supportTxHash,
              message: error instanceof Error ? error.message : "Unknown error",
              recommendation:
                "Contact support with transaction hash and error details",
            },
            { status: 500 }
          );
        }

      default:
        const configScrollTokens = getTokensBySymbol(scroll.id);
        const usdcToken = configScrollTokens.USDC;
        const settlementAddress = process.env.USDC_SETTLEMENT_ADDRESS;

        return NextResponse.json({
          success: true,
          message: "USDC Event Listener API",
          configuration: {
            chain: scroll.name,
            chainId: scroll.id,
            token: {
              address: usdcToken?.address || "Not configured",
              symbol: "USDC",
              decimals: usdcToken?.decimals || 6,
            },
            settlement_address: settlementAddress || "Not configured",
            explorer: `${getExplorerUrl(scroll.id)}`,
          },
          endpoints: {
            "GET ?action=status": "Get listener status",
            "GET ?action=transfers&limit=10": "Get recent transfers",
            "GET ?action=queue&limit=20&status=pending&rampType=onramp":
              "Get webhook queue entries (filtered)",
            "GET ?action=ramps&limit=50": "Get fiat ramp transactions only",
            "GET ?action=lookup&txHash=0x...":
              "Lookup transaction by hash for support",
            "GET ?action=lookup&address=0x...":
              "Lookup transactions by user address",
            "GET ?action=lookup&webhookId=...":
              "Lookup transactions by webhook ID",
            "GET ?action=support&txHash=0x...":
              "Detailed transaction analysis and troubleshooting",
            POST: "Accept webhook transactions (queue them for fiat ramps)",
            PUT: "Process specific transaction",
          },
          supportEndpoints: {
            "Transaction Issues":
              "GET ?action=lookup&txHash=0x... - Find specific transaction details",
            "User Issues":
              "GET ?action=lookup&address=0x... - Find all user transactions",
            "Webhook Issues":
              "GET ?action=lookup&webhookId=... - Debug webhook processing",
          },
          listener_status: usdcEventListener.getStatus(),
        });
    }
  } catch (error) {
    console.error("USDC listener API error:", error);
    return NextResponse.json(
      {
        error: "API error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Accept webhook payloads and save to queue
export async function POST(request: NextRequest) {
  try {
    // Ensure unique index exists for transaction hashes
    await ensureUniqueTransactionIndex();

    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Optional signature verification
    const signature =
      request.headers.get("x-signature") || request.headers.get("signature");
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        return NextResponse.json(
          {
            error: "Invalid signature",
            message: "Webhook signature verification failed",
          },
          { status: 401 }
        );
      }
    }

    const db = await getDatabase();
    const queueCollection = db.collection("usdc_webhook_queue");
    const now = new Date();

    // Save the entire webhook payload with metadata for fiat on/offramp processing
    const webhookDoc = {
      payload: body,
      receivedAt: now,
      signature: signature || null,
      headers: Object.fromEntries(request.headers.entries()),
      processed: false,
      processedAt: null,
      rampType: null, // Will be set to 'onramp' or 'offramp' during processing
      settlementAddress: SETTLEMENT_ADDRESS,
      chainId: scroll.id,
      chainName: scroll.name,
      usdcAddress: USDC_ADDRESS,
      status: "pending", // pending, processing, completed, failed
    };

    // If the payload has a result array, verify and save individual transactions
    if (body.result && Array.isArray(body.result)) {
      const verifiedTransactions = [];
      const failedVerifications = [];
      const skippedTransactions = [];

      // Check for existing transactions to avoid duplicates
      const existingTxHashes = await queueCollection.distinct(
        "transactionHash",
        {
          transactionHash: {
            $in: body.result.map((tx: any) => tx.transactionHash),
          },
        }
      );

      // Verify each transaction before saving
      for (const tx of body.result) {
        try {
          // Skip if transaction already exists
          if (existingTxHashes.includes(tx.transactionHash)) {
            skippedTransactions.push({
              transactionHash: tx.transactionHash,
              reason: "Transaction hash already exists in database",
              originalTx: tx,
            });
            continue;
          }

          const verification = await verifyUsdcTransfer(tx.transactionHash);

          if (verification.isValid) {
            verifiedTransactions.push({
              ...tx,
              receivedAt: now,
              settlementAddress: tx.to, // always the 'to' address
              webhookId: null, // Will be set after webhook document is inserted
              processed: false,
              processedAt: null,
              rampType: null, // Will be determined based on transaction direction
              status: "verified", // verified, pending, processing, completed, failed
              isSettlementTransaction:
                tx.to?.toLowerCase() === SETTLEMENT_ADDRESS,
              verification: verification.details,
              verifiedAt: now,
            });
          } else {
            failedVerifications.push({
              transactionHash: tx.transactionHash,
              error: verification.error,
              originalTx: tx,
            });
          }
        } catch (error) {
          failedVerifications.push({
            transactionHash: tx.transactionHash,
            error:
              error instanceof Error ? error.message : "Verification failed",
            originalTx: tx,
          });
        }
      }

      // Save webhook document with processing summary
      const webhookResult = await queueCollection.insertOne({
        ...webhookDoc,
        verifiedTransactionCount: verifiedTransactions.length,
        failedVerificationCount: failedVerifications.length,
        skippedTransactionCount: skippedTransactions.length,
        processingDetails: {
          verified: verifiedTransactions.map((tx) => tx.transactionHash),
          failed: failedVerifications,
          skipped: skippedTransactions,
        },
      });

      // Only save new verified transactions (duplicates already filtered out above)
      if (verifiedTransactions.length > 0) {
        // Update transaction docs with webhook ID and insert them
        const updatedTransactionDocs = verifiedTransactions.map((tx: any) => ({
          ...tx,
          webhookId: webhookResult.insertedId,
        }));

        await queueCollection.insertMany(updatedTransactionDocs);
      }

      // Determine response based on results
      if (verifiedTransactions.length > 0 || skippedTransactions.length > 0) {
        return NextResponse.json({
          success: true,
          message:
            verifiedTransactions.length > 0
              ? "Webhook processed with new verified transactions"
              : "Webhook processed but all transactions already exist",
          webhookId: webhookResult.insertedId.toString(),
          summary: {
            totalTransactions: body.result.length,
            newVerified: verifiedTransactions.length,
            skippedDuplicates: skippedTransactions.length,
            failedVerification: failedVerifications.length,
          },
          details: {
            verifiedTransactions: verifiedTransactions.map(
              (tx) => tx.transactionHash
            ),
            skippedTransactions:
              skippedTransactions.length > 0 ? skippedTransactions : undefined,
            failedVerifications:
              failedVerifications.length > 0 ? failedVerifications : undefined,
          },
        });
      } else {
        // No valid transactions found - update webhook status to failed
        await queueCollection.updateOne(
          { _id: webhookResult.insertedId },
          { $set: { status: "failed" } }
        );

        return NextResponse.json(
          {
            success: false,
            message: "No valid transactions found after verification",
            webhookId: webhookResult.insertedId.toString(),
            summary: {
              totalTransactions: body.result.length,
              newVerified: 0,
              skippedDuplicates: skippedTransactions.length,
              failedVerification: failedVerifications.length,
            },
            details: {
              failedVerifications,
            },
          },
          { status: 400 }
        );
      }
    } else {
      // Just save the webhook payload as-is
      const result = await queueCollection.insertOne(webhookDoc);

      return NextResponse.json({
        success: true,
        message: "Webhook queued",
        webhookId: result.insertedId.toString(),
      });
    }
  } catch (error) {
    console.error("USDC webhook error:", error);
    return NextResponse.json(
      {
        error: "Webhook error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { transaction_hash } = await request.json();

    if (!transaction_hash) {
      return NextResponse.json(
        {
          error: "Missing transaction_hash",
          message: "Please provide a transaction_hash to process",
        },
        { status: 400 }
      );
    }

    await usdcEventListener.processSpecificTransaction(transaction_hash);

    return NextResponse.json({
      success: true,
      message: `Transaction ${transaction_hash} processed successfully`,
    });
  } catch (error) {
    console.error("Transaction processing error:", error);
    return NextResponse.json(
      {
        error: "Processing error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
