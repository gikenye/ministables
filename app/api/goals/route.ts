import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorAddress = searchParams.get('creatorAddress');
    
    if (!creatorAddress) {
      return NextResponse.json({ error: 'creatorAddress parameter required' }, { status: 400 });
    }
    
    const url = `${process.env.ALLOCATE_API_URL}/api/goals?creatorAddress=${creatorAddress}`;
    console.log('[goals] Calling:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const goals = await response.json();
    return NextResponse.json(goals);
  } catch (error) {
    console.error('[goals] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch user goals' 
    }, { status: 500 });
  }
}
