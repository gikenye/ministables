
import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { TOKENS, CHAINS } from '@/config/chainConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const ORACLE_ABI = [
  'function setRatesBatch(address[] tokens, uint256[] rate1e18) external',
];

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

const SORTED_ORACLES_ABI = [
  'function medianRate(address rateFeedId) view returns (uint256 numerator, uint256 denominator)',
];

type TokenConfig = { address: string };

type MentoToken = { address: string; symbol?: string };

type BigintLike = bigint | string | number | { toString: () => string };

const toBigInt = (value: BigintLike): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string') return BigInt(value);
  if (value && typeof value.toString === 'function') {
    return BigInt(value.toString());
  }
  throw new Error('Unsupported bigint value');
};

async function loadMento(provider: ethers.Provider) {
  const mentoModule = await import(
    "@mento-protocol/mento-sdk/dist/cjs/index.js"
  );
  const Mento =
    (mentoModule as { Mento?: typeof import("@mento-protocol/mento-sdk").Mento })
      .Mento ||
    (mentoModule as { default?: { Mento?: typeof import("@mento-protocol/mento-sdk").Mento } })
      .default?.Mento;
  if (!Mento) {
    throw new Error("Failed to load Mento SDK");
  }
  return Mento.create(provider as any);
}

// Map token symbol to USD rate feed IDs from Mento docs (relayed:XYZUSD feeds)
const USD_FEED_BY_SYMBOL: Record<string, string> = {
  cNGN: '0xC13D42556f1baeab4a8600C735afcd5344048d3C',
  PUSO: '0xab921d6ab1057601A9ae19879b111fC381a2a8E9',
  cCOP: '0x0196D1F4FdA21fA442e53EaF18Bf31282F6139F1',
  cGHS: '0x44D99a013a0DAdbB4C06F9Cc9397BFd3AC12b017',
  cGBP: '0xf590b62f9cfcc6409075b1ecAc8176fe25744B88',
  cZAR: '0x17ef04Af0c52465694a841552fc2415169b1114c',
  cCAD: '0x20869cF54Ead821C45DFb2aB0C23d2e10Fbb65A4',
  cAUD: '0x646bD504C3864Ea5b8A6B6D25743721f61864A07',
  cCHF: '0x0f61BA9c30ef7CaEE7E5CC1F96BFFCb0f52ccD64',
  cJPY: '0xFDE35B45cBd2504FB5dC514F007bC2DE27034274',
};

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "CUSD"]);

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function parseAddressesFromEnv(envKey: string): string[] {
  return (process.env[envKey] || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && isValidAddress(s));
}

export async function GET(request: NextRequest) {
  try {
    // Optional safety: allow either Vercel Cron header or GitHub Actions (custom header)
    const isVercelCron = request.headers.get('x-vercel-cron') !== null;
    const isGithubWorkflow = request.headers.get('x-github-workflow') !== null;
    if (process.env.NODE_ENV === 'production' && !isVercelCron && !isGithubWorkflow && process.env.ALLOW_PUBLIC_CRON !== 'true') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rpcUrl = process.env.RPC_URL || 'https://forno.celo.org';
    const oracleAddress = (process.env.BACKEND_ORACLE_ADDRESS || process.env.NEXT_PUBLIC_BACKEND_ORACLE_ADDRESS || '0x66b2Ed926b810ca5296407d0fE8F1dB73dFe5924').trim();
    const privateKey = (process.env.PRIVATE_KEY || '').trim();

    if (!privateKey) {
      console.error('[CRON] Missing PRIVATE_KEY');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    if (!isValidAddress(oracleAddress)) {
      console.error('[CRON] Invalid oracle address');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    let mento: Awaited<ReturnType<typeof loadMento>> | null = null;
    let celoToken: MentoToken | null = null;
    let usdPerCelo1e18: bigint | null = null;
    try {
      mento = await loadMento(provider);
      const pairs = await mento.getTradablePairs();
      const flat = pairs.flat() as MentoToken[];
      const celo = flat.find((t) => t.symbol === "CELO") || null;
      const cUSD = flat.find((t) => (t.symbol || "").toUpperCase() === "CUSD") || null;
      if (celo && cUSD) {
        const pairCELOcUSD = await mento.findPairForTokens(
          celo.address,
          cUSD.address
        );
        const oneCelo = ethers.parseUnits("1", 18);
        const outCUSD = await mento.getAmountOut(
          celo.address,
          cUSD.address,
          oneCelo,
          pairCELOcUSD
        );
        usdPerCelo1e18 = toBigInt(outCUSD);
        celoToken = celo;
      } else {
        console.warn("[CRON] Mento: failed to resolve CELO/cUSD pair");
      }
    } catch (err) {
      console.warn(
        "[CRON] Mento SDK unavailable; falling back to stable peg / SortedOracles",
        err instanceof Error ? err.message : "Unknown error"
      );
    }

    // Resolve token list from env or default to TOKENS for the default chain
    let tokenAddresses: string[] = parseAddressesFromEnv('TOKEN_ADDRESSES');
    if (tokenAddresses.length === 0) {
      const defaultChain = CHAINS[0];
      const tokenList = TOKENS[defaultChain.id as keyof typeof TOKENS] || [];
      tokenAddresses = (tokenList as TokenConfig[])
        .map((token) => token.address)
        .filter((address): address is string => !!address);
    }

    // Resolve SortedOracles address
    const sortedOraclesAddress = (process.env.SORTED_ORACLES_ADDRESS || '0xefB84935239dAcdecF7c5bA76d8dE40b077B7b33').trim();
    if (!isValidAddress(sortedOraclesAddress)) {
      console.error('[CRON] Invalid SortedOracles address');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }
    const sortedOracles = new ethers.Contract(sortedOraclesAddress, SORTED_ORACLES_ABI, provider);

    const oracle = new ethers.Contract(oracleAddress, ORACLE_ABI, signer);

    const tokens: string[] = [];
    const prices: string[] = [];
    const prepared: Array<{ address: string; symbol: string; priceUSDPretty: string; route: string }> = [];

    const pricePromises = tokenAddresses.map(async (tokenAddr) => {
      if (!isValidAddress(tokenAddr)) return null;

      try {
        const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
        const [tokenDecimalsRaw, tokenSymbol] = await Promise.all([
          erc20.decimals().catch(() => 18),
          erc20.symbol().catch(() => '?')
        ]);

        const tokenDecimals = Number(tokenDecimalsRaw);

        let price1e18: bigint = 0n;
        let route: string = '';

        const normalizedSymbol = tokenSymbol?.toUpperCase?.() ?? '';
        if (STABLE_SYMBOLS.has(normalizedSymbol)) {
          price1e18 = ethers.parseUnits('1', 18);
          route = 'stable-peg';
        }

        // Try CELO -> TOKEN via Mento
        if (price1e18 == 0n && mento && usdPerCelo1e18 && celoToken) {
          const oneCelo = ethers.parseUnits('1', 18);
          try {
            const pairFwd = await mento.findPairForTokens(celoToken.address, tokenAddr);
            const outTokens = toBigInt(await mento.getAmountOut(celoToken.address, tokenAddr, oneCelo, pairFwd));
            if (outTokens > 0n) {
              const scale = ethers.parseUnits('1', tokenDecimals);
              price1e18 = (usdPerCelo1e18 * scale) / outTokens;
              route = 'CELO->TOKEN';
            }
          } catch (err) {
            console.warn(`[CRON] CELO->TOKEN failed for ${tokenAddr}:`, err instanceof Error ? err.message : 'Unknown error');
          }
        }

        // Try TOKEN -> CELO via Mento
        if (price1e18 == 0n && mento && usdPerCelo1e18 && celoToken) {
          try {
            const pairBack = await mento.findPairForTokens(tokenAddr, celoToken.address);
            const oneToken = ethers.parseUnits('1', tokenDecimals);
            const outCelo = toBigInt(await mento.getAmountOut(tokenAddr, celoToken.address, oneToken, pairBack));
            if (outCelo > 0n) {
              price1e18 = (usdPerCelo1e18 * outCelo) / ethers.parseUnits('1', 18);
              route = 'TOKEN->CELO';
            }
          } catch (err) {
            console.warn(`[CRON] TOKEN->CELO failed for ${tokenAddr}:`, err instanceof Error ? err.message : 'Unknown error');
          }
        }

        // Fallback to SortedOracles direct USD feed
        if (price1e18 == 0n) {
          const feed = USD_FEED_BY_SYMBOL[tokenSymbol as keyof typeof USD_FEED_BY_SYMBOL];
          if (feed && isValidAddress(feed)) {
            try {
              const [numerator, denominator] = await sortedOracles.medianRate(feed);
              if (denominator != 0n) {
                price1e18 = (numerator * ethers.parseUnits('1', 18)) / denominator;
                route = 'SortedOracles';
              }
            } catch (err) {
              console.warn(`[CRON] SortedOracles failed for ${tokenSymbol}:`, err instanceof Error ? err.message : 'Unknown error');
            }
          }
        }

        if (price1e18 == 0n) {
          console.warn(`[CRON] No price found for ${tokenSymbol} (${tokenAddr})`);
          return null;
        }

        return {
          address: tokenAddr,
          symbol: tokenSymbol,
          price: price1e18.toString(),
          priceUSDPretty: ethers.formatUnits(price1e18, 18),
          route: route || 'unknown',
        };
      } catch (err) {
        console.error(`[CRON] Error processing token ${tokenAddr}:`, err instanceof Error ? err.message : 'Unknown error');
        return null;
      }
    });

    const results = await Promise.all(pricePromises);
    for (const result of results) {
      if (result) {
        tokens.push(result.address);
        prices.push(result.price);
        prepared.push({
          address: result.address,
          symbol: result.symbol,
          priceUSDPretty: result.priceUSDPretty,
          route: result.route,
        });
      }
    }

    if (tokens.length === 0) {
      return NextResponse.json({ error: 'No valid prices to submit' }, { status: 500 });
    }

    const tx = await oracle.setRatesBatch(tokens, prices);
    const receipt = await tx.wait();

    return NextResponse.json({
      ok: true,
      txHash: receipt?.hash || tx.hash,
      count: tokens.length,
      tokens: prepared,
    });
  } catch (error) {
    console.error('[CRON] Error pushing prices', error);
    return NextResponse.json({ error: 'Failed to push prices' }, { status: 500 });
  }
}
