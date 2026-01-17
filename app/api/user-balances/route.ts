import { NextRequest, NextResponse } from 'next/server';
import { getUserPositions } from '@/lib/utils/allocateApi';
import { UserPositions } from '@/lib/models/userPositions';
import { getCollection } from '@/lib/mongodb';

// Helper function to fetch and update user positions
async function updateUserPositions(address: string, targetGoalId?: string | null) {
  try {
    const url = targetGoalId 
      ? `${process.env.ALLOCATE_API_URL}/api/user-positions?userAddress=${address}&targetGoalId=${targetGoalId}`
      : `${process.env.ALLOCATE_API_URL}/api/user-positions?userAddress=${address}`;
    
    console.log('[user-balances] Calling:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const positions = await response.json();
    
    // Update database
    const collection = await getCollection('userBalances');
    await collection.findOneAndUpdate(
      { userAddress: address },
      { $set: { data: positions, lastUpdated: new Date() } },
      { upsert: true }
    );
    
    return positions;
  } catch (apiError) {
    console.error('[user-balances] API call failed:', {
      url,
      error: apiError instanceof Error ? apiError.message : apiError,
      stack: apiError instanceof Error ? apiError.stack : undefined
    });
    return {
      totalBalance: '0',
      positions: [],
      leaderboardRank: null,
      formattedLeaderboardScore: '0.00'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'allocate') {
      const body = await request.json();
      console.log('[user-balances POST] Allocate request:', body);
      
      try {
        const response = await fetch(`${process.env.ALLOCATE_API_URL}/api/user-positions?action=allocate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `API responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        return NextResponse.json(data);
      } catch (error) {
        console.error('[user-balances POST] Allocate error:', error);
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'Failed to allocate deposit' 
        }, { status: 500 });
      }
    }
    
    if (action === 'create-goal' || action === 'create-group-goal') {
      const body = await request.json();
      console.log(`[user-balances POST] Creating ${action}:`, body);
      
      try {
        const response = await fetch(`${process.env.ALLOCATE_API_URL}/api/user-positions?action=${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `API responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        return NextResponse.json(data);
      } catch (error) {
        console.error(`[user-balances POST] ${action} error:`, error);
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : `Failed to ${action}` 
        }, { status: 500 });
      }
    }

    if (action === 'group-goal-members' || action === 'group-goal-details') {
      const body = await request.json();
      console.log(`[user-balances POST] ${action} request:`, body);

      try {
        const response = await fetch(`${process.env.ALLOCATE_API_URL}/api/user-positions?action=${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `API responded with status: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
      } catch (error) {
        console.error(`[user-balances POST] ${action} error:`, error);
        return NextResponse.json({
          error: error instanceof Error ? error.message : `Failed to ${action}`,
        }, { status: 500 });
      }
    }
    
    const body = await request.json();
    const { userAddress } = body;
    console.log('[user-balances POST] Request received for:', userAddress);
    
    if (!userAddress) {
      return NextResponse.json({ error: 'userAddress required' }, { status: 400 });
    }
    
    const url = `${process.env.ALLOCATE_API_URL}/api/user-positions?userAddress=${userAddress}`;
    console.log('[user-balances POST] Calling:', url);
    
    // Add timeout to prevent long waits
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const freshPositions = await response.json();
    
    const collection = await getCollection('userBalances');
    await collection.findOneAndUpdate(
      { userAddress },
      { $set: { data: freshPositions, lastUpdated: new Date() } },
      { upsert: true }
    );
    
    return NextResponse.json(freshPositions);
  } catch (error) {
    console.error('[user-balances POST] Error:', error);
    return NextResponse.json({ error: 'Failed to refresh user balances' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('userAddress');
    const targetGoalId = searchParams.get('targetGoalId');
    const action = searchParams.get('action');
    
    // Handle Group Goals actions
    if (action === 'public-goals') {
      try {
        const response = await fetch(`${process.env.ALLOCATE_API_URL}/api/user-positions?action=public-goals`);
        if (!response.ok) throw new Error(`API responded with status: ${response.status}`);
        const data = await response.json();
        return NextResponse.json(data);
      } catch (error) {
        return NextResponse.json({ total: 0, goals: [] });
      }
    }
    
    if (action === 'my-groups' && address) {
      try {
        const response = await fetch(`${process.env.ALLOCATE_API_URL}/api/user-positions?action=my-groups&userAddress=${address}`);
        if (!response.ok) throw new Error(`API responded with status: ${response.status}`);
        const data = await response.json();
        return NextResponse.json(data);
      } catch (error) {
        return NextResponse.json({ total: 0, public: { total: 0, goals: [] }, private: { total: 0, goals: [] } });
      }
    }

    if (action === 'leaderboard') {
      const start = searchParams.get('start') || '0';
      const limit = searchParams.get('limit') || '10';
      try {
        const response = await fetch(`${process.env.ALLOCATE_API_URL}/api/user-positions?action=leaderboard&start=${start}&limit=${limit}`);
        if (!response.ok) throw new Error(`API responded with status: ${response.status}`);
        const data = await response.json();
        return NextResponse.json(data);
      } catch (error) {
        return NextResponse.json({ total: '0', start: parseInt(start), limit: parseInt(limit), data: [] });
      }
    }
    
    if (!address) {
      return NextResponse.json({ error: 'userAddress parameter required' }, { status: 400 });
    }
    
    const collection = await getCollection('userBalances');
    const stored = await collection.findOne<UserPositions>({ userAddress: address });
    
    // Check if cached data is stale (older than 5 minutes)
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    const isStale = !stored || !stored.lastUpdated || (now.getTime() - stored.lastUpdated.getTime()) > CACHE_TTL;
    
    // Return cached data immediately if available, then update in background if stale
    if (stored && !targetGoalId) {
      // Return cached data immediately
      const response = NextResponse.json(stored.data);
      
      // If stale, update in background
      if (isStale) {
        // Don't await - update in background
        updateUserPositions(address, targetGoalId).catch(err => 
          console.warn('[user-balances] Background update failed:', err)
        );
      }
      
      return response;
    }
    
    // Fetch fresh data
    const positions = await updateUserPositions(address, targetGoalId);
    return NextResponse.json(positions);
  } catch (error) {
    console.error('[user-balances GET] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch user balances'
    }, { status: 500 });
  }
}
