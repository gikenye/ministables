#!/usr/bin/env node
/**
 * Standalone Disbursement Worker Service
 *
 * This service runs as a separate Node.js process and handles USDC disbursements
 * independently from the Next.js API routes. It can be run as:
 * 1. A long-running worker process
 * 2. A serverless function (AWS Lambda, Google Cloud Functions)
 * 3. A cron job triggered service
 *
 * Usage:
 *   node services/disbursement-worker.js
 */

const { ethers } = require("ethers");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const SETTLEMENT_SECRET = process.env.SETTLEMENT_SECRET;
const PRETIUM_BASE_URI = process.env.PRETIUM_BASE_URI;
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

// Scroll chain ID and USDC configuration
// Source: config/chainConfig.ts -> TOKENS[scroll.id] -> USDC
// Note: Hardcoded here for Node.js compatibility (worker runs outside Next.js)
const SCROLL_CHAIN_ID = 534352; // scroll.id
const SCROLL_USDC_CONFIG = {
  address: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4", // Must match chainConfig.ts
  decimals: 6,
  symbol: "USDC",
};

const USDC_ADDRESS = SCROLL_USDC_CONFIG.address;
const USDC_DECIMALS = SCROLL_USDC_CONFIG.decimals;

const SCROLL_RPCS = [
  "https://rpc.scroll.io",
  "https://scroll-mainnet.public.blastapi.io",
  "https://scroll.api.onfinality.io/public",
];

const usdcAbi = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

let mongoClient = null;
let provider = null;
let isHealthy = true;
let lastProcessedTime = new Date();
let processedCount = 0;
let failedCount = 0;
let insufficientBalanceCount = 0;
let lastBalanceAlertTime = null;

// Minimum USDC balance threshold for alerts (in USDC)
const MIN_USDC_THRESHOLD = 10;
const BALANCE_ALERT_COOLDOWN = 3600000; // 1 hour in milliseconds

async function connectMongoDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    console.log("✅ Connected to MongoDB");
  }
  return mongoClient.db("ministables");
}

// Alert function for critical issues
async function sendBalanceAlert(currentBalance, requiredAmount) {
  const now = Date.now();
  // Only send alert once per hour to avoid spam
  if (
    lastBalanceAlertTime &&
    now - lastBalanceAlertTime < BALANCE_ALERT_COOLDOWN
  ) {
    return;
  }

  console.error("🚨 CRITICAL ALERT: Insufficient USDC Balance");
  console.error(`   Current Balance: ${currentBalance} USDC`);
  console.error(`   Required Amount: ${requiredAmount} USDC`);
  console.error(`   Please top up the settlement wallet immediately!`);

  // Store alert in database for dashboard visibility
  try {
    const db = await connectMongoDB();
    await db.collection("system_alerts").insertOne({
      type: "INSUFFICIENT_BALANCE",
      severity: "CRITICAL",
      message: `Insufficient USDC balance: ${currentBalance} USDC available, ${requiredAmount} USDC required`,
      currentBalance,
      requiredAmount,
      timestamp: new Date(),
      acknowledged: false,
    });
  } catch (err) {
    console.error("Failed to log alert to database:", err.message);
  }

  lastBalanceAlertTime = now;
}

// Check if error is retryable
function isRetryableError(errorMessage) {
  const retryableErrors = [
    "Insufficient USDC balance",
    "network error",
    "timeout",
    "connection refused",
    "ETIMEDOUT",
    "ECONNRESET",
    "rate limit",
  ];

  return retryableErrors.some((err) =>
    errorMessage.toLowerCase().includes(err.toLowerCase())
  );
}

// Health check function for monitoring
function getHealthStatus() {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();

  return {
    status: isHealthy ? "healthy" : "unhealthy",
    uptime: `${Math.floor(uptime / 60)} minutes`,
    processedJobs: processedCount,
    failedJobs: failedCount,
    insufficientBalanceFailures: insufficientBalanceCount,
    successRate:
      processedCount + failedCount > 0
        ? ((processedCount / (processedCount + failedCount)) * 100).toFixed(2) +
          "%"
        : "N/A",
    lastProcessed: lastProcessedTime.toISOString(),
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
    },
    provider: provider ? "connected" : "disconnected",
    mongodb: mongoClient ? "connected" : "disconnected",
  };
}

async function initializeProvider() {
  for (const rpcUrl of SCROLL_RPCS) {
    try {
      const tempProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const blockNumber = await tempProvider.getBlockNumber();
      console.log(`✅ Connected to RPC: ${rpcUrl} (block: ${blockNumber})`);
      return tempProvider;
    } catch (err) {
      console.warn(`⚠️ Failed to connect to RPC ${rpcUrl}:`, err.message);
    }
  }
  throw new Error("All Scroll RPCs failed");
}

async function getExchangeRate() {
  try {
    const response = await fetch(`${PRETIUM_BASE_URI}/v1/exchange-rate`, {
      method: "POST",
      headers: {
        "x-api-key": PRETIUM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ currency_code: "KES" }),
    });
    const data = await response.json();
    return data.data.selling_rate;
  } catch (error) {
    console.warn("⚠️ Failed to fetch exchange rate, using fallback");
    return 131.02;
  }
}

async function processDisbursement(job) {
  const { recipientAddress, amountKES, jobId, transactionCode } = job;

  console.log(`🔥 Processing disbursement job ${jobId}`, {
    recipientAddress,
    amountKES,
    transactionCode,
  });

  try {
    if (!provider) {
      provider = await initializeProvider();
    }

    const wallet = new ethers.Wallet(SETTLEMENT_SECRET, provider);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, wallet);

    // Get exchange rate
    const exchangeRate = await getExchangeRate();
    console.log(`💱 KES/USDC rate: ${exchangeRate}`);

    // Convert KES to USDC
    const usdcAmountStr = (amountKES / exchangeRate).toFixed(6);
    const usdcAmount = ethers.utils.parseUnits(usdcAmountStr, USDC_DECIMALS);

    // Check balances
    const ethBalance = await provider.getBalance(wallet.address);
    const usdcBalance = await usdcContract.balanceOf(wallet.address);

    const usdcBalanceFormatted = ethers.utils.formatUnits(
      usdcBalance,
      USDC_DECIMALS
    );

    console.log("💰 Wallet balances:", {
      eth: ethers.utils.formatEther(ethBalance),
      usdc: usdcBalanceFormatted,
    });

    // Check if balance is below threshold
    if (parseFloat(usdcBalanceFormatted) < MIN_USDC_THRESHOLD) {
      console.warn(
        `⚠️ WARNING: Low USDC balance (${usdcBalanceFormatted} USDC)`
      );
    }

    // Check if sufficient balance for this transaction
    if (usdcBalance.lt(usdcAmount)) {
      const requiredAmount = parseFloat(usdcAmountStr);
      await sendBalanceAlert(usdcBalanceFormatted, requiredAmount);
      insufficientBalanceCount++;
      throw new Error("Insufficient USDC balance");
    }

    // Estimate gas
    const gasLimit = (
      await usdcContract.estimateGas.transfer(recipientAddress, usdcAmount)
    ).add(ethers.BigNumber.from("15000"));

    const gasPrice = ethers.utils.parseUnits("0.02", "gwei");
    const gasCost = gasLimit.mul(gasPrice);

    if (ethBalance.lt(gasCost)) {
      throw new Error(`Insufficient ETH for gas`);
    }

    // Static call test
    await usdcContract.callStatic.transfer(recipientAddress, usdcAmount, {
      gasLimit,
    });
    console.log("✅ Static call succeeded");

    // Send transaction
    const tx = await usdcContract.transfer(recipientAddress, usdcAmount, {
      gasLimit,
      gasPrice,
    });
    console.log(`📤 Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log(`✅ Transfer confirmed: ${receipt.transactionHash}`);

      const result = {
        success: true,
        transactionHash: receipt.transactionHash,
        usdcAmount: parseFloat(usdcAmountStr),
        kesAmount: amountKES,
        recipient: recipientAddress,
      };

      // Update the original KES transaction with disbursement info
      const db = await connectMongoDB();
      if (transactionCode) {
        await db.collection("kes_transactions").updateOne(
          { transaction_key: transactionCode },
          {
            $set: {
              disbursement_status: "COMPLETED",
              disbursement_tx_hash: receipt.transactionHash,
              usdc_amount: parseFloat(usdcAmountStr),
              disbursement_completed_at: new Date(),
            },
          }
        );
        console.log(`📝 Updated KES transaction: ${transactionCode}`);
      }

      return result;
    } else {
      throw new Error("Transaction failed");
    }
  } catch (error) {
    console.error(`❌ Disbursement failed:`, error.message);

    // Update the original KES transaction with failure info
    try {
      const db = await connectMongoDB();
      if (transactionCode) {
        await db.collection("kes_transactions").updateOne(
          { transaction_key: transactionCode },
          {
            $set: {
              disbursement_status: "FAILED",
              disbursement_error: error.message,
              disbursement_failed_at: new Date(),
            },
          }
        );
      }
    } catch (dbError) {
      console.error("Failed to update transaction:", dbError.message);
    }

    throw error;
  }
}

async function pollQueue() {
  const db = await connectMongoDB();
  const queue = db.collection("disbursement_queue");

  while (true) {
    try {
      // Find and claim next pending job (prioritize oldest first)
      const job = await queue.findOneAndUpdate(
        { status: "pending" },
        {
          $set: {
            status: "processing",
            processingStartedAt: new Date(),
          },
        },
        {
          sort: { createdAt: 1 },
          returnDocument: "after",
        }
      );

      if (job) {
        console.log(`📋 Found job: ${job._id}`);

        try {
          const result = await processDisbursement({
            recipientAddress: job.recipientAddress,
            amountKES: job.amountKES,
            jobId: job._id.toString(),
            transactionCode: job.transactionCode,
          });

          // Update job as completed
          await queue.updateOne(
            { _id: job._id },
            {
              $set: {
                status: "completed",
                completedAt: new Date(),
                result,
              },
            }
          );
          console.log(`✅ Job ${job._id} completed`);

          // Update metrics
          processedCount++;
          lastProcessedTime = new Date();
          isHealthy = true; // Mark as healthy on success
        } catch (error) {
          const currentRetryCount = job.retryCount || 0;
          const maxRetries = job.maxRetries || 3;
          const canRetry = currentRetryCount < maxRetries;
          const isRetryable = isRetryableError(error.message);

          console.error(`❌ Job ${job._id} failed:`, error.message);
          console.log(
            `   Retry ${currentRetryCount + 1}/${maxRetries} - Retryable: ${isRetryable}`
          );

          if (canRetry && isRetryable) {
            // Mark as pending for retry with exponential backoff
            const retryDelay = Math.min(
              300000,
              Math.pow(2, currentRetryCount) * 60000
            ); // Max 5 min
            const nextRetryAt = new Date(Date.now() + retryDelay);

            await queue.updateOne(
              { _id: job._id },
              {
                $set: {
                  status: "pending", // Return to pending for retry
                  error: error.message,
                  lastFailedAt: new Date(),
                  nextRetryAt,
                },
                $inc: { retryCount: 1 },
              }
            );

            console.log(
              `🔄 Job ${job._id} queued for retry in ${Math.round(retryDelay / 60000)} minutes`
            );

            // Wait before processing next job to respect backoff
            await new Promise((resolve) =>
              setTimeout(resolve, Math.min(retryDelay, 10000))
            );
          } else {
            // Mark as permanently failed
            await queue.updateOne(
              { _id: job._id },
              {
                $set: {
                  status: "failed",
                  failedAt: new Date(),
                  error: error.message,
                  finalFailureReason: canRetry
                    ? "Non-retryable error"
                    : "Max retries exceeded",
                },
                $inc: { retryCount: 1 },
              }
            );

            console.error(
              `💀 Job ${job._id} permanently failed: ${canRetry ? "Non-retryable error" : "Max retries exceeded"}`
            );
          }

          // Update metrics
          failedCount++;

          // Only mark as unhealthy for non-balance issues
          if (!error.message.includes("Insufficient USDC balance")) {
            isHealthy = false;
          }
        }
      } else {
        // Check for failed jobs that can be retried
        const retryableJob = await queue.findOne({
          status: "pending",
          retryCount: { $gt: 0, $lt: 3 },
          nextRetryAt: { $lte: new Date() },
        });

        if (retryableJob) {
          console.log(`🔄 Found retryable job: ${retryableJob._id}`);
          // It will be picked up in the next iteration
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          // No jobs, wait before polling again
          isHealthy = true; // Mark as healthy when idle
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    } catch (error) {
      console.error("❌ Queue polling error:", error);
      isHealthy = false; // Mark as unhealthy on error
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

// Log health status periodically
setInterval(() => {
  const health = getHealthStatus();
  console.log("📊 Health Status:", JSON.stringify(health, null, 2));
}, 60000); // Every minute

async function main() {
  console.log("🚀 Starting Disbursement Worker Service");

  if (!SETTLEMENT_SECRET || !MONGODB_URI) {
    console.error("❌ Missing required environment variables");
    process.exit(1);
  }

  // Initialize provider
  provider = await initializeProvider();

  // Start polling queue
  await pollQueue();
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});

// Start the worker
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { processDisbursement };
