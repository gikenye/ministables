import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { getDisbursementStatus } from "@/lib/services/disbursementQueue";

/**
 * Get disbursement job status
 * GET /api/disbursement/status?jobId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Missing jobId parameter" },
        { status: 400 }
      );
    }

    const job = await getDisbursementStatus(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job._id?.toString(),
      status: job.status,
      recipientAddress: job.recipientAddress,
      amountKES: job.amountKES,
      transactionCode: job.transactionCode,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      processingStartedAt: job.processingStartedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
    });
  } catch (error: unknown) {
    console.error("❌ Error fetching disbursement status:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
