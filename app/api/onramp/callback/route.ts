import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Onramp callback received:', body);
    
    const {
      shortcode,
      amount,
      fee,
      mobile_network,
      chain,
      asset,
      address,
      status,
      transaction_code,
      message
    } = body;

    return NextResponse.json({
      success: true,
      message: 'Callback processed successfully'
    });
    
  } catch (error) {
    console.error('Callback processing error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process callback' },
      { status: 500 }
    );
  }
}