import { NextRequest, NextResponse } from 'next/server';
import { getUserPositions } from '@/lib/utils/allocateApi';
import { UserPositions } from '@/lib/models/userPositions';
import { getCollection } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { userAddress } = await request.json();
    
    if (!userAddress) {
      return NextResponse.json({ error: 'userAddress required' }, { status: 400 });
    }
    
    const freshPositions = await getUserPositions(userAddress);
    
    const collection = await getCollection('userBalances');
    await collection.findOneAndUpdate(
      { userAddress },
      { $set: { data: freshPositions, lastUpdated: new Date() } },
      { upsert: true }
    );
    
    return NextResponse.json(freshPositions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to refresh user balances' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('userAddress');
    
    if (!address) {
      return NextResponse.json({ error: 'userAddress parameter required' }, { status: 400 });
    }
    
    const collection = await getCollection('userBalances');
    const stored = await collection.findOne<UserPositions>({ userAddress: address });
    
    if (stored) {
      return NextResponse.json(stored.data);
    }
    
    let positions;
    
    try {
      positions = await getUserPositions(address);
    } catch (apiError) {
      positions = {
        totalBalance: '0',
        positions: [],
        leaderboardRank: null,
        formattedLeaderboardScore: '0.00'
      };
    }
    
    await collection.findOneAndUpdate(
      { userAddress: address },
      { $set: { data: positions, lastUpdated: new Date() } },
      { upsert: true }
    );
    
    return NextResponse.json(positions);
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to fetch user balances'
    }, { status: 500 });
  }
}