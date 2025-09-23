import { Contract, Wallet, providers, utils, constants, BigNumber } from "ethers";
import { Mento } from "@mento-protocol/mento-sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { TOKENS, CHAINS } from "@/config/chainConfig";

dotenv.config();

// BackendPriceOracle ABI subset
const ORACLE_ABI = [
  "function setRatesBatch(address[] tokens, uint256[] rate1e18) external",
];

// Map Mento stable token addresses to the desired USD-per-token price derivation.
// We compute: priceUSDPerToken = (CELO per 1 token) * (USD per 1 CELO)
// All normalized to 1e18

// Provide token addresses you want to maintain on-chain
let TOKEN_ADDRESSES: string[] = [];

// Populate default token addresses from config for the default chain, if available
try {
  const defaultChain = CHAINS && CHAINS.length > 0 ? CHAINS[0] : undefined;
  if (defaultChain && TOKENS && TOKENS[defaultChain.id]) {
    TOKEN_ADDRESSES = TOKENS[defaultChain.id].map((t: any) => t.address).filter(Boolean);
  }
} catch (e) {
  // ignore and allow env/deployment fallback
}

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// SortedOracles ABI subset
const SORTED_ORACLES_ABI = [
  "function medianRate(address rateFeedId) view returns (uint256 numerator, uint256 denominator)",
];

// Map token symbol to USD rate feed IDs from Mento docs (relayed:XYZUSD feeds)
// Ref: https://docs.mento.org/mento/overview/core-concepts/oracles-and-price-feeds#active-rate-feeds
const USD_FEED_BY_SYMBOL: Record<string, string> = {
  // NGN/USD
  cNGN: "0xC13D42556f1baeab4a8600C735afcd5344048d3C",
  // PHP/USD
  PUSO: "0xab921d6ab1057601A9ae19879b111fC381a2a8E9",
  // COP/USD
  cCOP: "0x0196D1F4FdA21fA442e53EaF18Bf31282F6139F1",
  // GHS/USD
  cGHS: "0x44D99a013a0DAdbB4C06F9Cc9397BFd3AC12b017",
  // GBP/USD
  cGBP: "0xf590b62f9cfcc6409075b1ecAc8176fe25744B88",
  // ZAR/USD
  cZAR: "0x17ef04Af0c52465694a841552fc2415169b1114c",
  // CAD/USD
  cCAD: "0x20869cF54Ead821C45DFb2aB0C23d2e10Fbb65A4",
  // AUD/USD
  cAUD: "0x646bD504C3864Ea5b8A6B6D25743721f61864A07",
  // CHF/USD
  cCHF: "0x0f61BA9c30ef7CaEE7E5CC1F96BFFCb0f52ccD64",
  // JPY/USD
  cJPY: "0xFDE35B45cBd2504FB5dC514F007bC2DE27034274",
};

async function main() {
  // Accept multiple common env var names to match existing project conventions
  const rpcUrl =
    (process.env.RPC_URL ||
      process.env.CELO_RPC_URL ||
      process.env.NEXT_PUBLIC_RPC_URL ||
      process.env.NEXT_PUBLIC_CELO_RPC_URL) ||
    "https://forno.celo.org";

  const oracleAddress = (
    process.env.BACKEND_ORACLE_ADDRESS ||
    process.env.NEXT_PUBLIC_BACKEND_ORACLE_ADDRESS ||
    process.env.ORACLE_ADDRESS ||
    process.env.BACKEND_PRICE_ORACLE_ADDRESS
  ) as string;

  const privateKey = (
    process.env.PRIVATE_KEY ||
    process.env.ORACLE_PRIVATE_KEY ||
    process.env.UPDATER_PRIVATE_KEY
  ) as string;

  if (!oracleAddress || !privateKey) {
    console.error(
      "Missing oracle updater credentials. Set BACKEND_ORACLE_ADDRESS and PRIVATE_KEY (or their accepted aliases)."
    );
    process.exit(1);
  }

  const provider = new providers.JsonRpcProvider(rpcUrl);
  const signer = new Wallet(privateKey, provider);
  const mento = await Mento.create(provider);

  // Load token list from deployment file if present
  try {
    const depPath = path.resolve(__dirname, "../ministables-deployment.json");
    if (fs.existsSync(depPath)) {
      const raw = fs.readFileSync(depPath, "utf8");
      const json = JSON.parse(raw);
      const list: string[] = json.supportedStablecoins || [];
      TOKEN_ADDRESSES = list.filter((x) => typeof x === "string");
      if (TOKEN_ADDRESSES.length === 0) {
        console.log("No supportedStablecoins found in deployment file; using env list");
      }
    }
  } catch {}
  if (TOKEN_ADDRESSES.length === 0) {
    const envList = (process.env.TOKEN_ADDRESSES || "").split(",").map((s) => s.trim()).filter(Boolean);
    TOKEN_ADDRESSES = envList;
  }
  if (TOKEN_ADDRESSES.length === 0) {
    console.error("No TOKEN_ADDRESSES provided. Set TOKEN_ADDRESSES env (comma-separated) or ensure ministables-deployment.json is present.");
    process.exit(1);
  }

  // Find CELO token and collect stable pairs
  const pairs = await mento.getTradablePairs();
  const flat = pairs.flat() as any[];
  const celo = flat.find((t) => t.symbol === "CELO");
  if (!celo) {
    throw new Error("CELO token not found in Mento pairs");
  }

  // Find pair for CELO -> USD stable (cUSD) to derive CELO price in USD
  // USD per CELO = 1 / (cUSD per CELO) approximately; but we can directly compute
  const cUSD = flat.find((t) => (t.symbol || "").toUpperCase() === "CUSD");
  if (!cUSD) {
    throw new Error("cUSD not found in Mento pairs");
  }

  // Get quote: outStable = cUSD per 1 CELO
  const pairCELOcUSD = await mento.findPairForTokens(celo.address, cUSD.address);
  const oneCelo = utils.parseUnits("1", 18);
  const outCUSD = await mento.getAmountOut(celo.address, cUSD.address, oneCelo, pairCELOcUSD);
  // USD per CELO scaled to 1e18 ~ cUSD has 18 decimals
  const usdPerCelo1e18 = outCUSD; // already 1e18 units since both have 18 decimals

  const oracle = new Contract(oracleAddress, ORACLE_ABI, signer);

  // Resolve SortedOracles address
  let sortedOraclesAddress = process.env.SORTED_ORACLES_ADDRESS as string | undefined;
  if (!sortedOraclesAddress) {
    try {
      const depPath = path.resolve(__dirname, "../ministables-deployment.json");
      if (fs.existsSync(depPath)) {
        const raw = fs.readFileSync(depPath, "utf8");
        const json = JSON.parse(raw);
        if (json.sortedOracles) sortedOraclesAddress = json.sortedOracles;
      }
    } catch {}
  }
  if (!sortedOraclesAddress) {
    // Mainnet default from docs
    sortedOraclesAddress = "0xefB84935239dAcdecF7c5bA76d8dE40b077B7b33";
  }
  const sortedOracles = new Contract(sortedOraclesAddress, SORTED_ORACLES_ABI, provider);

  console.log("USD per CELO (derived from CELO->cUSD):", utils.formatUnits(usdPerCelo1e18, 18));

  const tokens: string[] = [];
  const prices: string[] = [];
  const prepared: Array<{ address: string; symbol: string; price1e18: string; priceUSDPretty: string; route: string; }> = [];

  for (const tokenAddr of TOKEN_ADDRESSES) {
    try {
      const erc20 = new Contract(tokenAddr, ERC20_ABI, provider);
      const tokenDecimals: number = await erc20.decimals();
      const tokenSymbol: string = await erc20.symbol();

      let price1e18: BigNumber = constants.Zero;
      let route: string = "";

      // Always set CELO price directly from derived CELO->USD
      if (tokenAddr.toLowerCase() === celo.address.toLowerCase()) {
        price1e18 = usdPerCelo1e18;
        route = "CELO";
      }

      // Try CELO -> token route (tokens per 1 CELO)
      if (price1e18.isZero()) {
        try {
          const pairFwd = await mento.findPairForTokens(celo.address, tokenAddr);
          const outTokens: BigNumber = await mento.getAmountOut(celo.address, tokenAddr, oneCelo, pairFwd); // scaled by token decimals
          if (outTokens.gt(0)) {
            // price1e18 = usdPerCelo1e18 * 10^decimals / outTokens
            const scale = utils.parseUnits("1", tokenDecimals);
            price1e18 = usdPerCelo1e18.mul(scale).div(outTokens);
            route = "CELO->TOKEN";
          }
        } catch {}
      }

      // If forward route not available, try token -> CELO (CELO per 1 token)
      if (price1e18.isZero()) {
        try {
          const pairBack = await mento.findPairForTokens(tokenAddr, celo.address);
          const oneToken = utils.parseUnits("1", tokenDecimals);
          const outCelo: BigNumber = await mento.getAmountOut(tokenAddr, celo.address, oneToken, pairBack); // 18 decimals
          if (outCelo.gt(0)) {
            // price1e18 = usdPerCelo1e18 * (CELO per token) / 1e18
            price1e18 = usdPerCelo1e18.mul(outCelo).div(utils.parseUnits("1", 18));
            route = "TOKEN->CELO";
          }
        } catch {}
      }

      // Fallback: derive USD price directly from SortedOracles USD feeds (e.g., cNGN)
      if (price1e18.isZero()) {
        const sym = tokenSymbol as keyof typeof USD_FEED_BY_SYMBOL;
        const feed = USD_FEED_BY_SYMBOL[sym];
        if (feed) {
          try {
            const { numerator, denominator } = (await sortedOracles.medianRate(feed)) as { numerator: BigNumber; denominator: BigNumber };
            if (!denominator.isZero()) {
              // price1e18 = (numerator / denominator) scaled to 1e18
              price1e18 = numerator.mul(utils.parseUnits("1", 18)).div(denominator);
              route = "SortedOracles";
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
        price1e18: price1e18.toString(),
        priceUSDPretty: utils.formatUnits(price1e18, 18),
        route: route || "unknown",
      });
    } catch (e) {
      // skip tokens without a route
    }
  }

  if (tokens.length === 0) {
    console.log("No prices to push");
    return;
  }

  console.log("Preparing to push rates:");
  prepared.forEach((p, i) => {
    console.log(`${i + 1}. ${p.symbol} (${p.address}) -> ${p.priceUSDPretty} USD [${p.route}]`);
  });

  const tx = await oracle.setRatesBatch(tokens, prices);
  console.log("Pushed", tokens.length, "prices. Tx:", tx.hash);
  await tx.wait();
  console.log("Confirmed.");

  try {
    const outPath = path.resolve(__dirname, "../last-oracle-push.json");
    const logPayload = {
      timestamp: new Date().toISOString(),
      usdPerCelo: utils.formatUnits(usdPerCelo1e18, 18),
      oracleAddress,
      sortedOraclesAddress,
      txHash: tx.hash,
      entries: prepared,
      tokens,
    };
    fs.writeFileSync(outPath, JSON.stringify(logPayload, null, 2));
    console.log("Wrote push summary to", outPath);
  } catch {}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


