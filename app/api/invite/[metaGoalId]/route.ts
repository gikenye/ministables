import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ metaGoalId: string }> }
) {
  const { metaGoalId } = await context.params;
  
  if (!metaGoalId || typeof metaGoalId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(metaGoalId)) {
    return NextResponse.json({ error: 'Invalid or missing metaGoalId' }, { status: 400 });
  }
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  const targetUrl = `${appUrl}/goals/${encodeURIComponent(metaGoalId)}`;
  return NextResponse.redirect(targetUrl, 302);
}
