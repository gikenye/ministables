import { NextRequest, NextResponse } from "next/server";
import { usdcEventListener } from "@/lib/services/usdcEventListener";

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