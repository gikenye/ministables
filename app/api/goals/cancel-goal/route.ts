import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metaGoalId, userAddress, chainId } = body;

    if (!metaGoalId || !userAddress) {
      return NextResponse.json(
        { error: 'metaGoalId and userAddress are required' },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.ALLOCATE_API_URL ||
      process.env.NEXT_PUBLIC_ALLOCATE_API_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(request.url).origin;
    const url = `${baseUrl}/api/user-positions?action=cancel-goal`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);
    
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metaGoalId, userAddress, chainId }),
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
