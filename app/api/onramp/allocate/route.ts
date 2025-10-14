import { NextRequest, NextResponse } from 'next/server';

const ALLOCATE_API_URL = process.env.ALLOCATE_API_URL;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { asset, userAddress, amount, txHash } = body;

    if (!asset || !userAddress || !amount || !txHash) {
      return NextResponse.json(
        { error: 'Missing required fields: asset, userAddress, amount, txHash' },
        { status: 400 }
      );
    }

    if (!ALLOCATE_API_URL) {
      console.error('❌ ALLOCATE_API_URL not configured');
      return NextResponse.json(
        { error: 'Allocation service not configured' },
        { status: 500 }
      );
    }

    console.log('📦 Calling allocation API:', { asset, userAddress, amount, txHash });

    const response = await fetch(`${ALLOCATE_API_URL}/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset, userAddress, amount, txHash }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Allocation failed');
    }

    console.log('✅ Allocation successful:', data);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('❌ Allocation error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Allocation failed' },
      { status: 500 }
    );
  }
}
