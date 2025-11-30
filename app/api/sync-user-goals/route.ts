import { NextRequest, NextResponse } from 'next/server';
import { UserGoalsService } from '@/lib/services/userGoalsService';

export async function POST(request: NextRequest) {
  try {
    const { userAddress } = await request.json();

    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 400 }
      );
    }

    const goals = await UserGoalsService.syncUserGoals(userAddress);

    return NextResponse.json({
      success: true,
      goalsCount: goals.length,
      goals,
    });
  } catch (error) {
    console.error('Error syncing user goals:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync goals' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 400 }
      );
    }

    const goals = await UserGoalsService.getUserGoals(userAddress);

    return NextResponse.json({
      userAddress,
      totalGoals: goals.length,
      goals,
    });
  } catch (error) {
    console.error('Error fetching user goals:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch goals' },
      { status: 500 }
    );
  }
}