import { NextRequest, NextResponse } from 'next/server';

interface DisburseRequest {
  amount: string;
  shortcode: string;
  account_number: string;
  type: 'MOBILE' | 'BUY_GOODS' | 'PAYBILL';
  mobile_network: string;
  callback_url: string;
}

interface DisburseResponse {
  code: number;
  message: string;
  data: {
    transaction_code: string;
    status: string;
    message: string;
    receipt_number: string | null;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: DisburseRequest = await request.json();
    
    // Validate required fields
    const { amount, shortcode, account_number, type, mobile_network, callback_url } = body;
    
    if (!amount || !shortcode || !account_number || !type || !mobile_network || !callback_url) {
      return NextResponse.json(
        {
          code: 400,
          message: 'Missing required fields',
          data: null
        },
        { status: 400 }
      );
    }

    // Validate type
    if (!['MOBILE', 'BUY_GOODS', 'PAYBILL'].includes(type)) {
      return NextResponse.json(
        {
          code: 400,
          message: 'Invalid type. Must be MOBILE, BUY_GOODS, or PAYBILL',
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
    const response = await fetch(`${pretiumBaseUri}/kes/disburse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pretiumApiKey}`,
        'X-API-Key': pretiumApiKey,
      },
      body: JSON.stringify({
        amount,
        shortcode,
        account_number,
        type,
        mobile_network,
        callback_url
      }),
    });

    const data: DisburseResponse = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          code: response.status,
          message: data.message || 'Disbursement request failed',
          data: data.data || null
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Disbursement error:', error);
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