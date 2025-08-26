import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle Farcaster webhook events
    console.log('Farcaster webhook received:', body);
    
    // You can add specific webhook handling logic here
    // For example, tracking user interactions, analytics, etc.
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'MiniLend webhook endpoint' });
}