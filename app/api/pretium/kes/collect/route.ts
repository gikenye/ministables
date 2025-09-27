import { NextRequest, NextResponse } from 'next/server';

interface CollectRequest {
  shortcode: string;
  amount: number;
  mobile_network: string;
  callback_url: string;
}

interface CollectResponse {
  code: number;
  message: string;
  data: {
    transaction_code: string;
    status: string;
    message: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: CollectRequest = await request.json();
    
    // Validate required fields
    const { shortcode, amount, mobile_network, callback_url } = body;
    
    if (!shortcode || !amount || !mobile_network || !callback_url) {
      return NextResponse.json(
        {
          code: 400,
          message: 'Missing required fields',
          data: null
        },
        { status: 400 }
      );
    }

    // Validate amount is a positive number
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        {
          code: 400,
          message: 'Amount must be a positive number',
          data: null
        },
        { status: 400 }
      );
    }

    const pretiumBaseUri = process.env.PRETIUM_BASE_URI;
    const pretiumApiKey = process.env.PRETIUM_API_KEY;

    if (!pretiumBaseUri || !pretiumApiKey) {
      return NextResponse.json(
        {
          code: 500,
          message: 'Pretium configuration missing',
          data: null
        },
        { status: 500 }
      );
    }

    // Make request to Pretium API
    const response = await fetch(`${pretiumBaseUri}/kes/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pretiumApiKey}`,
        'X-API-Key': pretiumApiKey,
      },
      body: JSON.stringify({
        shortcode,
        amount,
        mobile_network,
        callback_url
      }),
    });

    const data: CollectResponse = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          code: response.status,
          message: data.message || 'Collection request failed',
          data: data.data || null
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Collection error:', error);
    return NextResponse.json(
      {
        code: 500,
        message: 'Internal server error',
        data: null
      },
      { status: 500 }
    );
  }
}