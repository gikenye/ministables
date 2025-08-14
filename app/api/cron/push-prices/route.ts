import { NextRequest, NextResponse } from 'next/server';
import { Contract, Wallet, providers, utils, constants, BigNumber } from 'ethers';
import { Mento } from '@mento-protocol/mento-sdk';

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

function parseAddressesFromEnv(envKey: string): string[] {
  return (process.env[envKey] || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
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
    const oracleAddress = (process.env.BACKEND_ORACLE_ADDRESS || process.env.NEXT_PUBLIC_BACKEND_ORACLE_ADDRESS || '').trim();
    const privateKey = (process.env.PRIVATE_KEY || '').trim();

    if (!oracleAddress || !privateKey) {
      return NextResponse.json({ error: 'Missing BACKEND_ORACLE_ADDRESS or PRIVATE_KEY' }, { status: 500 });
    }

    const provider = new providers.JsonRpcProvider(rpcUrl);
    const signer = new Wallet(privateKey, provider);
    const mento = await Mento.create(provider);

    // Resolve token list from env
    let tokenAddresses: string[] = parseAddressesFromEnv('TOKEN_ADDRESSES');
    if (tokenAddresses.length === 0) {
      // Default to common tokens on Celo if not provided
      tokenAddresses = [
        '0x471EcE3750Da237f93B8E339c536989b8978a438', // CELO
        '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0', // cKES
        '0x765DE816845861e75A25fCA122bb6898B8B1282a', // cUSD
        '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', // USDC
        '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', // USDT
        '0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71', // cNGN
      ];
    }

    // Resolve SortedOracles address
    const sortedOraclesAddress = (process.env.SORTED_ORACLES_ADDRESS || '0xefB84935239dAcdecF7c5bA76d8dE40b077B7b33').trim();
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

    for (const tokenAddr of tokenAddresses) {
      try {
        const erc20 = new Contract(tokenAddr, ERC20_ABI, provider);
        const tokenDecimals: number = await erc20.decimals().catch(() => 18);
        const tokenSymbol: string = await erc20.symbol().catch(() => '?');

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
        } catch {}

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
          } catch {}
        }

        // Fallback to SortedOracles direct USD feed
        if (price1e18.isZero()) {
          const feed = USD_FEED_BY_SYMBOL[tokenSymbol as keyof typeof USD_FEED_BY_SYMBOL];
          if (feed) {
            try {
              const { numerator, denominator } = (await sortedOracles.medianRate(feed)) as { numerator: BigNumber; denominator: BigNumber };
              if (!denominator.isZero()) {
                price1e18 = numerator.mul(utils.parseUnits('1', 18)).div(denominator);
                route = 'SortedOracles';
              }
            } catch {}
          }
        }

        if (price1e18.isZero()) continue;

        tokens.push(tokenAddr);
        prices.push(price1e18.toString());
        prepared.push({
          address: tokenAddr,
          symbol: tokenSymbol,
          priceUSDPretty: utils.formatUnits(price1e18, 18),
          route: route || 'unknown',
        });
      } catch {}
    }

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, pushed: 0, message: 'No prices to push' }, { status: 200 });
    }

    const tx = await oracle.setRatesBatch(tokens, prices);
    const receipt = await tx.wait();

    return NextResponse.json({
      success: true,
      pushed: tokens.length,
      txHash: receipt.transactionHash,
      entries: prepared,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to push prices' }, { status: 500 });
  }
}


