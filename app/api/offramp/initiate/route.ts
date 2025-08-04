import { NextRequest, NextResponse } from 'next/server';

const SWYPT_API_BASE = 'https://pool.swypt.io/api';
const SWYPT_API_KEY = process.env.SWYPT_API_KEY;
const SWYPT_API_SECRET = process.env.SWYPT_API_SECRET;

export async function POST(request: NextRequest) {
  try {
    console.log('💸 Initiating offramp - API route called');
    
    const body = await request.json();
    const { 
      chain, 
      hash, 
      partyB, 
      tokenAddress, 
      project = 'ministables'
    } = body;
    
    if (!chain || !hash || !partyB || !tokenAddress) {
      console.log('❌ Offramp failed - Missing required fields');
      return NextResponse.json({ 
        error: 'Chain, hash, partyB (phone number), and tokenAddress are required' 
      }, { status: 400 });
    }

    if (!SWYPT_API_KEY || !SWYPT_API_SECRET) {
      throw new Error('Swypt API credentials are not configured');
    }

    console.log('🔧 Swypt Offramp Request:', {
      chain,
      hash,
      partyB,
      tokenAddress,
      project
    });

    const response = await fetch(`${SWYPT_API_BASE}/swypt-order-offramp`, {
      method: 'POST',
      headers: {
        'x-api-key': SWYPT_API_KEY,
        'x-api-secret': SWYPT_API_SECRET,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chain,
        hash,
        partyB,
        tokenAddress,
        project
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
    }

    console.log('✅ Offramp initiated successfully:', data);
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('❌ Offramp initiation error:', {
      message: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({
      error: error.message || 'Failed to initiate offramp'
    }, { status: 500 });
  }
}
