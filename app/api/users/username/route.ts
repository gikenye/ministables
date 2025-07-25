import { NextRequest, NextResponse } from "next/server";
import { UserService } from "@/lib/services/userService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/users/username?username=example
 * Check if a username is available
 */
export async function GET(req: NextRequest) {
  try {
    // Get the username from the query parameters
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    
    if (!username) {
      return NextResponse.json(
        { error: "Username parameter is required" },
        { status: 400 }
      );
    }

    // Check if the username is available
    const isAvailable = await UserService.isUsernameAvailable(username);
    
    return NextResponse.json({ available: isAvailable });
  } catch (error) {
    console.error("Error checking username availability:", error);
    return NextResponse.json(
      { error: "Failed to check username availability" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users/username
 * Set a username for the current user
 */
export async function POST(req: NextRequest) {
  try {
    // Get the session to verify the user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.address) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the request body
    const data = await req.json();
    const { username } = data;
    
    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    // Validate username format (alphanumeric, underscores, 3-20 characters)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { 
          error: "Invalid username format",
          message: "Username must be 3-20 characters and can only contain letters, numbers, and underscores"
        },
        { status: 400 }
      );
    }

    // Check if the username is already taken
    const isAvailable = await UserService.isUsernameAvailable(username);
    
    if (!isAvailable) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 }
      );
    }

    // Update the user's username
    const user = await UserService.updateUser(session.user.address, { username });
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      username: user.username
    });
  } catch (error) {
    console.error("Error setting username:", error);
    return NextResponse.json(
      { error: "Failed to set username" },
      { status: 500 }
    );
  }
}