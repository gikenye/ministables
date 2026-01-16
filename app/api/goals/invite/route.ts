import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.ALLOCATE_API_URL || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metaGoalId, invitedAddress, inviterAddress } = body;

    if (!metaGoalId || !invitedAddress || !inviterAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_API_URL}/api/goals/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metaGoalId, invitedAddress, inviterAddress }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process invite" },
      { status: 500 }
    );
  }
}
