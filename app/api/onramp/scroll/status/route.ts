import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { eventService } from "@/lib/services/eventService";

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

    // Store in database with KES-specific fields
    try {
      const db = await getDatabase();

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

      // Emit real-time event
      eventService.emit("kes_transaction_update", {
        transaction_key: transactionKey,
        transaction_code,
        status: status?.toUpperCase() || "PENDING",
        amount,
        phone_number,
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
