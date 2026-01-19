import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { base, celo, scroll } from "thirdweb/chains";
import { GAS_SPONSORSHIP_CONFIG } from "@/config/gasSponsorshipConfig";
import { gasSponsorshipService } from "@/services/gasSponsorshipService";

export const runtime = "nodejs";

const DEFAULT_GAS_LIMIT = 150000;
const MIN_GAS_LIMIT = 21000;
const MAX_GAS_LIMIT = 500000;

const RPC_URLS: Record<number, string | undefined> = {
  [celo.id]:
    process.env.CELO_RPC_URL ||
    process.env.NEXT_PUBLIC_CELO_RPC_URL ||
    process.env.RPC_URL ||
    "https://forno.celo.org",
  [scroll.id]: process.env.SCROLL_RPC_URL || "https://rpc.scroll.io",
  [base.id]: process.env.BASE_RPC_URL || "https://mainnet.base.org",
};

const RPC_NETWORKS: Record<number, { name: string; chainId: number }> = {
  [celo.id]: { name: "celo", chainId: celo.id },
  [scroll.id]: { name: "scroll", chainId: scroll.id },
  [base.id]: { name: "base", chainId: base.id },
};

const normalizeGasLimit = (gasLimit?: number) => {
  if (!Number.isFinite(gasLimit)) return DEFAULT_GAS_LIMIT;
  const rounded = Math.floor(gasLimit as number);
  return Math.min(Math.max(rounded, MIN_GAS_LIMIT), MAX_GAS_LIMIT);
};

const getErrorStatus = (message?: string) => {
  if (!message) return 500;
  if (message.includes("limit")) return 429;
  if (message.includes("Invalid")) return 400;
  if (message.includes("Insufficient")) return 503;
  return 500;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userAddress = body?.userAddress;
    const chainIdRaw = body?.chainId;
    const gasLimitRaw = body?.gasLimit;

    if (!userAddress || !chainIdRaw) {
      return NextResponse.json(
        { error: "Missing required fields: userAddress, chainId" },
        { status: 400 },
      );
    }

    if (!ethers.utils.isAddress(userAddress)) {
      return NextResponse.json(
        { error: "Invalid userAddress format" },
        { status: 400 },
      );
    }

    const chainId =
      typeof chainIdRaw === "string" ? Number(chainIdRaw) : chainIdRaw;
    if (!Number.isInteger(chainId)) {
      return NextResponse.json({ error: "Invalid chainId" }, { status: 400 });
    }

    if (!GAS_SPONSORSHIP_CONFIG.ENABLED) {
      return NextResponse.json(
        { error: "Gas sponsorship is disabled" },
        { status: 403 },
      );
    }

    if (!GAS_SPONSORSHIP_CONFIG.SPONSOR_PK) {
      return NextResponse.json(
        { error: "Sponsor wallet not configured" },
        { status: 500 },
      );
    }

    const rpcUrl = RPC_URLS[chainId];
    if (!rpcUrl) {
      return NextResponse.json(
        { error: `Unsupported chain ${chainId}` },
        { status: 400 },
      );
    }

    const gasLimit =
      typeof gasLimitRaw === "string" ? Number(gasLimitRaw) : gasLimitRaw;
    const normalizedGasLimit = normalizeGasLimit(gasLimit);

    const network = RPC_NETWORKS[chainId];
    // Next.js (Node/undici) + ethers web fetcher can throw: Referrer "client" is not a valid URL.
    // Passing a ConnectionInfo with skipFetchSetup avoids ethers' fetch setup (including setting referrer).
    const provider = new ethers.providers.StaticJsonRpcProvider(
      { url: rpcUrl, skipFetchSetup: true },
      network,
    );
    const sponsorWallet = new ethers.Wallet(
      GAS_SPONSORSHIP_CONFIG.SPONSOR_PK,
      provider,
    );

    const feeData = await provider.getFeeData();
    const maxFeePerGas =
      feeData.maxFeePerGas || feeData.gasPrice || ethers.BigNumber.from(0);

    if (maxFeePerGas.lte(0)) {
      return NextResponse.json(
        { error: "Unable to estimate gas fee" },
        { status: 503 },
      );
    }

    const estimatedGas = maxFeePerGas.mul(normalizedGasLimit);

    const sponsorResult = await gasSponsorshipService.sponsorGas(
      userAddress,
      estimatedGas,
      provider,
      sponsorWallet,
    );

    if (!sponsorResult.success) {
      return NextResponse.json(
        { error: sponsorResult.error || "Gas sponsorship failed" },
        { status: getErrorStatus(sponsorResult.error) },
      );
    }

    return NextResponse.json({
      success: true,
      txHash: sponsorResult.txHash,
      chainId,
      gasLimit: normalizedGasLimit,
      sponsoredAmountWei: estimatedGas.toString(),
    });
  } catch (error: any) {
    console.error("[API] Gas sponsorship failed:", error);

    const message =
      process.env.NODE_ENV === "development"
        ? error?.message || String(error)
        : "Internal server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 },
  );
}
