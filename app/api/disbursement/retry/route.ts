import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * Retry a failed disbursement job
 * POST /api/disbursement/retry
 * Body: { jobId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "Missing jobId parameter" },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const queue = db.collection("disbursement_queue");

    // Find the job
    const job = await queue.findOne({ _id: new ObjectId(jobId) });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Check if job can be retried
    if (job.status !== "failed") {
      return NextResponse.json(
        { error: `Job status is ${job.status}, can only retry failed jobs` },
        { status: 400 }
      );
    }

    if (job.retryCount >= job.maxRetries) {
      return NextResponse.json(
        {
          error: `Job has already been retried ${job.retryCount} times (max: ${job.maxRetries})`,
        },
        { status: 400 }
      );
    }

    // Reset job to pending
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

    console.log(`🔄 Job ${jobId} reset to pending for retry`);

    return NextResponse.json({
      success: true,
      message: "Job queued for retry",
      jobId,
      retryCount: job.retryCount,
    });
  } catch (error: unknown) {
    console.error("❌ Error retrying job:", error);
    return NextResponse.json(
      {
        error: "Failed to retry job",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Retry all failed jobs that haven't exceeded max retries
 * POST /api/disbursement/retry-all
 */
export async function PUT(request: NextRequest) {
  try {
    const db = await getDatabase();
    const queue = db.collection("disbursement_queue");

    // Find all failed jobs that can be retried
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

    console.log(`🔄 Reset ${result.modifiedCount} failed jobs to pending`);

    return NextResponse.json({
      success: true,
      message: `${result.modifiedCount} jobs queued for retry`,
      count: result.modifiedCount,
    });
  } catch (error: unknown) {
    console.error("❌ Error retrying jobs:", error);
    return NextResponse.json(
      {
        error: "Failed to retry jobs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
