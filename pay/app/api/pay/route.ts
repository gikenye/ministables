import { NextRequest, NextResponse } from "next/server";

const PRETIUM_BASE_URL = process.env.PRETIUM_BASE_URI || "";
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY || "";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(`${PRETIUM_BASE_URL}/v1/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": PRETIUM_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // If the response has a transaction_code, poll for completion
    if (data.transaction_code) {
      let statusData = data;
      const startTime = Date.now();
      const timeout = 60 * 1000; // 1 minutes

      while ((statusData.status === 'PENDING' || !statusData.status) && (Date.now() - startTime) < timeout) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        const statusResponse = await fetch(`${PRETIUM_BASE_URL}/v1/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": PRETIUM_API_KEY,
          },
          body: JSON.stringify({ transaction_code: data.transaction_code }),
        });

        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status}`);
        }

        statusData = await statusResponse.json();
      }

      // Return the final status data with receipts and transaction code
      return NextResponse.json(statusData, {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
    } else {
      // If no transaction_code, return the initial response
      return NextResponse.json(data, {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  } catch (error) {
    return NextResponse.json({ error: "Payment failed" }, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
