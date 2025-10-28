import { NextRequest, NextResponse } from "next/server";
import { vaultService } from "@/lib/services/vaultService";

/**
 * GET /api/goals/vault-config?chainId=42220
 * Get vault configuration for supported chains
 * Returns supported tokens, lock tiers, and vault addresses
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainIdParam = searchParams.get("chainId");

    if (!chainIdParam) {
      return NextResponse.json(
        { error: "Chain ID is required" },
        { status: 400 }
      );
    }

    const chainId = parseInt(chainIdParam);

    if (!vaultService.isVaultChainSupported(chainId)) {
      return NextResponse.json(
        { error: `Chain ${chainId} does not support vault contracts` },
        { status: 400 }
      );
    }

    // Get vault configuration
    const config = vaultService.getVaultConfig(chainId);

    // Add vault addresses for each supported token
    const tokensWithVaults = await Promise.all(
      config.supportedTokens.map(async (token) => {
        try {
          const vaultAddress = vaultService.getGoalVaultAddress(
            chainId,
            token.symbol
          );
          const estimatedAPY = await vaultService.getEstimatedVaultAPY(
            chainId,
            token.symbol,
            0
          );

          return {
            ...token,
            vaultAddress,
            estimatedAPY,
          };
        } catch (error) {
          console.warn(
            `Failed to get vault address for ${token.symbol}:`,
            error
          );
          return null;
        }
      })
    );

    const validTokens = tokensWithVaults.filter(Boolean);

    return NextResponse.json({
      chainId,
      supported: config.supportedTokens.length > 0,
      tokens: validTokens,
      lockTiers: config.lockTiers,
      maxDepositsPerUser: config.maxDepositsPerUser,
    });
  } catch (error) {
    console.error("Error getting vault config:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to get vault configuration" },
      { status: 500 }
    );
  }
}
