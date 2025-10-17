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
    const { currency_code } = body;

    const response = await fetch(`${PRETIUM_BASE_URL}/v1/exchange-rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": PRETIUM_API_KEY,
      },
      body: JSON.stringify({ currency_code }),
    });

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch exchange rate" }, { 
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
