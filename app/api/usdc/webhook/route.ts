import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { eventService } from '@/lib/services/eventService';
import { scroll } from 'thirdweb/chains';
import { getTokensBySymbol } from '@/config/chainConfig';
import { createHmac } from 'crypto';
import { getWebhookBaseUrl } from '@/lib/utils';

// Constants from environment
const SETTLEMENT_ADDRESS = process.env.SETTLEMENT_ADDRESS?.toLowerCase();

if (!SETTLEMENT_ADDRESS) {
  throw new Error("SETTLEMENT_ADDRESS environment variable is required");
}

const scrollTokens: ReturnType<typeof getTokensBySymbol> = getTokensBySymbol(scroll.id);
const USDC_TOKEN = scrollTokens.USDC;
if (!USDC_TOKEN) {
  throw new Error("USDC token not found in Scroll chain configuration");
}
const USDC_ADDRESS = USDC_TOKEN.address.toLowerCase();

interface ThirdwebWebhookPayload {
  eventType: string;
  data: {
    eventName: string;
    contractAddress: string;
    transactionHash: string;
    blockNumber: number;
    args: any; // More flexible args handling
    timestamp: string;
    network: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    let payload: ThirdwebWebhookPayload;
    
    // Verify webhook authenticity (optional but recommended)
    const webhookSecret = process.env.THIRDWEB_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get("x-thirdweb-signature");
      if (signature) {
        const body = await request.text();
        if (!webhookSecret) {
          console.error('THIRDWEB_WEBHOOK_SECRET not configured');
          return NextResponse.json({ error: 'Webhook authentication failed' }, { status: 401 });
        }
        
        const expectedSignature = generateWebhookSignature(body, webhookSecret);
        
        if (signature !== expectedSignature) {
          console.error('Invalid webhook signature');
          return NextResponse.json({ 
            error: 'Invalid signature' 
          }, { status: 401 });
        }
        
        // Parse the body that we already read for signature verification
        payload = JSON.parse(body);
      } else {
        console.error('Missing webhook signature');
        return NextResponse.json({ 
          error: 'Missing signature' 
        }, { status: 401 });
      }
    } else {
      // If no webhook secret is configured, read the body normally
      payload = await request.json();
    }

    console.log("Thirdweb webhook received:", payload);

    // Validate this is a USDC Transfer event to our settlement address
    if (
      payload.data.eventName !== "Transfer" ||
      payload.data.contractAddress.toLowerCase() !== USDC_ADDRESS ||
      payload.data.args.to.toLowerCase() !== SETTLEMENT_ADDRESS
    ) {
      return NextResponse.json({
        success: true,
        message: "Event ignored - not a USDC transfer to settlement address",
      });
    }

    const { transactionHash, blockNumber, args, timestamp } = payload.data;

    // Extract transfer details (handle different event arg formats)
    const fromAddress = args?.from || args?.[0];
    const toAddress = args?.to || args?.[1];
    const value = args?.value || args?.[2];

    const amountRaw = value;
    const amountUSDC = Number(amountRaw) / Math.pow(10, USDC_TOKEN.decimals); // Use decimals from config

    console.log(`USDC deposit detected via webhook:`, {
      from: fromAddress,
      to: toAddress,
      amount: amountUSDC,
      txHash: transactionHash,
      block: blockNumber,
    });

    // Store in database
    const db = await getDatabase();
    const transferData = {
      transaction_hash: transactionHash,
      from_address: fromAddress.toLowerCase(),
      to_address: toAddress.toLowerCase(),
      amount_usdc: amountUSDC,
      amount_raw: amountRaw,
      block_number: blockNumber,
      timestamp: new Date(timestamp),
      processed: false,
      webhook_received_at: new Date(),
    };

    // Upsert to avoid duplicates
    await db.collection("usdc_transfers").updateOne(
      { transaction_hash: transactionHash },
      {
        $set: transferData,
        $setOnInsert: { created_at: new Date() },
      },
      { upsert: true }
    );

    // Emit event for real-time updates
    eventService.emit("usdc_deposit_detected", {
      transaction_hash: transactionHash,
      from_address: fromAddress,
      amount_usdc: amountUSDC,
      amount_raw: amountRaw,
      block_number: blockNumber,
      source: "webhook",
    });

    // Trigger KES disbursement processing
    await triggerDisbursement(transferData);

    return NextResponse.json({
      success: true,
      message: "USDC transfer processed successfully",
      transaction_hash: transactionHash,
      amount_usdc: amountUSDC,
    });
  } catch (error) {
    console.error("USDC webhook processing error:", error);
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function triggerDisbursement(transfer: any) {
  try {
    // Look up recipient mapping for the sender address
    const db = await getDatabase();
    const mapping = await db.collection("recipient_mappings").findOne({
      usdc_sender_address: transfer.from_address,
      active: true,
    });

    if (!mapping) {
      throw new Error(
        `No active recipient mapping found for address: ${transfer.from_address}`
      );
    }

    // Check amount limits if configured
    if (mapping.min_amount && transfer.amount_usdc < mapping.min_amount) {
      throw new Error(
        `Amount ${transfer.amount_usdc} is below minimum ${mapping.min_amount} USDC`
      );
    }

    if (mapping.max_amount && transfer.amount_usdc > mapping.max_amount) {
      throw new Error(
        `Amount ${transfer.amount_usdc} exceeds maximum ${mapping.max_amount} USDC`
      );
    }

    // Calculate KES amount (you may want to implement dynamic exchange rates)
    const usdcToKesRate = mapping.conversion_rate || 130; // Default rate, should be fetched from an API
    const kesAmount = Math.floor(transfer.amount_usdc * usdcToKesRate);

    const disbursementPayload = {
      amount: kesAmount.toString(),
      shortcode: mapping.shortcode || "600000",
      account_number:
        mapping.type === "MOBILE"
          ? mapping.recipient_phone
          : mapping.account_number || mapping.recipient_phone,
      type: mapping.type,
      mobile_network: mapping.recipient_network,
      callback_url: `${getWebhookBaseUrl()}/api/pretium/callback/kes/log-disburse`,
    };

    console.log("Triggering KES disbursement for USDC deposit:", {
      usdc_tx: transfer.transaction_hash,
      disbursement: disbursementPayload,
    });

    // Call the disbursement API
    const response = await fetch(
      `${getWebhookBaseUrl()}/api/pretium/kes/disburse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(disbursementPayload),
      }
    );

    const result = await response.json();

    if (response.ok) {
      console.log("Disbursement triggered successfully:", result);

      // Update database to mark as processed
      const db = await getDatabase();
      await db.collection("usdc_transfers").updateOne(
        { transaction_hash: transfer.transaction_hash },
        {
          $set: {
            processed: true,
            disbursement_transaction_code: result.data?.transaction_code,
            disbursement_triggered_at: new Date(),
            updated_at: new Date(),
          },
        }
      );

      // Emit success event
      eventService.emit("usdc_disbursement_triggered", {
        usdc_transaction: transfer.transaction_hash,
        disbursement_code: result.data?.transaction_code,
        amount_usdc: transfer.amount_usdc,
      });

      // Send notification
      eventService.emit("notification", {
        type: "success",
        message: `USDC ${transfer.amount_usdc} deposit processed and KES disbursement initiated`,
        transaction_hash: transfer.transaction_hash,
        disbursement_code: result.data?.transaction_code,
      });
    } else {
      throw new Error(`Disbursement API error: ${result.message}`);
    }
  } catch (error) {
    console.error("Error triggering disbursement:", error);

    // Update database with disbursement error
    try {
      const db = await getDatabase();
      await db.collection("usdc_transfers").updateOne(
        { transaction_hash: transfer.transaction_hash },
        {
          $set: {
            processing_error: `Disbursement failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            updated_at: new Date(),
          },
        }
      );
    } catch (dbError) {
      console.error(
        "Error updating database with disbursement error:",
        dbError
      );
    }

    // Emit error event
    eventService.emit("usdc_disbursement_error", {
      usdc_transaction: transfer.transaction_hash,
      error: error instanceof Error ? error.message : "Unknown error",
      amount_usdc: transfer.amount_usdc,
    });

    // Send error notification
    eventService.emit("notification", {
      type: "error",
      message: `USDC deposit detected but KES disbursement failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      transaction_hash: transfer.transaction_hash,
    });
  }
}

// Handle GET requests for webhook endpoint info
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "USDC webhook endpoint is active",
    endpoint: "/api/usdc/webhook",
    method: "POST",
    settlement_address: SETTLEMENT_ADDRESS,
    token: {
      address: USDC_ADDRESS,
      symbol: "USDC",
      decimals: USDC_TOKEN.decimals,
    },
    chain: scroll.name,
    expectedPayload: {
      eventType: "contract_event",
      data: {
        eventName: "Transfer",
        contractAddress: USDC_ADDRESS,
        transactionHash: "string",
        blockNumber: "number",
        args: {
          from: "string",
          to: "string (must match settlement address)",
          value: "string",
        },
        timestamp: "string",
        network: "scroll",
      },
    },
  });
}

/**
 * Generate webhook signature using HMAC-SHA256
 */
function generateWebhookSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}
