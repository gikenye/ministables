import { NextRequest, NextResponse } from 'next/server';

const PRETIUM_BASE_URI = process.env.PRETIUM_BASE_URI;
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY;

export async function POST(request: NextRequest) {
  try {
    console.log('📋 Getting transaction status - API route called');
    
    const body = await request.json();
    const { transaction_code, currency = 'KES' } = body;
    
    if (!transaction_code) {
      console.log('❌ Status check failed - No transaction code provided');
      return NextResponse.json({ error: 'Transaction code is required' }, { status: 400 });
    }

    if (!PRETIUM_BASE_URI) {
      throw new Error('PRETIUM_BASE_URI environment variable is not set');
    }
    
    if (!PRETIUM_API_KEY) {
      throw new Error('PRETIUM_API_KEY environment variable is not set');
    }

    console.log('🔧 Pretium Config:', {
      baseURI: PRETIUM_BASE_URI || 'NOT_SET',
      apiKeyPresent: !!PRETIUM_API_KEY,
      apiKeyLength: PRETIUM_API_KEY ? PRETIUM_API_KEY.length : 0
    });

    // Build status endpoint URL
    let endpoint = '/v1/status';
    if (currency && currency !== 'KES') {
      endpoint += `/${currency}`;
    }

    const response = await fetch(`${PRETIUM_BASE_URI}${endpoint}`, {
      method: 'POST',
      headers: {
        'x-api-key': PRETIUM_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transaction_code })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    console.log('✅ Transaction status retrieved successfully:', data);
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('❌ Status check error details:', {
      message: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({
      error: error.message || 'Failed to get transaction status'
    }, { status: 500 });
  }
}
