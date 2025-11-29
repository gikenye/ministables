import { getWalletBalance } from "thirdweb/wallets";
import { client } from "@/lib/thirdweb/client";
import { getTokens, CHAINS } from "@/config/chainConfig";

export interface TokenBalance {
  address: string;
  symbol: string;
  balance: number;
  formattedBalance: string;
  decimals: number;
}

/**
 * Gets balances for all supported stablecoins on the current chain
 * @param accountAddress User's wallet address
 * @param chainId Current chain ID
 * @returns Array of token balances
 */
export async function getStablecoinBalances(
  accountAddress: string,
  chainId: number
): Promise<TokenBalance[]> {
  try {
    const tokens = getTokens(chainId);
    const chain = CHAINS.find(c => c.id === chainId);

    if (!chain) {
      throw new Error(`Chain with ID ${chainId} not found`);
    }

    // Filter for stablecoins (USDC, USDT, CUSD)
    const stablecoins = tokens.filter(token =>
      ['USDC', 'USDT', 'CUSD'].includes(token.symbol.toUpperCase())
    );

    const balances: TokenBalance[] = [];

    for (const token of stablecoins) {
      try {
        const balanceResult = await getWalletBalance({
          client,
          chain,
          address: accountAddress,
          tokenAddress: token.address,
        });

        const balance = parseFloat(balanceResult.displayValue);
        balances.push({
          address: token.address,
          symbol: token.symbol,
          balance,
          formattedBalance: balanceResult.displayValue,
          decimals: token.decimals,
        });
      } catch (error) {
        console.warn(`Failed to get balance for ${token.symbol}:`, error);
        // Add with zero balance if fetch fails
        balances.push({
          address: token.address,
          symbol: token.symbol,
          balance: 0,
          formattedBalance: "0",
          decimals: token.decimals,
        });
      }
    }

    return balances;
  } catch (error) {
    console.error("Failed to get stablecoin balances:", error);
    return [];
  }
}

/**
 * Finds the best stablecoin to use for deposits based on available balance
 * Priority: USDC > USDT > CUSD (if balances are equal, prefer USDC)
 * @param accountAddress User's wallet address
 * @param chainId Current chain ID
 * @returns The best token to use, or null if none available
 */
export async function getBestStablecoinForDeposit(
  accountAddress: string,
  chainId: number
): Promise<TokenBalance | null> {
  const balances = await getStablecoinBalances(accountAddress, chainId);

  if (balances.length === 0) {
    return null;
  }

  // Filter tokens with positive balance
  const tokensWithBalance = balances.filter(token => token.balance > 0);

  if (tokensWithBalance.length === 0) {
    // No balance in any stablecoin, return USDC as default
    const usdcToken = balances.find(token => token.symbol.toUpperCase() === 'USDC');
    return usdcToken || balances[0];
  }

  // Sort by balance (highest first), then by priority (USDC > USDT > CUSD)
  const priorityOrder = ['USDC', 'USDT', 'CUSD'];

  tokensWithBalance.sort((a, b) => {
    // First sort by balance (descending)
    if (a.balance !== b.balance) {
      return b.balance - a.balance;
    }

    // If balances are equal, sort by priority
    const aPriority = priorityOrder.indexOf(a.symbol.toUpperCase());
    const bPriority = priorityOrder.indexOf(b.symbol.toUpperCase());

    // Lower index = higher priority
    if (aPriority !== -1 && bPriority !== -1) {
      return aPriority - bPriority;
    }

    // If one has priority and other doesn't, prefer the one with priority
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;

    return 0;
  });

  return tokensWithBalance[0];
}

/**
 * Checks if user has any stablecoin balance
 * @param accountAddress User's wallet address
 * @param chainId Current chain ID
 * @returns True if user has balance in any supported stablecoin
 */
export async function hasStablecoinBalance(
  accountAddress: string,
  chainId: number
): Promise<boolean> {
  const balances = await getStablecoinBalances(accountAddress, chainId);
  return balances.some(token => token.balance > 0);
}