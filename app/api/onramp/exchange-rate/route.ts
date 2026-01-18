import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/services/logger';

const PRETIUM_BASE_URI = process.env.PRETIUM_BASE_URI;
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY;

export async function POST(request: NextRequest) {
  try {
    logger.info('Getting exchange rate', {
      component: 'onramp.exchangeRate',
      operation: 'request',
    });
    
    const body = await request.json();
    const { currency_code } = body;
    
    if (!currency_code) {
      logger.warn('Exchange rate missing currency', {
        component: 'onramp.exchangeRate',
        operation: 'validation',
      });
      return NextResponse.json({ error: 'Currency code is required' }, { status: 400 });
    }

    if (!PRETIUM_BASE_URI) {
      throw new Error('PRETIUM_BASE_URI environment variable is not set');
    }
    
    if (!PRETIUM_API_KEY) {
      throw new Error('PRETIUM_API_KEY environment variable is not set');
    }

    logger.info('Pretium config loaded', {
      component: 'onramp.exchangeRate',
      operation: 'config',
      additional: {
        baseURI: PRETIUM_BASE_URI || 'NOT_SET',
        apiKeyPresent: !!PRETIUM_API_KEY,
        apiKeyLength: PRETIUM_API_KEY ? PRETIUM_API_KEY.length : 0,
      },
    });

    const response = await fetch(`${PRETIUM_BASE_URI}/v1/exchange-rate`, {
      method: 'POST',
      headers: {
        'x-api-key': PRETIUM_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ currency_code })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    logger.info('Exchange rate retrieved successfully', {
      component: 'onramp.exchangeRate',
      operation: 'success',
      additional: { data },
    });
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    logger.error(error, {
      component: 'onramp.exchangeRate',
      operation: 'error',
    });
    
    return NextResponse.json({
      error: error.message || 'Failed to get exchange rate'
    }, { status: 500 });
  }
}
