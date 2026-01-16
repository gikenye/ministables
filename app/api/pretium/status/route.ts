import { NextRequest, NextResponse } from "next/server";

const PRETIUM_BASE_URI = process.env.PRETIUM_BASE_URI || "";
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transaction_code } = body || {};

    if (!transaction_code) {
      return NextResponse.json(
        { error: "transaction_code is required" },
        { status: 400 }
      );
    }

    if (!PRETIUM_BASE_URI || !PRETIUM_API_KEY) {
      return NextResponse.json(
        { error: "Pretium configuration missing" },
        { status: 500 }
      );
    }

    const response = await fetch(`${PRETIUM_BASE_URI}/v1/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": PRETIUM_API_KEY,
      },
      body: JSON.stringify({ transaction_code }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error || data?.message || "Status check failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Status check failed" },
      { status: 500 }
    );
  }
}
