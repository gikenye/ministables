import { Contract, providers, utils } from "ethers";
import { Mento } from "@mento-protocol/mento-sdk";

// Constants
const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

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

type Token = { address: string; symbol: string };
type PriceQuote = {
  price: number;
  symbol: string;
  baseSymbol: string;
  quoteSymbol: string;
};

function isMentoStable(symbol: string): boolean {
  if (!symbol) return false;
  if (symbol === "CELO") return false;
  if (symbol.includes("USDC") || symbol.includes("USDT") || symbol.includes("EUROC") || symbol.includes("Bridged")) return false;
  return symbol.startsWith("c") || symbol.startsWith("e");
}

async function getTokenDecimals(provider: providers.Provider, tokenAddress: string): Promise<number> {
  try {
    const erc20 = new Contract(tokenAddress, ERC20_ABI, provider);
    const decimals: number = await erc20.decimals();
    return decimals;
  } catch (e) {
    console.error(`Failed to get decimals for ${tokenAddress}`, e);
    return 18; // Default to 18 decimals
  }
}

async function getTokenSymbol(provider: providers.Provider, tokenAddress: string): Promise<string> {
  try {
    const erc20 = new Contract(tokenAddress, ERC20_ABI, provider);
    return await erc20.symbol();
  } catch (e) {
    console.error(`Failed to get symbol for ${tokenAddress}`, e);
    return tokenAddress.substring(0, 6) + '...';
  }
}

// Cache setup
let mentoInstance: any = null;
let providerInstance: providers.Provider | null = null;
let tokenCache = new Map<string, { symbol: string, decimals: number }>();
const priceQuoteCache = new Map<string, { quote: PriceQuote, timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes in milliseconds

async function getOrCreateMento(): Promise<any> {
  if (!mentoInstance) {
    if (!providerInstance) {
      // Use Alfajores testnet by default, can be switched to mainnet in production
      providerInstance = new providers.JsonRpcProvider("https://forno.celo.org");
    }
    mentoInstance = await Mento.create(providerInstance);
  }
  return mentoInstance;
}

/**
 * Gets the current exchange rate between two assets
 * @param fromToken Address of the source token
 * @param toToken Address of the target token
 * @param amount Amount to convert (in source token units)
 * @returns The exchange rate or null if not available
 */
export async function getExchangeRate(
  fromToken: string, 
  toToken: string,
  amount: string = "1"
): Promise<PriceQuote | null> {
  try {
    // Generate a cache key
    const cacheKey = `${fromToken}_${toToken}_${amount}`;
    const now = Date.now();
    
    // Check cache first
    const cached = priceQuoteCache.get(cacheKey);
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      return cached.quote;
    }
    
    // Get Mento instance
    const mento = await getOrCreateMento();
    
    // Get token info (using cache if available)
    let fromSymbol: string;
    let toSymbol: string;
    let fromDecimals: number;
    let toDecimals: number;
    
    if (tokenCache.has(fromToken)) {
      const cached = tokenCache.get(fromToken)!;
      fromSymbol = cached.symbol;
      fromDecimals = cached.decimals;
    } else {
      fromSymbol = await getTokenSymbol(providerInstance!, fromToken);
      fromDecimals = await getTokenDecimals(providerInstance!, fromToken);
      tokenCache.set(fromToken, { symbol: fromSymbol, decimals: fromDecimals });
    }
    
    if (tokenCache.has(toToken)) {
      const cached = tokenCache.get(toToken)!;
      toSymbol = cached.symbol;
      toDecimals = cached.decimals;
    } else {
      toSymbol = await getTokenSymbol(providerInstance!, toToken);
      toDecimals = await getTokenDecimals(providerInstance!, toToken);
      tokenCache.set(toToken, { symbol: toSymbol, decimals: toDecimals });
    }
    
    // Find trading pair
    const tradablePair = await mento.findPairForTokens(fromToken, toToken);
    
    // Get amount out
    const amountIn = utils.parseUnits(amount, fromDecimals);
    const amountOut = await mento.getAmountOut(fromToken, toToken, amountIn, tradablePair);
    
    // Format the output amount
    const formattedAmountOut = utils.formatUnits(amountOut, toDecimals);
    const rate = parseFloat(formattedAmountOut);
    
    // Create and cache the quote
    const quote: PriceQuote = {
      price: rate,
      symbol: `${toSymbol}/${fromSymbol}`,
      baseSymbol: fromSymbol,
      quoteSymbol: toSymbol,
    };
    
    priceQuoteCache.set(cacheKey, { quote, timestamp: now });
    return quote;
  } catch (e) {
    console.error("Failed to get exchange rate:", e);
    return null;
  }
}

/**
 * Calculates the equivalent value of tokens based on exchange rate
 * @param fromToken Address of the source token
 * @param toToken Address of the target token
 * @param amount Amount to convert (in source token units as string)
 * @returns The equivalent value in target token
 */
export async function calculateEquivalentValue(
  fromToken: string,
  toToken: string,
  amount: string
): Promise<{value: string, rate: number} | null> {
  try {
    // Get token decimals
    let fromDecimals: number;
    if (tokenCache.has(fromToken)) {
      fromDecimals = tokenCache.get(fromToken)!.decimals;
    } else {
      fromDecimals = await getTokenDecimals(providerInstance!, fromToken);
      const symbol = await getTokenSymbol(providerInstance!, fromToken);
      tokenCache.set(fromToken, { symbol, decimals: fromDecimals });
    }

    // Get exchange rate for 1 unit
    const rate = await getExchangeRate(fromToken, toToken);
    if (!rate) return null;

    // Calculate the equivalent value
    const numericAmount = parseFloat(amount);
    const equivalentValue = numericAmount * rate.price;
    
    return {
      value: equivalentValue.toString(),
      rate: rate.price
    };
  } catch (e) {
    console.error("Failed to calculate equivalent value:", e);
    return null;
  }
}

/**
 * Calculates required collateral amount based on token prices
 * @param borrowToken Address of token being borrowed
 * @param collateralToken Address of token being used as collateral
 * @param borrowAmount Amount being borrowed
 * @param collateralRatio Required collateralization ratio (e.g., 1.5 for 150%)
 * @returns Required collateral amount as a string
 */
export async function calculateRequiredCollateral(
  borrowToken: string,
  collateralToken: string,
  borrowAmount: string,
  collateralRatio: number = 1.5
): Promise<{amount: string, rate: number} | null> {
  try {
    // Step 1: Get both token info
    const borrowTokenInfo = tokenCache.get(borrowToken) || {
      symbol: await getTokenSymbol(providerInstance!, borrowToken),
      decimals: await getTokenDecimals(providerInstance!, borrowToken)
    };
    
    const collateralTokenInfo = tokenCache.get(collateralToken) || {
      symbol: await getTokenSymbol(providerInstance!, collateralToken),
      decimals: await getTokenDecimals(providerInstance!, collateralToken)
    };
    
    // Cache token info
    if (!tokenCache.has(borrowToken)) {
      tokenCache.set(borrowToken, borrowTokenInfo);
    }
    if (!tokenCache.has(collateralToken)) {
      tokenCache.set(collateralToken, collateralTokenInfo);
    }

    // Step 2: Find a common base token (use cUSD as intermediary if direct pair not found)
    let exchangeRate: number;
    let directRate = await getExchangeRate(collateralToken, borrowToken);
    
    if (directRate) {
      // Using collateral->borrow direction gets us the proper exchange rate
      // This represents how much collateral is worth in terms of borrow token
      exchangeRate = directRate.price;
    } else {
      // Try using cUSD as intermediary
      const cUsdAddress = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1"; // cUSD token address
      const collateralToCUsd = await getExchangeRate(collateralToken, cUsdAddress);
      const cUsdToBorrow = await getExchangeRate(cUsdAddress, borrowToken);
      
      if (collateralToCUsd && cUsdToBorrow) {
        exchangeRate = collateralToCUsd.price * cUsdToBorrow.price;
      } else {
        // If no route available, return null
        return null;
      }
    }
    
    // Step 3: Calculate required collateral with the collateral ratio
    const borrowAmountNum = parseFloat(borrowAmount);
    const requiredCollateral = borrowAmountNum * collateralRatio / exchangeRate;
    
    return {
      amount: requiredCollateral.toFixed(4),
      rate: exchangeRate
    };
  } catch (e) {
    console.error("Failed to calculate required collateral:", e);
    return null;
  }
}

// Initialize the provider on module import
if (!providerInstance) {
  providerInstance = new providers.JsonRpcProvider("https://forno.celo.org");
}
