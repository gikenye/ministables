import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // TODO: Implement actual database query to fetch user activities
    // For now, return empty array to let the service use localStorage fallback
    const activities = [];

    return NextResponse.json({
      success: true,
      activities,
      count: activities.length,
    });
  } catch (error) {
    console.error("Error fetching user activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch user activity" },
      { status: 500 }
    );
  }
}
