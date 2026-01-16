import { NextRequest, NextResponse } from 'next/server';

const SWYPT_API_BASE = 'https://pool.swypt.io/api';
const SWYPT_API_KEY = process.env.SWYPT_API_KEY;
const SWYPT_API_SECRET = process.env.SWYPT_API_SECRET;

export async function POST(request: NextRequest) {
  try {
    console.log('📊 Checking offramp status - API route called');
    
    const body = await request.json();
    const { orderID } = body;
    
    if (!orderID) {
      console.log('❌ Status check failed - Missing orderID');
      return NextResponse.json({ 
        error: 'OrderID is required' 
      }, { status: 400 });
    }

    if (!SWYPT_API_KEY || !SWYPT_API_SECRET) {
      throw new Error('Swypt API credentials are not configured');
    }

    console.log('🔧 Swypt Status Check Request:', { orderID });

    const response = await fetch(`${SWYPT_API_BASE}/order-offramp-status/${orderID}`, {
      method: 'GET',
      headers: {
        'x-api-key': SWYPT_API_KEY,
        'x-api-secret': SWYPT_API_SECRET,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
    }

    console.log('✅ Status retrieved successfully:', data);
    return NextResponse.json({ success: true, data });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check offramp status";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('❌ Status check error:', {
      message,
      stack
    });
    
    return NextResponse.json({
      error: message
    }, { status: 500 });
  }
}
