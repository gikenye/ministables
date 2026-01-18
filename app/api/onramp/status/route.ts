import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { logger } from '@/lib/services/logger';

const PRETIUM_BASE_URI = process.env.PRETIUM_BASE_URI;
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY;

export async function POST(request: NextRequest) {
  try {
    logger.info('Getting transaction status', {
      component: 'onramp.status',
      operation: 'request',
    });
    
    const body = await request.json();
    const { transaction_code, currency = 'KES' } = body;
    
    if (!transaction_code) {
      logger.warn('Status check missing transaction code', {
        component: 'onramp.status',
        operation: 'validation',
      });
      return NextResponse.json({ error: 'Transaction code is required' }, { status: 400 });
    }

    if (!PRETIUM_BASE_URI) {
      throw new Error('PRETIUM_BASE_URI environment variable is not set');
    }
    
    if (!PRETIUM_API_KEY) {
      throw new Error('PRETIUM_API_KEY environment variable is not set');
    }

    logger.info('Pretium config loaded', {
      component: 'onramp.status',
      operation: 'config',
      additional: {
        baseURI: PRETIUM_BASE_URI || 'NOT_SET',
        apiKeyPresent: !!PRETIUM_API_KEY,
        apiKeyLength: PRETIUM_API_KEY ? PRETIUM_API_KEY.length : 0,
      },
    });

    // Build status endpoint URL
    let endpoint = '/v1/status';
    if (currency && currency !== 'KES') {
      endpoint += `/${currency}`;
    }

    const response = await fetch(`${PRETIUM_BASE_URI}${endpoint}`, {
      method: 'POST',
      headers: {
        'x-api-key': PRETIUM_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transaction_code })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    logger.info('Transaction status retrieved', {
      component: 'onramp.status',
      operation: 'success',
      additional: { data },
    });

    try {
      const onrampCollection = await getCollection('onramp_deposits');
      await onrampCollection.updateOne(
        { transactionCode: transaction_code },
        {
          $set: {
            'provider.name': 'pretium',
            'provider.lastStatusPayload': data,
            'provider.lastStatusAt': new Date(),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            transactionCode: transaction_code,
            createdAt: new Date(),
          },
          $push: {
            'provider.statusHistory': {
              $each: [{ receivedAt: new Date(), payload: data }],
              $slice: -20,
            },
          },
        },
        { upsert: true }
      );
    } catch (dbError) {
      logger.error(dbError as Error, {
        component: 'onramp.status',
        operation: 'db.persist',
      });
    }
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    logger.error(error, {
      component: 'onramp.status',
      operation: 'error',
    });
    
    return NextResponse.json({
      error: error.message || 'Failed to get transaction status'
    }, { status: 500 });
  }
}
