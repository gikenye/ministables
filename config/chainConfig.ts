import { celo, scroll } from "thirdweb/chains";

export const CHAINS = [scroll, celo];

export const CONTRACTS = {
  [celo.id]: "0x4e1B2f1b9F5d871301D41D7CeE901be2Bd97693c",
  [scroll.id]: "0x31443910a7a6ff042067df8A34328E16a3994f72",
};

export const EXPLORERS = {
  [celo.id]: "https://celoscan.io",
  [scroll.id]: "https://scrollscan.com",
};

export const TOKENS = {

  [celo.id]: [
    {
      address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
      symbol: "USDC",
      decimals: 6,
      icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png",
    },
    {
      address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
      symbol: "USDT",
      decimals: 6,
      icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png",
    },
    {
      address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
      symbol: "CUSD",
      decimals: 18,
      icon: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/6807f9a4185658fa6e759a27_Tokens.avif",
    },
    {
      address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0",
      symbol: "CKES",
      decimals: 18,
      icon: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/68094e158b4206fbeba352aa_Tokens-3.avif",
    },
    {
      address: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71",
      symbol: "CNGN",
      decimals: 18,
      icon: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/6818d1976757a7c20485226f_Tokens%20(2).avif",
    },
  ],
    [scroll.id]: [
    {
      address: "0xd62fBDd984241BcFdEe96915b43101912a9fcE69",
      symbol: "BKES",
      decimals: 18,
      icon: "/bpesa.jpg",
    },
    {
      address: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4",
      symbol: "USDC",
      decimals: 6,
      icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png",
    },
    {
      address: "0x5300000000000000000000000000000000000004",
      symbol: "WETH",
      decimals: 18,
      icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png",
    },
  ],
};

// Helper functions for config-driven lookups
export const getContractAddress = (chainId: number): string => {
  const address = CONTRACTS[chainId];
  if (!address)
    throw new Error(`No contract address configured for chain ${chainId}`);
  return address;
};

export const getTokens = (chainId: number) => {
  const tokens = TOKENS[chainId];
  if (!tokens) throw new Error(`No tokens configured for chain ${chainId}`);
  return tokens;
};

export const getTokenInfo = (chainId: number, tokenAddress: string) => {
  const tokens = getTokens(chainId);
  const token = tokens.find(
    (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  if (!token)
    throw new Error(`Token ${tokenAddress} not found for chain ${chainId}`);
  return token;
};

export const getTokensBySymbol = (
  chainId: number
): Record<string, { address: string; decimals: number }> => {
  const tokens = getTokens(chainId);
  return tokens.reduce(
    (acc, token) => {
      acc[token.symbol] = { address: token.address, decimals: token.decimals };
      return acc;
    },
    {} as Record<string, { address: string; decimals: number }>
  );
};

export const getTokenInfoMap = (
  chainId: number
): Record<string, { symbol: string; decimals: number; icon?: string }> => {
  const tokens = getTokens(chainId);
  return tokens.reduce(
    (acc, token) => {
      acc[token.address] = {
        symbol: token.symbol,
        decimals: token.decimals,
        icon: token.icon,
      };
      return acc;
    },
    {} as Record<string, { symbol: string; decimals: number; icon?: string }>
  );
};

export const getExplorerUrl = (chainId: number): string => {
  const explorerUrl = EXPLORERS[chainId];
  if (!explorerUrl) throw new Error(`No explorer URL configured for chain ${chainId}`);
  return explorerUrl;
};

export const getTransactionUrl = (chainId: number, txHash: string): string => {
  return `${getExplorerUrl(chainId)}/tx/${txHash}`;
};
