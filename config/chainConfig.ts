import { celo, scroll } from "thirdweb/chains";

export const CHAINS = [celo, scroll];

export const CONTRACTS = {
  [celo.id]: "0x4e1B2f1b9F5d871301D41D7CeE901be2Bd97693c",
  [scroll.id]: "0x31443910a7a6ff042067df8A34328E16a3994f72",
};

// Vault contracts for Aave integration
export const VAULT_CONTRACTS = {
  [celo.id]: {
    USDC: "0xBEEf1612958A90F3553362c74Ccdf4c181512cf5",
    USDT: "0x90FF972CC2d12Ba495C8aC0887d6E9FD25B032c4",
    CUSD: "0x1077E075c879E8C95E7d0545b106B1448d035F37",
  },
};

// Additional Aave integration contracts
export const AAVE_CONTRACTS = {
  [celo.id]: {
    // Aave Strategies
    USDC_STRATEGY: "0x89401f1aC84e1012e294074f6e0C5C5B54f287b6",
    USDT_STRATEGY: "0xc031F072AB12A0D26Ed513E727352Ee281B5A559",
    CUSD_STRATEGY: "0xa97bA56C318694E1C08EdE9D8e2f0BDf16cebE21",
    
    // Other contracts
    BORROWER_VAULT: "0x775263BE35Bf0673279AE083bA9206cDac31c9e8",
    SAVINGS_BRIDGE: "0x9c7523EE4E9ceD985D248eF9f7d2502F2435bc9f",
    AAVE_POOL: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
  },
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
  if (!explorerUrl)
    throw new Error(`No explorer URL configured for chain ${chainId}`);
  return explorerUrl;
};

export const getTransactionUrl = (chainId: number, txHash: string): string => {
  return `${getExplorerUrl(chainId)}/tx/${txHash}`;
};

export const getVaultAddress = (
  chainId: number,
  tokenSymbol: string
): string => {
  const vaults = VAULT_CONTRACTS[chainId];
  if (!vaults)
    throw new Error(`No vault contracts configured for chain ${chainId}`);
  const vaultAddress = vaults[tokenSymbol.toUpperCase() as keyof typeof vaults];
  if (!vaultAddress)
    throw new Error(`No vault found for ${tokenSymbol} on chain ${chainId}`);
  return vaultAddress;
};

export const getAaveContract = (chainId: number, contractName: string): string => {
  const contracts = AAVE_CONTRACTS[chainId];
  if (!contracts) throw new Error(`No Aave contracts configured for chain ${chainId}`);
  const contractAddress = contracts[contractName.toUpperCase() as keyof typeof contracts];
  if (!contractAddress) throw new Error(`No Aave contract ${contractName} found for chain ${chainId}`);
  return contractAddress;
};

export const getStrategyAddress = (chainId: number, tokenSymbol: string): string => {
  const contracts = AAVE_CONTRACTS[chainId];
  if (!contracts) throw new Error(`No Aave contracts configured for chain ${chainId}`);
  const strategyAddress = contracts[`${tokenSymbol.toUpperCase()}_STRATEGY` as keyof typeof contracts];
  if (!strategyAddress) throw new Error(`No strategy found for ${tokenSymbol} on chain ${chainId}`);
  return strategyAddress;
};
