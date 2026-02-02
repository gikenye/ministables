import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ metaGoalId: string }> }
) {
  const { metaGoalId } = await context.params;
  
  if (!metaGoalId || typeof metaGoalId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(metaGoalId)) {
    return NextResponse.json({ error: 'Invalid or missing metaGoalId' }, { status: 400 });
  }
  
  const url = new URL(request.url);
  const targetUrl = `${url.origin}/goals/${encodeURIComponent(metaGoalId)}`;
  return NextResponse.redirect(targetUrl, 302);
}
