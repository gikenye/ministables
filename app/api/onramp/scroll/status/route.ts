import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { eventService } from "@/lib/services/eventService";
import { disburseuSDC } from "@/lib/services/disbursementService";

export async function POST(request: NextRequest) {
  try {
    console.log("📞 KES callback received");

    const body = await request.json();

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

    // Get wallet address from original transaction if not in callback
    let recipientWallet = wallet_address;
    
    // Store in database with KES-specific fields
    try {
      const db = await getDatabase();
      
      // Get missing data from original transaction
      let originalAmount = amount;
      if (!recipientWallet || !originalAmount) {
        if (transaction_code) {
          const originalTx = await db.collection("kes_transactions").findOne({ transaction_code });
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
      
      // Handle successful payment - disburse USDC
      if (status?.toUpperCase() === "SUCCESS" || status?.toUpperCase() === "COMPLETED" || status?.toUpperCase() === "COMPLETE") {
        console.log("💰 Payment successful, checking disbursement conditions...");
        console.log("🔍 Disbursement check:", { recipientWallet, amount: originalAmount });
        
        if (recipientWallet && originalAmount) {
          try {
            console.log("🚀 Initiating USDC disbursement...");
            const disbursementResult = await disburseuSDC(recipientWallet, originalAmount);
            
            // Update transaction with disbursement info
            await db.collection("kes_transactions").updateOne(
              { transaction_key: transactionKey },
              {
                $set: {
                  disbursement_status: "SUCCESS",
                  disbursement_tx_hash: disbursementResult.transactionHash,
                  usdc_amount: disbursementResult.usdcAmount,
                  disbursement_completed_at: new Date()
                }
              }
            );
            
            console.log("✅ USDC disbursement completed:", disbursementResult.transactionHash);
            
          } catch (disbursementError) {
            console.error("❌ USDC disbursement failed:", disbursementError);
            
            // Update transaction with disbursement failure
            await db.collection("kes_transactions").updateOne(
              { transaction_key: transactionKey },
              {
                $set: {
                  disbursement_status: "FAILED",
                  disbursement_error: disbursementError instanceof Error ? disbursementError.message : String(disbursementError),
                  disbursement_failed_at: new Date()
                }
              }
            );
          }
        } else {
          console.warn("⚠️ Cannot disburse: missing wallet address or amount", { recipientWallet, amount: originalAmount });
        }
      } else {
        console.log("🔄 Status not eligible for disbursement:", status?.toUpperCase());
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
