import { BigNumber, Contract, providers, utils } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Force-load the project root .env regardless of invocation location
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// We'll try several common read methods to accommodate different oracle ABIs
const ORACLE_GETTERS = [
  { abi: ["function getMedianRate(address token) view returns (uint256 rate, uint256 timestamp)"], fn: "getMedianRate" },
  { abi: ["function getRate(address token) view returns (uint256 rate)"], fn: "getRate" },
  { abi: ["function rates(address token) view returns (uint256 rate)"], fn: "rates" },
  { abi: ["function price1e18(address token) view returns (uint256 rate)"], fn: "price1e18" },
  { abi: ["function prices(address token) view returns (uint256 rate)"], fn: "prices" },
];

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

async function main() {
  const rpcUrl =
    (process.env.RPC_URL ||
      process.env.CELO_RPC_URL ||
      process.env.NEXT_PUBLIC_RPC_URL ||
      process.env.NEXT_PUBLIC_CELO_RPC_URL) ||
    "https://forno.celo.org";
  let oracleAddress = (
    process.env.BACKEND_ORACLE_ADDRESS ||
    process.env.NEXT_PUBLIC_BACKEND_ORACLE_ADDRESS ||
    process.env.ORACLE_ADDRESS ||
    process.env.BACKEND_PRICE_ORACLE_ADDRESS ||
    ""
  ).trim();
  // Strip surrounding quotes if present
  if (oracleAddress.startsWith("\"") || oracleAddress.startsWith("'")) {
    oracleAddress = oracleAddress.replace(/^['"]|['"]$/g, "");
  }

  const provider = new providers.JsonRpcProvider(rpcUrl);

  // Resolve token list: from last-oracle-push.json, deployment file, or env TOKEN_ADDRESSES
  let tokenAddresses: string[] = [];
  try {
    const lastPath = path.resolve(__dirname, "../last-oracle-push.json");
    if (fs.existsSync(lastPath)) {
      const raw = fs.readFileSync(lastPath, "utf8");
      const json = JSON.parse(raw);
      if (!oracleAddress && typeof json.oracleAddress === "string") {
        oracleAddress = json.oracleAddress;
      }
      if (Array.isArray(json.tokens)) {
        tokenAddresses = json.tokens.filter((x: unknown) => typeof x === "string");
      } else if (Array.isArray(json.entries)) {
        tokenAddresses = json.entries.map((e: any) => e.address).filter((x: unknown) => typeof x === "string");
      }
    }
  } catch {}

  if (!oracleAddress) {
    console.error("Missing BACKEND_ORACLE_ADDRESS env and not found in last-oracle-push.json. Set it to the same address used by src/pushPrices.ts.");
    process.exit(1);
  }
  try {
    const depPath = path.resolve(__dirname, "../ministables-deployment.json");
    if (fs.existsSync(depPath)) {
      const raw = fs.readFileSync(depPath, "utf8");
      const json = JSON.parse(raw);
      tokenAddresses = (json.supportedStablecoins as string[]) || [];
    }
  } catch {}

  if (tokenAddresses.length === 0) {
    const raw = (process.env.TOKEN_ADDRESSES || "").trim();
    if (raw) {
      try {
        if (raw.startsWith("[")) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            tokenAddresses = parsed.map((s) => String(s)).filter(Boolean);
          }
        } else {
          tokenAddresses = raw.split(",").map((s) => s.trim()).filter(Boolean);
        }
      } catch {
        tokenAddresses = raw.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
  }

  // Sanitize token addresses: remove any quotes and discard invalid entries
  tokenAddresses = tokenAddresses
    .map((addr) => addr.replace(/['"]/g, "").trim())
    .filter((addr) => utils.isAddress(addr));

  if (tokenAddresses.length === 0) {
    console.error("No valid token addresses found. Provide TOKEN_ADDRESSES (comma-separated, no quotes) or ensure a deployment file exists.");
    process.exit(1);
  }

  console.log("Reading oracle rates from:", oracleAddress);

  for (const addr of tokenAddresses) {
    try {
      const erc20 = new Contract(addr, ERC20_ABI, provider);
      const [symbol, decimals] = await Promise.all([
        erc20.symbol().catch(() => "?"),
        erc20.decimals().catch(() => 18),
      ]);

      let price: BigNumber | null = null;
      let methodUsed = "";
      let timestamp: BigNumber | null = null;

      for (const g of ORACLE_GETTERS) {
        try {
          const contract = new Contract(oracleAddress, g.abi, provider);
          if (g.fn === "getMedianRate") {
            const res = await contract.getMedianRate(addr);
            // Support both tuple and object returns
            const r: BigNumber = res.rate ?? res[0];
            const ts: BigNumber = res.timestamp ?? res[1] ?? BigNumber.from(0);
            price = r;
            timestamp = ts;
            methodUsed = g.fn;
            break;
          } else {
            const r: BigNumber = await contract[g.fn](addr);
            price = r;
            methodUsed = g.fn;
            break;
          }
        } catch {}
      }

      if (!price || price.isZero()) {
        console.log(`${addr} -> no price set`);
        continue;
      }

      const priceUsd = utils.formatUnits(price, 18);
      const tsIso = timestamp ? new Date(Number(timestamp) * 1000).toISOString() : "n/a";
      console.log(`${symbol} (${addr}) -> ${priceUsd} USD @ ${tsIso} [${methodUsed}]`);
    } catch (e) {
      console.log(`${addr} -> no price set`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


