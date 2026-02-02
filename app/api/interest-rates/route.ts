import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AaveRatesService {
  getAPY(chainId: number, tokenSymbol: string): Promise<number>;
}

import { aaveRatesService } from "@/lib/services/aaveRatesService";

/**
 * GET /api/interest-rates
 * Get current interest rates for supported tokens
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

    if (chainId !== 42220) {
      return NextResponse.json({
        rates: {},
        message: "Interest rates not available for this chain",
      });
    }

    const supportedTokens = ["USDC", "USDT", "CUSD"];
    const rates: Record<string, number> = {};

    await Promise.allSettled(
      supportedTokens.map(async (token) => {
        try {
          const apy = await aaveRatesService.getAPY(chainId, token);
          if (apy > 0) {
            rates[token] = apy;
          }
        } catch (error) {
          console.error(`Failed to fetch APY for ${token}:`, error);
        }
      })
    );

    return NextResponse.json({
      rates,
      chainId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching interest rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch interest rates" },
      { status: 500 }
    );
  }
}
