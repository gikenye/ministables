import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { eventService } from "@/lib/services/eventService";
import {
  enqueueDisbursement,
  checkExistingJob,
} from "@/lib/services/disbursementQueue";

export async function POST(request: NextRequest) {
  try {
    console.log("📞 KES callback received");

    const body = await request.json();

    // Log the complete callback payload for debugging
    console.log("📥 Complete callback payload:", JSON.stringify(body, null, 2));

    const {
      shortcode,
      amount,
      mobile_network,
      transaction_id,
      status,
      phone_number,
      receipt_number,
      transaction_code,
      reference,
      message,
      public_name,
      wallet_address,
    } = body;

    // Log the transaction details
    const transactionKey =
      transaction_code ||
      transaction_id ||
      reference ||
      `${shortcode}_${phone_number}_${amount}_${Date.now()}`;

    console.log(
      "✅ Processing transaction:",
      transactionKey,
      "Status:",
      status
    );

    // Log failure details if payment failed
    if (
      status?.toUpperCase() === "FAILED" ||
      status?.toUpperCase() === "FAILURE"
    ) {
      console.log("❌ Payment FAILED - Details:", {
        transaction_code,
        message,
        failure_reason: message,
        phone_number,
        amount,
        mobile_network,
        receipt_number,
      });
    }

    // Get wallet address from original transaction if not in callback
    let recipientWallet = wallet_address;

    // Store in database with KES-specific fields
    try {
      const db = await getDatabase();

      // Get missing data from original transaction
      let originalAmount = amount;
      if (!recipientWallet || !originalAmount) {
        if (transaction_code) {
          const originalTx = await db
            .collection("kes_transactions")
            .findOne({ transaction_code });
          if (!recipientWallet) recipientWallet = originalTx?.wallet_address;
          if (!originalAmount) originalAmount = originalTx?.amount;
        }
      }

      await db.collection("kes_transactions").updateOne(
        { transaction_key: transactionKey },
        {
          $set: {
            shortcode,
            amount,
            mobile_network,
            phone_number,
            status: status?.toUpperCase() || "PENDING",
            receipt_number,
            transaction_id,
            transaction_code,
            reference,
            message,
            public_name,
            wallet_address: recipientWallet,
            failure_reason: status?.toUpperCase() === "FAILED" ? message : null,
            updated_at: new Date(),
            callback_received_at: new Date(),
            raw_callback_data: body,
          },
          $setOnInsert: {
            created_at: new Date(),
          },
        },
        { upsert: true }
      );

      console.log("💾 Transaction saved:", transactionKey);

      // Handle successful payment - enqueue USDC disbursement
      if (
        status?.toUpperCase() === "SUCCESS" ||
        status?.toUpperCase() === "COMPLETED" ||
        status?.toUpperCase() === "COMPLETE"
      ) {
        console.log(
          "💰 Payment successful, checking disbursement conditions..."
        );
        console.log("🔍 Disbursement check:", {
          recipientWallet,
          amount: originalAmount,
          transactionCode: transaction_code,
          receiptNumber: receipt_number,
        });

        if (recipientWallet && originalAmount) {
          // Check if disbursement already exists for this transaction
          const existingJob = await checkExistingJob(transactionKey);

          if (existingJob) {
            console.log(
              `ℹ️ Disbursement already exists for transaction: ${transactionKey}`
            );
            console.log(
              `   Job ID: ${existingJob._id}, Status: ${existingJob.status}`
            );

            // Update transaction with existing job info
            await db.collection("kes_transactions").updateOne(
              { transaction_key: transactionKey },
              {
                $set: {
                  disbursement_job_id: existingJob._id?.toString(),
                  disbursement_status: existingJob.status.toUpperCase(),
                  disbursement_tx_hash: existingJob.result?.transactionHash,
                  usdc_amount: existingJob.result?.usdcAmount,
                  disbursement_completed_at: existingJob.completedAt,
                  disbursement_failed_at: existingJob.failedAt,
                  disbursement_error: existingJob.error,
                },
              }
            );
          } else {
            // Enqueue new disbursement job
            try {
              console.log("🚀 Enqueueing USDC disbursement...");

              const jobId = await enqueueDisbursement(
                recipientWallet,
                parseFloat(originalAmount),
                transactionKey
              );

              console.log(`✅ Disbursement job enqueued: ${jobId}`);

              // Update transaction with job ID
              await db.collection("kes_transactions").updateOne(
                { transaction_key: transactionKey },
                {
                  $set: {
                    disbursement_job_id: jobId,
                    disbursement_status: "PENDING",
                    disbursement_queued_at: new Date(),
                  },
                }
              );

              // Emit event for real-time updates
              eventService.emit("disbursement_queued", {
                jobId,
                transactionKey,
                recipientAddress: recipientWallet,
                amountKES: originalAmount,
              });
            } catch (disbursementError) {
              console.error(
                "❌ Failed to enqueue disbursement:",
                disbursementError
              );

              // Update transaction with queueing failure
              await db.collection("kes_transactions").updateOne(
                { transaction_key: transactionKey },
                {
                  $set: {
                    disbursement_status: "QUEUE_FAILED",
                    disbursement_error:
                      disbursementError instanceof Error
                        ? disbursementError.message
                        : String(disbursementError),
                    disbursement_failed_at: new Date(),
                  },
                }
              );
            }
          }
        } else {
          console.warn("⚠️ Cannot disburse: missing wallet address or amount", {
            recipientWallet,
            amount: originalAmount,
          });
        }
      } else {
        console.log(
          "🔄 Status not eligible for disbursement:",
          status?.toUpperCase(),
          {
            fullStatus: status,
            transactionKey,
            message: message || "No message provided",
            allCallbackData: {
              status,
              phone_number,
              amount,
              mobile_network,
              receipt_number,
              message,
              public_name,
            },
          }
        );
      }

      // Emit real-time event
      eventService.emit("kes_transaction_update", {
        transaction_key: transactionKey,
        transaction_code,
        status: status?.toUpperCase() || "PENDING",
        amount,
        phone_number,
        wallet_address: recipientWallet,
      });
    } catch (dbError) {
      console.error("❌ Database error:", dbError);
      // Don't fail the callback if DB fails
    }

    return NextResponse.json(
      {
        success: true,
        message: "KES collect callback processed successfully",
        transaction_key: transactionKey,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ KES collect callback error:", error);
    return NextResponse.json(
      {
        error: "Invalid callback",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "KES collect callback endpoint is active",
    endpoint: "/api/onramp/scroll/status",
    method: "POST",
    expectedFields: [
      "shortcode",
      "amount",
      "mobile_network",
      "phone_number",
      "status",
      "transaction_id",
      "transaction_code",
      "receipt_number",
      "reference",
    ],
  });
}
