import { NextRequest, NextResponse } from "next/server";
import { UserService } from "@/lib/services/userService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/users
 * Get the current user's data
 */
export async function GET(req: NextRequest) {
  try {
    // Get the session to verify the user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.address) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the user data from the database
    const user = await UserService.findByAddress(session.user.address);
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Return the user data (excluding sensitive fields)
    return NextResponse.json({
      address: user.address,
      username: user.username,
      verified: user.verified,
      identityData: user.identityData,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Create or update a user after verification
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
    
    // Ensure the address in the request matches the authenticated user
    if (data.address && data.address.toLowerCase() !== session.user.address.toLowerCase()) {
      return NextResponse.json(
        { error: "Address mismatch" },
        { status: 403 }
      );
    }

    // Create or update the user
    const user = await UserService.upsertUser(session.user.address, {
      ...data,
      verified: session.user.verified,
      identityData: session.user.identityData
    });

    // Return the updated user data
    return NextResponse.json({
      address: user.address,
      username: user.username,
      verified: user.verified,
      identityData: user.identityData,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    console.error("Error creating/updating user:", error);
    return NextResponse.json(
      { error: "Failed to create/update user" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users
 * Update user data (partial update)
 */
export async function PATCH(req: NextRequest) {
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
    
    // Prevent updating address
    if (data.address) {
      delete data.address;
    }

    // Update the user
    const user = await UserService.updateUser(session.user.address, data);
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Return the updated user data
    return NextResponse.json({
      address: user.address,
      username: user.username,
      verified: user.verified,
      identityData: user.identityData,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}