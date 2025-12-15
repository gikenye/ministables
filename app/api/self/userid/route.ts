import { NextRequest, NextResponse } from "next/server";
import { UserService } from "@/lib/services/userService";
import { encrypt, decrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "walletAddress required" },
        { status: 400 }
      );
    }

    const user = await UserService.findByAddress(walletAddress);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = String(user._id);
    const encryptedString = encrypt(`${walletAddress}:${userId}`);

    return NextResponse.json({ selfId: encryptedString });
  } catch (error) {
    console.error("Error processing userid request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
