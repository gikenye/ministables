import { NextRequest, NextResponse } from 'next/server';

const SWYPT_API_BASE = 'https://pool.swypt.io/api';
const SWYPT_API_KEY = process.env.SWYPT_API_KEY;
const SWYPT_API_SECRET = process.env.SWYPT_API_SECRET;

export async function POST(request: NextRequest) {
  try {
    console.log('💰 Getting offramp quote - API route called');
    
    const body = await request.json();
    const { 
      amount, 
      fiatCurrency = 'KES', 
      cryptoCurrency = 'USDT', 
      network = 'celo',
      category = 'B2C'
    } = body;
    
    if (!amount || !fiatCurrency || !cryptoCurrency || !network) {
      console.log('❌ Quote failed - Missing required fields');
      return NextResponse.json({ 
        error: 'Amount, fiatCurrency, cryptoCurrency, and network are required' 
      }, { status: 400 });
    }

    if (!SWYPT_API_KEY || !SWYPT_API_SECRET) {
      throw new Error('Swypt API credentials are not configured');
    }

    console.log('🔧 Swypt Quote Request:', {
      amount,
      fiatCurrency,
      cryptoCurrency,
      network,
      category
    });

    const response = await fetch(`${SWYPT_API_BASE}/swypt-quotes`, {
      method: 'POST',
      headers: {
        'x-api-key': SWYPT_API_KEY,
        'x-api-secret': SWYPT_API_SECRET,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'offramp',
        amount,
        fiatCurrency,
        cryptoCurrency,
        network,
        category
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
    }

    console.log('✅ Quote retrieved successfully:', data);
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('❌ Quote retrieval error:', {
      message: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({
      error: error.message || 'Failed to get offramp quote'
    }, { status: 500 });
  }
}
