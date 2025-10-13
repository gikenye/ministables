/**
 * Disbursement Queue Service
 * this service enqueues jobs to be processed by a separate worker
 */

import { getDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export interface DisbursementJob {
  _id?: ObjectId;
  recipientAddress: string;
  amountKES: number;
  transactionCode: string; // Original payment transaction code
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
  processingStartedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  retryCount: number;
  maxRetries: number;
  result?: {
    success: boolean;
    transactionHash: string;
    usdcAmount: number;
    kesAmount: number;
    recipient: string;
  };
  error?: string;
}

/**
 * Enqueue a disbursement job to be processed by the worker
 */
export async function enqueueDisbursement(
  recipientAddress: string,
  amountKES: number,
  transactionCode: string
): Promise<string> {
  try {
    const db = await getDatabase();
    const queue = db.collection<DisbursementJob>("disbursement_queue");

    const job: DisbursementJob = {
      recipientAddress,
      amountKES,
      transactionCode,
      status: "pending",
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };

    const result = await queue.insertOne(job);
    console.log(`📋 Disbursement job enqueued: ${result.insertedId}`);

    return result.insertedId.toString();
  } catch (error) {
    console.error("❌ Failed to enqueue disbursement:", error);
    throw error;
  }
}

/**
 * Get the status of a disbursement job
 */
export async function getDisbursementStatus(
  jobId: string
): Promise<DisbursementJob | null> {
  try {
    const db = await getDatabase();
    const queue = db.collection<DisbursementJob>("disbursement_queue");

    return await queue.findOne({ _id: new ObjectId(jobId) });
  } catch (error) {
    console.error("❌ Failed to get disbursement status:", error);
    return null;
  }
}

/**
 * Check if there are any pending or processing jobs for a transaction
 */
export async function checkExistingJob(
  transactionCode: string
): Promise<DisbursementJob | null> {
  try {
    const db = await getDatabase();
    const queue = db.collection<DisbursementJob>("disbursement_queue");

    return await queue.findOne({
      transactionCode,
      status: { $in: ["pending", "processing", "completed"] },
    });
  } catch (error) {
    console.error("❌ Failed to check existing job:", error);
    return null;
  }
}
