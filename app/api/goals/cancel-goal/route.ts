import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { metaGoalId, userAddress } = await request.json();

    if (!metaGoalId || !userAddress) {
      return NextResponse.json(
        { error: 'metaGoalId and userAddress are required' },
        { status: 400 }
      );
    }

    const url = `${process.env.ALLOCATE_API_URL}/api/user-positions?action=cancel-goal`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);
    
    console.log("Meta Goal ID:", metaGoalId, "User Address:", userAddress);
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metaGoalId, userAddress }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[cancel-goal] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel goal' },
      { status: 500 }
    );
  }
}
