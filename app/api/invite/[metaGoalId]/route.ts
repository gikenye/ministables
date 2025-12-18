import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { metaGoalId: string } }
) {
  const { metaGoalId } = params;
  const targetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/goals/${metaGoalId}`;
  
  return NextResponse.redirect(targetUrl, 302);
}
