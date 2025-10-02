import { NextRequest, NextResponse } from 'next/server';
import { getWebhookBaseUrl } from '@/lib/utils';

const PRETIUM_BASE_URI = process.env.PRETIUM_BASE_URI;
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY;

export async function POST(request: NextRequest) {
  try {
    console.log('💳 Initiating onramp - API route called');
    
    const body = await request.json();
    const { 
      shortcode, 
      amount, 
      fee, 
      mobile_network, 
      chain, 
      asset, 
      address, 
      callback_url,
      currency_code = 'KES'
    } = body;
    
    if (!shortcode || !amount || !mobile_network || !chain || !asset || !address) {
      console.log('❌ Onramp failed - Missing required fields');
      return NextResponse.json({ 
        error: 'Shortcode, amount, mobile_network, chain, asset, and address are required' 
      }, { status: 400 });
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

    // Build onramp endpoint URL
    const endpoint = `/v1/onramp/${currency_code}`;

    const requestBody = {
      shortcode,
      amount,
      fee,
      mobile_network,
      chain,
      asset,
      address,
      callback_url: callback_url || `${getWebhookBaseUrl()}/api/onramp/callback`
    };

    console.log('📤 Onramp request payload:', requestBody);

    const response = await fetch(`${PRETIUM_BASE_URI}${endpoint}`, {
      method: 'POST',
      headers: {
        'x-api-key': PRETIUM_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    console.log('✅ Onramp initiated successfully:', data);
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('❌ Onramp initiation error details:', {
      message: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({
      error: error.message || 'Failed to initiate onramp'
    }, { status: 500 });
  }
}
