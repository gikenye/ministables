import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

/**
 * Disbursement Queue Dashboard
 * GET /api/disbursement/dashboard
 *
 * Returns statistics and recent jobs from the disbursement queue
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const queue = db.collection("disbursement_queue");

    // Get counts by status
    const [
      pendingCount,
      processingCount,
      completedCount,
      failedCount,
      totalCount,
    ] = await Promise.all([
      queue.countDocuments({ status: "pending" }),
      queue.countDocuments({ status: "processing" }),
      queue.countDocuments({ status: "completed" }),
      queue.countDocuments({ status: "failed" }),
      queue.countDocuments({}),
    ]);

    // Get recent jobs
    const recentJobs = await queue
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    // Get stuck jobs (processing for more than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const stuckJobs = await queue
      .find({
        status: "processing",
        processingStartedAt: { $lt: fiveMinutesAgo },
      })
      .toArray();

    // Get failed jobs that can be retried
    const retryableJobs = await queue
      .find({
        status: "failed",
        retryCount: { $lt: 3 },
      })
      .sort({ failedAt: -1 })
      .limit(10)
      .toArray();

    // Calculate success rate (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCompleted = await queue.countDocuments({
      status: "completed",
      completedAt: { $gte: oneDayAgo },
    });
    const recentFailed = await queue.countDocuments({
      status: "failed",
      failedAt: { $gte: oneDayAgo },
    });
    const successRate =
      recentCompleted + recentFailed > 0
        ? (recentCompleted / (recentCompleted + recentFailed)) * 100
        : 0;

    // Calculate total USDC disbursed (completed jobs)
    const completedJobs = await queue.find({ status: "completed" }).toArray();
    const totalUSDCDisbursed = completedJobs.reduce(
      (sum, job) => sum + (job.result?.usdcAmount || 0),
      0
    );

    // Get active alerts
    const alertsCollection = db.collection("system_alerts");
    const criticalAlerts = await alertsCollection.countDocuments({
      severity: "CRITICAL",
      acknowledged: false,
    });
    const totalUnacknowledgedAlerts = await alertsCollection.countDocuments({
      acknowledged: false,
    });

    return NextResponse.json({
      stats: {
        total: totalCount,
        pending: pendingCount,
        processing: processingCount,
        completed: completedCount,
        failed: failedCount,
        stuck: stuckJobs.length,
        retryable: retryableJobs.length,
        successRate: successRate.toFixed(2) + "%",
        totalUSDCDisbursed: totalUSDCDisbursed.toFixed(2),
        criticalAlerts,
        unacknowledgedAlerts: totalUnacknowledgedAlerts,
      },
      recentJobs: recentJobs.map((job) => ({
        id: job._id.toString(),
        recipientAddress: job.recipientAddress,
        amountKES: job.amountKES,
        status: job.status,
        transactionCode: job.transactionCode,
        retryCount: job.retryCount,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        failedAt: job.failedAt,
        error: job.error,
        result: job.result,
      })),
      stuckJobs: stuckJobs.map((job) => ({
        id: job._id.toString(),
        recipientAddress: job.recipientAddress,
        amountKES: job.amountKES,
        processingStartedAt: job.processingStartedAt,
        transactionCode: job.transactionCode,
      })),
      retryableJobs: retryableJobs.map((job) => ({
        id: job._id.toString(),
        recipientAddress: job.recipientAddress,
        amountKES: job.amountKES,
        retryCount: job.retryCount,
        error: job.error,
        failedAt: job.failedAt,
        transactionCode: job.transactionCode,
      })),
    });
  } catch (error: unknown) {
    console.error("❌ Error fetching dashboard data:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch dashboard data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
