import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Payment callback received:", body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Callback failed" }, { status: 500 });
  }
}
