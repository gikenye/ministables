import { NextRequest, NextResponse } from "next/server";

const KES_COLLECT = process.env.KES_COLLECT;
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY;

export async function POST(request: NextRequest) {
  try {
    console.log("💳 Initiating onramp - API route called");

    const body = await request.json();
    const {
      shortcode,
      amount,
      mobile_network = "Safaricom",
      callback_url,
    } = body;

    if (!shortcode || !amount || !mobile_network || !callback_url) {
      console.log("❌ KES collection failed - Missing required fields");
      return NextResponse.json(
        {
          error: "Shortcode, amount, mobile_network, are required",
        },
        { status: 400 }
      );
    }

    if (!KES_COLLECT) {
      throw new Error("KES_COLLECT environment variable is not set");
    }

    if (!PRETIUM_API_KEY) {
      throw new Error("PRETIUM_API_KEY environment variable is not set");
    }

    console.log("🔧 Fiat Collection Config:", {
      baseURI: KES_COLLECT || "NOT_SET",
      apiKeyPresent: !!PRETIUM_API_KEY,
      apiKeyLength: PRETIUM_API_KEY ? PRETIUM_API_KEY.length : 0,
    });

    const requestBody = {
      shortcode,
      amount,
      mobile_network,
      callback_url,
    };

    console.log("📤 Onramp request payload:", requestBody);

    const fullUrl = `${KES_COLLECT}`;
    console.log("🌐 Making request to:", fullUrl);

    let response;
    try {
      response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "x-api-key": PRETIUM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        // 30 second timeout handled by Next.js
      });
    } catch (fetchError) {
      console.error("🚫 Network/Fetch error:", {
        message:
          fetchError instanceof Error ? fetchError.message : String(fetchError),
        url: fullUrl,
        cause: fetchError instanceof Error ? fetchError.cause : undefined,
      });
      throw new Error(
        `Network error: Unable to reach API at ${fullUrl}. ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
      );
    }

    const responseText = await response.text();
    console.log("📥 Raw API response:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body:
        responseText.substring(0, 500) +
        (responseText.length > 500 ? "..." : ""),
    });

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Failed to parse API response as JSON:", {
        responseText: responseText.substring(0, 1000),
        parseError:
          parseError instanceof Error ? parseError.message : String(parseError),
      });
      throw new Error(
        `API returned non-JSON response: ${response.status} ${response.statusText}`
      );
    }

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    console.log("✅ fiat collection initiated successfully:", data);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("❌ fiat collection initiation error details:", {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        error: error.message || "Failed to initiate onramp",
      },
      { status: 500 }
    );
  }
}
