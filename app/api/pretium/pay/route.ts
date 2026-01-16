import { NextRequest, NextResponse } from "next/server";

const PRETIUM_BASE_URI = process.env.PRETIUM_BASE_URI || "";
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY || "";

const getCurrencyFromChain = (chain: string) => {
  const map: Record<string, string> = {
    celo: "KES",
    base: "USD",
    stellar: "USD",
  };
  return map[(chain || "").toLowerCase()] || "KES";
};

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

    const { transaction_hash, shortcode, amount, chain } = body || {};
    if (!transaction_hash || !shortcode || !amount) {
      return NextResponse.json(
        { error: "transaction_hash, shortcode, and amount are required" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (!PRETIUM_BASE_URI || !PRETIUM_API_KEY) {
      return NextResponse.json(
        { error: "Pretium configuration missing" },
        { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const normalizedChain = typeof chain === "string" ? chain.trim().toLowerCase() : "";
    const endpoint =
      normalizedChain && normalizedChain !== "celo"
        ? `/v1/pay/${getCurrencyFromChain(normalizedChain)}`
        : "/v1/pay";

    const response = await fetch(`${PRETIUM_BASE_URI}${endpoint}`, {
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

        const statusResponse = await fetch(`${PRETIUM_BASE_URI}/v1/status`, {
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
