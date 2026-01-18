import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { allocateOnrampDeposit } from '@/lib/services/onrampAllocation';
import { logger } from '@/lib/services/logger';

const transactionStore = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    logger.info('Onramp webhook received', {
      component: 'onramp.webhook',
      operation: 'request',
      additional: { body },
    });

    if (body.transaction_code) {
      transactionStore.set(body.transaction_code, { ...body, updated_at: new Date().toISOString() });
      
      const onrampCollection = await getCollection('onramp_deposits');
      const normalizedStatus =
        body.status === 'COMPLETE' || body.status === 'SUCCESS'
          ? 'COMPLETED'
          : body.status === 'FAILED' || body.status === 'CANCELLED'
            ? 'FAILED'
            : 'PENDING';
      const updateData: any = {
        status: normalizedStatus,
        updatedAt: new Date(),
        'provider.name': 'pretium',
        'provider.lastWebhookPayload': body,
        'provider.lastWebhookAt': new Date(),
      };

      if (body.receipt_number) updateData.receiptNumber = body.receipt_number;
      if (body.amount_in_usd) updateData.amountInUsd = body.amount_in_usd;
      if (body.transaction_hash || body.tx_hash) updateData.txHash = body.transaction_hash || body.tx_hash;

      await onrampCollection.updateOne(
        { transactionCode: body.transaction_code },
        {
          $set: updateData,
          $setOnInsert: {
            transactionCode: body.transaction_code,
            createdAt: new Date(),
          },
          $push: {
            'provider.webhookHistory': {
              $each: [{ receivedAt: new Date(), payload: body }],
              $slice: -20,
            },
          },
        },
        { upsert: true }
      );
      
      logger.info('Transaction status stored', {
        component: 'onramp.webhook',
        operation: 'db.update',
        additional: { transactionCode: body.transaction_code },
      });

      if (normalizedStatus === 'COMPLETED' && updateData.txHash) {
        const deposit = await onrampCollection.findOne({ transactionCode: body.transaction_code });
        if (deposit?.userAddress && deposit?.asset) {
          logger.info('Webhook triggering allocation', {
            component: 'onramp.webhook',
            operation: 'allocate',
            additional: { transactionCode: body.transaction_code },
          });
          await allocateOnrampDeposit({
            transactionCode: body.transaction_code,
            asset: deposit.asset,
            userAddress: deposit.userAddress,
            amountInUsd: body.amount_in_usd,
            amountFallback: deposit.amountInUsd || deposit.amount,
            txHash: updateData.txHash,
            providerPayload: body,
            source: 'webhook',
          });
        } else {
          logger.warn('Deposit missing required fields for allocation', {
            component: 'onramp.webhook',
            operation: 'allocate',
            additional: { transactionCode: body.transaction_code },
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    logger.error(error as Error, {
      component: 'onramp.webhook',
      operation: 'error',
    });
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
    logger.error(error as Error, {
      component: 'onramp.webhook',
      operation: 'db.fetch',
    });
  }
  
  return NextResponse.json({ success: false, message: 'No webhook received yet' });
}
