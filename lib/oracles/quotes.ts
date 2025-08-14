import { Contract, providers, utils } from "ethers";

import { Mento } from "@mento-protocol/mento-sdk";

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

type Token = { address: string; symbol: string };

function isMentoStable(symbol: string): boolean {
  if (!symbol) return false;
  if (symbol === "CELO") return false;
  if (symbol.includes("USDC") || symbol.includes("USDT") || symbol.includes("EUROC") || symbol.includes("Bridged")) return false;
  return symbol.startsWith("c") || symbol.startsWith("e");
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

  // Build unique set of Mento stables from pairs
  const stableMap = new Map<string, Token>();
  for (const [a, b] of pairs as [Token, Token][]) {
    if (isMentoStable(a.symbol)) stableMap.set(a.address, a);
    if (isMentoStable(b.symbol)) stableMap.set(b.address, b);
  }

  console.log(`Found ${stableMap.size} Mento stablecoins. Quoting vs CELO...`);

  for (const stable of stableMap.values()) {
    try {
      const stableDecimals = await getTokenDecimals(provider, stable.address);
      const celoDecimals = 18; // CELO has 18 decimals

      // Find a route/pair for CELO -> STABLE
      let outStableFmt = "-";
      try {
        const pairForward = await mento.findPairForTokens(celo.address, stable.address);
        const oneCelo = utils.parseUnits("1", celoDecimals);
        const outStable = await mento.getAmountOut(celo.address, stable.address, oneCelo, pairForward);
        outStableFmt = utils.formatUnits(outStable, stableDecimals);
      } catch (routeErr) {
        outStableFmt = "no route";
      }

      // Find a route/pair for STABLE -> CELO
      let outCeloFmt = "-";
      try {
        const pairBackward = await mento.findPairForTokens(stable.address, celo.address);
        const oneStable = utils.parseUnits("1", stableDecimals);
        const outCelo = await mento.getAmountOut(stable.address, celo.address, oneStable, pairBackward);
        outCeloFmt = utils.formatUnits(outCelo, celoDecimals);
      } catch (routeErr) {
        outCeloFmt = "no route";
      }

      console.log(`${stable.symbol}: ~${outStableFmt} ${stable.symbol} per 1 CELO | ~${outCeloFmt} CELO per 1 ${stable.symbol}`);
    } catch (e) {
      console.log(`Failed to quote ${stable.symbol}:`, e);
    }
  }
}

main()
  .then(() => console.log("Done! 🚀"))
  .catch((e) => console.log("Error: ", e));
