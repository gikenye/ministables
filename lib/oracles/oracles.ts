import { Contract, providers, utils } from "ethers";
import { Mento } from "@mento-protocol/mento-sdk";

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

type Token = { address: string; symbol: string };

const STABLE_SYMBOL_TO_FIAT: Record<string, string> = {
  cUSD: "USD",
  cEUR: "EUR",
  cREAL: "BRL",
  eXOF: "XOF",
  cKES: "KES",
  cAUD: "AUD",
  cCOP: "COP",
  cGHS: "GHS",
  cGBP: "GBP",
  cZAR: "ZAR",
  cCAD: "CAD",
};

function isMentoStable(symbol: string): boolean {
  if (!symbol) return false;
  if (symbol === "CELO") return false;
  if (symbol.includes("USDC") || symbol.includes("USDT") || symbol.includes("EUROC") || symbol.includes("Bridged")) return false;
  return symbol in STABLE_SYMBOL_TO_FIAT;
}

async function getTokenDecimals(provider: providers.Provider, tokenAddress: string): Promise<number> {
  const erc20 = new Contract(tokenAddress, ERC20_ABI, provider);
  const decimals: number = await erc20.decimals();
  return decimals;
}

async function main() {
  const provider = new providers.JsonRpcProvider(
    "https://alfajores-forno.celo-testnet.org"
  );
  const mento = await Mento.create(provider);

  const pairs = await mento.getTradablePairs();

  const celo: Token | undefined = pairs
    .flat()
    .find((t: Token) => t.symbol === "CELO");
  if (!celo) {
    console.log("CELO token not found among tradable pairs");
    return;
  }

  const uniqueStables = new Map<string, Token>();
  for (const [a, b] of pairs as [Token, Token][]) {
    if (isMentoStable(a.symbol)) uniqueStables.set(a.address, a);
    if (isMentoStable(b.symbol)) uniqueStables.set(b.address, b);
  }

  console.log(`Discovered ${uniqueStables.size} supported Mento stablecoins with rate feeds:`);

  for (const stable of uniqueStables.values()) {
    const fiat = STABLE_SYMBOL_TO_FIAT[stable.symbol] ?? "?";
    const feedPair = `CELO/${fiat}`;
    const feedId = stable.address; // per docs: feed ID equals the stable token contract for CELO/<fiat>
    try {
      const stableDecimals = await getTokenDecimals(provider, stable.address);
      let outStableFmt = "-";
      try {
        const tradablePair = await mento.findPairForTokens(celo.address, stable.address);
        const oneCelo = utils.parseUnits("1", 18);
        const outStable = await mento.getAmountOut(celo.address, stable.address, oneCelo, tradablePair);
        outStableFmt = utils.formatUnits(outStable, stableDecimals);
      } catch (routeErr) {
        outStableFmt = "no route";
      }
      console.log(`${stable.symbol} -> ${feedPair} | feedId: ${feedId} | ~${outStableFmt} ${stable.symbol} per 1 CELO`);
    } catch (e) {
      console.log(`${stable.symbol} -> ${feedPair} | feedId: ${feedId} | quote failed`, e);
    }
  }

  console.log("Note: Rate feed IDs reference: https://docs.mento.org/mento/overview/core-concepts/oracles-and-price-feeds#active-rate-feeds");
}

main()
  .then(() => console.log("Done! 🚀"))
  .catch((e) => console.log("Error: ", e));


