import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getUserPositions } from '@/lib/utils/allocateApi';
import { UserPositions } from '@/lib/models/userPositions';
import { getCollection } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { address, chainId } = await request.json();
    const collection = await getCollection('userBalances');
    
    const positions = await getUserPositions(address, chainId);
    
    await collection.findOneAndUpdate(
      { userAddress: address },
      { $set: { data: positions, lastUpdated: new Date() } },
      { upsert: true }
    );
    
    return NextResponse.json({ success: true, data: positions });
  } catch (error) {
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chainIdParam = searchParams.get('chainId');
    const chainId = chainIdParam ? Number(chainIdParam) : undefined;
    
    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }
    
    const collection = await getCollection('userBalances');
    const cached = await collection.findOne<UserPositions>({ userAddress: address });
    
    if (cached && (Date.now() - cached.lastUpdated.getTime()) < 5 * 60 * 1000) {
      return NextResponse.json(cached.data);
    }
    
    const positions = await getUserPositions(address, chainId);
    
    await collection.findOneAndUpdate(
      { userAddress: address },
      { $set: { data: positions, lastUpdated: new Date() } },
      { upsert: true }
    );
    
    return NextResponse.json(positions);
  } catch (error) {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}
