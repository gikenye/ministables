import { NextRequest, NextResponse } from "next/server";

const PRETIUM_BASE_URL = process.env.PRETIUM_BASE_URI || "";
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, shortcode, mobile_network, currency_code } = body;

    const url = currency_code !== "KES" 
      ? `${PRETIUM_BASE_URL}/v1/validation/${currency_code}`
      : `${PRETIUM_BASE_URL}/v1/validation`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": PRETIUM_API_KEY,
      },
      body: JSON.stringify({ type, shortcode, mobile_network }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
