import { NextRequest, NextResponse } from "next/server";
import { usdcEventListener } from "@/lib/services/usdcEventListener";
import { getDatabase } from "@/lib/mongodb";
import { scroll } from "thirdweb/chains";
import { getTokensBySymbol } from "@/config/chainConfig";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "status":
        const status = usdcEventListener.getStatus();
        return NextResponse.json({
          success: true,
          status,
        });

      case "transfers":
        // Get recent USDC transfers
        const limit = parseInt(searchParams.get("limit") || "10");
        const db = await getDatabase();
        const transfers = await db
          .collection("usdc_transfers")
          .find({})
          .sort({ timestamp: -1 })
          .limit(limit)
          .toArray();

        return NextResponse.json({
          success: true,
          transfers: transfers.map((transfer) => ({
            ...transfer,
            _id: transfer._id.toString(),
          })),
        });

      default:
        const scrollTokens = getTokensBySymbol(scroll.id);
        const usdcToken = scrollTokens.USDC;
        const settlementAddress = process.env.USDC_SETTLEMENT_ADDRESS;

        return NextResponse.json({
          success: true,
          message: "USDC Event Listener API",
          configuration: {
            chain: scroll.name,
            token: {
              address: usdcToken?.address || "Not configured",
              symbol: "USDC",
              decimals: usdcToken?.decimals || 6,
            },
            settlement_address: settlementAddress || "Not configured",
          },
          endpoints: {
            "GET ?action=status": "Get listener status",
            "GET ?action=transfers&limit=10": "Get recent transfers",
            POST: "Control listener (start/stop)",
            PUT: "Process specific transaction",
          },
          listener_status: usdcEventListener.getStatus(),
        });
    }
  } catch (error) {
    console.error("USDC listener API error:", error);
    return NextResponse.json(
      {
        error: "API error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    switch (action) {
      case "start":
        await usdcEventListener.start();
        return NextResponse.json({
          success: true,
          message: "USDC Event Listener started",
          status: usdcEventListener.getStatus(),
        });

      case "stop":
        await usdcEventListener.stop();
        return NextResponse.json({
          success: true,
          message: "USDC Event Listener stopped",
          status: usdcEventListener.getStatus(),
        });

      case "restart":
        await usdcEventListener.stop();
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
        await usdcEventListener.start();
        return NextResponse.json({
          success: true,
          message: "USDC Event Listener restarted",
          status: usdcEventListener.getStatus(),
        });

      default:
        return NextResponse.json(
          {
            error: "Invalid action",
            message: "Valid actions are: start, stop, restart",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("USDC listener control error:", error);
    return NextResponse.json(
      {
        error: "Control error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { transaction_hash } = await request.json();

    if (!transaction_hash) {
      return NextResponse.json(
        {
          error: "Missing transaction_hash",
          message: "Please provide a transaction_hash to process",
        },
        { status: 400 }
      );
    }

    await usdcEventListener.processSpecificTransaction(transaction_hash);

    return NextResponse.json({
      success: true,
      message: `Transaction ${transaction_hash} processed successfully`,
    });
  } catch (error) {
    console.error("Transaction processing error:", error);
    return NextResponse.json(
      {
        error: "Processing error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
