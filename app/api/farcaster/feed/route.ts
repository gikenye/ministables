import { NextRequest, NextResponse } from 'next/server';
import { fetchUserFeed } from '@/lib/neynar/service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ error: 'FID required' }, { status: 400 });
  }

  try {
    const feed = await fetchUserFeed(parseInt(fid));
    return NextResponse.json(feed);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
  }
}