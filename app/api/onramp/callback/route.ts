import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { parseUnits } from 'viem';

const transactionStore = new Map<string, any>();
const ALLOCATE_API_URL = process.env.ALLOCATE_API_URL;

console.log('🔧 Callback route loaded with ALLOCATE_API_URL:', ALLOCATE_API_URL);

const ASSET_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  cUSD: 18,
  CUSD: 18,
  cKES: 18,
  CKES: 18,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('📥 Onramp webhook received:', body);

    if (body.transaction_code) {
      transactionStore.set(body.transaction_code, { ...body, updated_at: new Date().toISOString() });
      
      const onrampCollection = await getCollection('onramp_deposits');
      const updateData: any = {
        status: body.status === 'COMPLETE' || body.status === 'SUCCESS' ? 'COMPLETED' : 
                body.status === 'FAILED' || body.status === 'CANCELLED' ? 'FAILED' : 'PENDING',
        updatedAt: new Date(),
      };

      if (body.receipt_number) updateData.receiptNumber = body.receipt_number;
      if (body.amount_in_usd) updateData.amountInUsd = body.amount_in_usd;
      if (body.transaction_hash || body.tx_hash) updateData.txHash = body.transaction_hash || body.tx_hash;

      await onrampCollection.updateOne(
        { transactionCode: body.transaction_code },
        { $set: updateData }
      );
      
      console.log('✅ Transaction status stored:', body.transaction_code);

      if (updateData.status === 'COMPLETED' && updateData.txHash && body.amount_in_usd) {
        const deposit = await onrampCollection.findOne({ transactionCode: body.transaction_code });
        if (deposit && ALLOCATE_API_URL) {
          const decimals = ASSET_DECIMALS[deposit.asset.toUpperCase()] || 18;
          const amountInWei = parseUnits(body.amount_in_usd, decimals).toString();
          const allocatePayload = {
            asset: deposit.asset.toUpperCase(),
            userAddress: deposit.userAddress,
            amount: amountInWei,
            txHash: updateData.txHash,
          };
          console.log('📦 Webhook calling allocation API:', allocatePayload);
          try {
            const allocateResponse = await fetch(`${ALLOCATE_API_URL}/allocate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(allocatePayload),
            });
            const allocateResult = await allocateResponse.json();
            console.log('✅ Webhook allocation response:', allocateResult);
            
            await onrampCollection.updateOne(
              { transactionCode: body.transaction_code },
              { $set: { allocation: allocateResult, updatedAt: new Date() } }
            );
          } catch (allocError: any) {
            console.error('❌ Webhook allocation failed:', allocError.message);
            await onrampCollection.updateOne(
              { transactionCode: body.transaction_code },
              { $set: { allocation: { success: false, error: allocError.message }, updatedAt: new Date() } }
            );
          }
        } else if (!ALLOCATE_API_URL) {
          console.log('⚠️ ALLOCATE_API_URL not configured');
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('❌ Onramp webhook error:', error);
    return NextResponse.json({ success: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const transaction_code = searchParams.get('transaction_code');
  
  if (!transaction_code) {
    return NextResponse.json({ error: 'Transaction code required' }, { status: 400 });
  }
  
  const status = transactionStore.get(transaction_code);
  if (status) return NextResponse.json({ success: true, data: status });

  try {
    const onrampCollection = await getCollection('onramp_deposits');
    const deposit = await onrampCollection.findOne({ transactionCode: transaction_code });
    if (deposit) return NextResponse.json({ success: true, data: deposit });
  } catch (error) {
    console.error('Error fetching from database:', error);
  }
  
  return NextResponse.json({ success: false, message: 'No webhook received yet' });
}
