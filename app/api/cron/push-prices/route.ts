import { NextRequest, NextResponse } from 'next/server';
import { Contract, Wallet, providers, utils, constants, BigNumber } from 'ethers';
import { Mento } from '@mento-protocol/mento-sdk';
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

    const provider = new providers.JsonRpcProvider(rpcUrl);
    const signer = new Wallet(privateKey, provider);
    const mento = await Mento.create(provider);

    // Resolve token list from env or default to TOKENS for the default chain
    let tokenAddresses: string[] = parseAddressesFromEnv('TOKEN_ADDRESSES');
    if (tokenAddresses.length === 0) {
      const defaultChain = CHAINS[0];
      const tokenList = (TOKENS as any)[defaultChain.id] || [];
      tokenAddresses = tokenList.map((t: any) => t.address).filter(Boolean);
    }

    // Resolve SortedOracles address
    const sortedOraclesAddress = (process.env.SORTED_ORACLES_ADDRESS || '0xefB84935239dAcdecF7c5bA76d8dE40b077B7b33').trim();
    if (!isValidAddress(sortedOraclesAddress)) {
      console.error('[CRON] Invalid SortedOracles address');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }
    const sortedOracles = new Contract(sortedOraclesAddress, SORTED_ORACLES_ABI, provider);

    // Discover CELO and cUSD via Mento and derive USD per CELO
    const pairs = await mento.getTradablePairs();
    const flat = pairs.flat() as any[];
    const celo = flat.find((t) => t.symbol === 'CELO');
    const cUSD = flat.find((t) => (t.symbol || '').toUpperCase() === 'CUSD');
    if (!celo || !cUSD) {
      return NextResponse.json({ error: 'Failed to resolve CELO/cUSD in Mento pairs' }, { status: 500 });
    }
    const pairCELOcUSD = await mento.findPairForTokens(celo.address, cUSD.address);
    const oneCelo = utils.parseUnits('1', 18);
    const outCUSD = await mento.getAmountOut(celo.address, cUSD.address, oneCelo, pairCELOcUSD);
    const usdPerCelo1e18 = outCUSD; // 1e18 scale

    const oracle = new Contract(oracleAddress, ORACLE_ABI, signer);

    const tokens: string[] = [];
    const prices: string[] = [];
    const prepared: Array<{ address: string; symbol: string; priceUSDPretty: string; route: string }>
      = [];

    const pricePromises = tokenAddresses.map(async (tokenAddr) => {
      if (!isValidAddress(tokenAddr)) return null;

      try {
        const erc20 = new Contract(tokenAddr, ERC20_ABI, provider);
        const [tokenDecimals, tokenSymbol] = await Promise.all([
          erc20.decimals().catch(() => 18),
          erc20.symbol().catch(() => '?')
        ]);

        let price1e18: BigNumber = constants.Zero;
        let route: string = '';

        // Try CELO -> TOKEN
        try {
          const pairFwd = await mento.findPairForTokens(celo.address, tokenAddr);
          const outTokens: BigNumber = await mento.getAmountOut(celo.address, tokenAddr, oneCelo, pairFwd);
          if (outTokens.gt(0)) {
            const scale = utils.parseUnits('1', tokenDecimals);
            price1e18 = usdPerCelo1e18.mul(scale).div(outTokens);
            route = 'CELO->TOKEN';
          }
        } catch (err) {
          console.warn(`[CRON] CELO->TOKEN failed for ${tokenAddr}:`, err instanceof Error ? err.message : 'Unknown error');
        }

        // Try TOKEN -> CELO
        if (price1e18.isZero()) {
          try {
            const pairBack = await mento.findPairForTokens(tokenAddr, celo.address);
            const oneToken = utils.parseUnits('1', tokenDecimals);
            const outCelo: BigNumber = await mento.getAmountOut(tokenAddr, celo.address, oneToken, pairBack);
            if (outCelo.gt(0)) {
              price1e18 = usdPerCelo1e18.mul(outCelo).div(utils.parseUnits('1', 18));
              route = 'TOKEN->CELO';
            }
          } catch (err) {
            console.warn(`[CRON] TOKEN->CELO failed for ${tokenAddr}:`, err instanceof Error ? err.message : 'Unknown error');
          }
        }

        // Fallback to SortedOracles direct USD feed
        if (price1e18.isZero()) {
          const feed = USD_FEED_BY_SYMBOL[tokenSymbol as keyof typeof USD_FEED_BY_SYMBOL];
          if (feed && isValidAddress(feed)) {
            try {
              const { numerator, denominator } = (await sortedOracles.medianRate(feed)) as { numerator: BigNumber; denominator: BigNumber };
              if (!denominator.isZero()) {
                price1e18 = numerator.mul(utils.parseUnits('1', 18)).div(denominator);
                route = 'SortedOracles';
              }
            } catch (err) {
              console.warn(`[CRON] SortedOracles failed for ${tokenSymbol}:`, err instanceof Error ? err.message : 'Unknown error');
            }
          }
        }

        if (price1e18.isZero()) {
          console.warn(`[CRON] No price found for ${tokenSymbol} (${tokenAddr})`);
          return null;
        }

        return {
          address: tokenAddr,
          symbol: tokenSymbol,
          price: price1e18.toString(),
          priceUSDPretty: utils.formatUnits(price1e18, 18),
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
      console.warn('[CRON] No prices to push');
      return NextResponse.json({ success: true, pushed: 0, message: 'No prices to push' }, { status: 200 });
    }

    console.log(`[CRON] Pushing ${tokens.length} prices to oracle`);
    const tx = await oracle.setRatesBatch(tokens, prices);
    const receipt = await tx.wait();

    console.log(`[CRON] Successfully pushed prices. TxHash: ${receipt.transactionHash}`);
    return NextResponse.json({
      success: true,
      pushed: tokens.length,
      txHash: receipt.transactionHash,
      entries: prepared,
    });
  } catch (error: any) {
    console.error('[CRON] Fatal error:', error?.message || 'Unknown error', error?.stack);
    return NextResponse.json({ error: 'Failed to push prices' }, { status: 500 });
  }
}


