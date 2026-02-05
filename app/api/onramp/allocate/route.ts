import { NextRequest, NextResponse } from 'next/server';
import {
  BackendApiClient,
  SUPPORTED_ASSETS,
  type SupportedAsset,
} from '@/lib/services/backendApiService';
import { logger } from '@/lib/services/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { asset, userAddress, amount, txHash, providerPayload } = body;

    if (!asset || !userAddress || !amount || !txHash) {
      return NextResponse.json(
        { error: 'Missing required fields: asset, userAddress, amount, txHash' },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.ALLOCATE_API_URL ||
      process.env.NEXT_PUBLIC_ALLOCATE_API_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(request.url).origin;
    if (
      !process.env.ALLOCATE_API_URL &&
      !process.env.NEXT_PUBLIC_ALLOCATE_API_URL &&
      !process.env.NEXT_PUBLIC_APP_URL
    ) {
      logger.warn('ALLOCATE_API_URL not configured; using request origin', {
        component: 'onramp.allocate',
        operation: 'config',
      });
    }

    const normalizedAsset = SUPPORTED_ASSETS.find(
      (supported) => supported.toLowerCase() === asset?.toLowerCase()
    );
    if (!normalizedAsset) {
      return NextResponse.json(
        { error: `Unsupported asset: ${asset}` },
        { status: 400 }
      );
    }

    logger.info('Calling allocation API via backendApiService', {
      component: 'onramp.allocate',
      operation: 'request',
      asset: normalizedAsset,
      userAddress,
      amount,
      txHash,
    });

    const client = new BackendApiClient(baseUrl);
    const data = await client.allocateDeposit({
      asset: normalizedAsset as SupportedAsset,
      userAddress,
      amount,
      txHash,
      providerPayload,
    });

    logger.info('Allocation successful', {
      component: 'onramp.allocate',
      operation: 'success',
      additional: { data },
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Allocation failed";
    logger.error(message, {
      component: 'onramp.allocate',
      operation: 'error',
    });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
