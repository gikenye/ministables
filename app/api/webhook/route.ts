import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Get the raw text first to handle empty bodies
    const rawBody = await request.text();

    // Check if body is empty
    if (!rawBody || rawBody.trim() === "") {
      console.log("Webhook received empty body");
      return NextResponse.json(
        {
          success: false,
          error: "Empty request body",
        },
        { status: 400 }
      );
    }

    // Try to parse JSON
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("Invalid JSON in webhook:", {
        error: parseError,
        rawBody:
          rawBody.substring(0, 500) + (rawBody.length > 500 ? "..." : ""),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON format",
        },
        { status: 400 }
      );
    }

    // Validate that body is an object
    if (typeof body !== "object" || body === null) {
      console.error("Webhook body is not an object:", { body });
      return NextResponse.json(
        {
          success: false,
          error: "Request body must be a JSON object",
        },
        { status: 400 }
      );
    }

    // Handle Farcaster webhook events
    console.log("Farcaster webhook received:", {
      type: body.type || "unknown",
      timestamp: new Date().toISOString(),
      bodyKeys: Object.keys(body),
    });

    // You can add specific webhook handling logic here
    // For example, tracking user interactions, analytics, etc.

    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully",
      received_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Webhook processing error:", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      {
        success: false,
        error: "Internal webhook processing error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Minilend webhook endpoint",
    status: "active",
    timestamp: new Date().toISOString(),
    methods: ["GET", "POST"],
    expected_content_type: "application/json",
    notes: "POST requests must contain valid JSON body",
  });
}
