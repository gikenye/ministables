#!/usr/bin/env node

/**
 * Disbursement Queue CLI Tool
 *
 * Usage:
 *   node scripts/queue-cli.js status              # Show queue statistics
 *   node scripts/queue-cli.js list [status]       # List jobs (optional: pending|processing|completed|failed)
 *   node scripts/queue-cli.js retry <jobId>       # Retry a specific job
 *   node scripts/queue-cli.js retry-all           # Retry all failed jobs
 *   node scripts/queue-cli.js reset-stuck         # Reset stuck jobs to pending
 *   node scripts/queue-cli.js clear-completed     # Clear old completed jobs (> 7 days)
 */

const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not set in environment variables");
  process.exit(1);
}

let mongoClient = null;

async function connect() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
  }
  return mongoClient.db("ministables").collection("disbursement_queue");
}

async function showStatus() {
  const queue = await connect();

  const [pending, processing, completed, failed, total] = await Promise.all([
    queue.countDocuments({ status: "pending" }),
    queue.countDocuments({ status: "processing" }),
    queue.countDocuments({ status: "completed" }),
    queue.countDocuments({ status: "failed" }),
    queue.countDocuments({}),
  ]);

  // Get stuck jobs
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const stuck = await queue.countDocuments({
    status: "processing",
    processingStartedAt: { $lt: fiveMinutesAgo },
  });

  console.log("\n📊 Queue Status");
  console.log("================");
  console.log(`Total Jobs:      ${total}`);
  console.log(`Pending:         ${pending}`);
  console.log(`Processing:      ${processing}`);
  console.log(`Completed:       ${completed}`);
  console.log(`Failed:          ${failed}`);
  console.log(`Stuck (>5min):   ${stuck}`);
  console.log("");

  // Calculate success rate
  if (completed + failed > 0) {
    const successRate = (completed / (completed + failed)) * 100;
    console.log(`Success Rate:    ${successRate.toFixed(2)}%`);
  }
}

async function listJobs(status = null) {
  const queue = await connect();

  const query = status ? { status } : {};
  const jobs = await queue
    .find(query)
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  console.log(
    `\n📋 Jobs${status ? ` (${status})` : ""} - Showing ${jobs.length} most recent`
  );
  console.log("=".repeat(80));

  for (const job of jobs) {
    console.log(`\nID: ${job._id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Recipient: ${job.recipientAddress}`);
    console.log(`Amount: ${job.amountKES} KES`);
    console.log(`Transaction: ${job.transactionCode || "N/A"}`);
    console.log(`Retries: ${job.retryCount}/${job.maxRetries}`);
    console.log(`Created: ${job.createdAt?.toISOString()}`);

    if (job.status === "completed") {
      console.log(`Completed: ${job.completedAt?.toISOString()}`);
      console.log(`TX Hash: ${job.result?.transactionHash}`);
      console.log(`USDC Amount: ${job.result?.usdcAmount}`);
    }

    if (job.status === "failed") {
      console.log(`Failed: ${job.failedAt?.toISOString()}`);
      console.log(`Error: ${job.error}`);
    }

    if (job.status === "processing") {
      console.log(
        `Processing Since: ${job.processingStartedAt?.toISOString()}`
      );
    }
  }
  console.log("");
}

async function retryJob(jobId) {
  const queue = await connect();

  const job = await queue.findOne({ _id: new ObjectId(jobId) });

  if (!job) {
    console.error(`❌ Job ${jobId} not found`);
    process.exit(1);
  }

  if (job.status !== "failed") {
    console.error(`❌ Job status is ${job.status}, can only retry failed jobs`);
    process.exit(1);
  }

  if (job.retryCount >= job.maxRetries) {
    console.error(
      `❌ Job has already been retried ${job.retryCount} times (max: ${job.maxRetries})`
    );
    process.exit(1);
  }

  await queue.updateOne(
    { _id: new ObjectId(jobId) },
    {
      $set: {
        status: "pending",
        failedAt: null,
      },
      $unset: {
        error: "",
        processingStartedAt: "",
      },
    }
  );

  console.log(`✅ Job ${jobId} reset to pending for retry`);
}

async function retryAll() {
  const queue = await connect();

  const result = await queue.updateMany(
    {
      status: "failed",
      retryCount: { $lt: 3 },
    },
    {
      $set: {
        status: "pending",
        failedAt: null,
      },
      $unset: {
        error: "",
        processingStartedAt: "",
      },
    }
  );

  console.log(`✅ Reset ${result.modifiedCount} failed jobs to pending`);
}

async function resetStuck() {
  const queue = await connect();

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const result = await queue.updateMany(
    {
      status: "processing",
      processingStartedAt: { $lt: fiveMinutesAgo },
    },
    {
      $set: {
        status: "pending",
      },
      $unset: {
        processingStartedAt: "",
      },
    }
  );

  console.log(`✅ Reset ${result.modifiedCount} stuck jobs to pending`);
}

async function clearCompleted() {
  const queue = await connect();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const result = await queue.deleteMany({
    status: "completed",
    completedAt: { $lt: sevenDaysAgo },
  });

  console.log(
    `✅ Deleted ${result.deletedCount} completed jobs older than 7 days`
  );
}

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (command) {
      case "status":
        await showStatus();
        break;

      case "list":
        await listJobs(arg);
        break;

      case "retry":
        if (!arg) {
          console.error("❌ Usage: node scripts/queue-cli.js retry <jobId>");
          process.exit(1);
        }
        await retryJob(arg);
        break;

      case "retry-all":
        await retryAll();
        break;

      case "reset-stuck":
        await resetStuck();
        break;

      case "clear-completed":
        await clearCompleted();
        break;

      default:
        console.log("Disbursement Queue CLI");
        console.log("");
        console.log("Usage:");
        console.log("  node scripts/queue-cli.js status");
        console.log("  node scripts/queue-cli.js list [status]");
        console.log("  node scripts/queue-cli.js retry <jobId>");
        console.log("  node scripts/queue-cli.js retry-all");
        console.log("  node scripts/queue-cli.js reset-stuck");
        console.log("  node scripts/queue-cli.js clear-completed");
        break;
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
  }
}

main();
