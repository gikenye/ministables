// Chain configurations
export const CHAINS = {
  CELO: {
    id: 42220,
    name: "Celo",
    rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
    contracts: {
      GOAL_MANAGER: "0x449095A0e1f16D8Bcc2D140b9284F8006b931231",
      LEADERBOARD: "0x184196a6b0719c3A9d8F15c912467D7836baf50D",
    },
    vaults: {
      USDC: {
        address: "0xBEEf1612958A90F3553362c74Ccdf4c181512cf5",
        asset: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
        decimals: 6,
      },
      cUSD: {
        address: "0x1077E075c879E8C95E7d0545b106B1448d035F37",
        asset: "0x765de816845861e75a25fca122bb6898b8b1282a",
        decimals: 18,
      },
      USDT: {
        address: "0x90FF972CC2d12Ba495C8aC0887d6E9FD25B032c4",
        asset: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
        decimals: 6,
      },
      cKES: {
        address: "0xfC0a866533ee4B329Cf3843876067C89b5B08479",
        asset: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0",
        decimals: 18,
      },
    },
  },
  BASE: {
    id: 8453,
    name: "Base",
    rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    contracts: {
      GOAL_MANAGER: "0xc546C3AA723f011B55D42665Ea6280C3433321AB",
      LEADERBOARD: "0x21CB6cAfB7e10f72D943Cf731d19D11678635807",
    },
    vaults: {
      USDC: {
        address: "0x2B946CD7F6Ded65E47ae26A7287a9876057518cb",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
      },
    },
  },
} as const;

export type ChainKey = keyof typeof CHAINS;
export type ChainConfig = (typeof CHAINS)[ChainKey];
export type VaultConfig = { address: string; asset: string; decimals: number };
export type VaultMap = Record<string, VaultConfig>;
export type ContractsConfig = ChainConfig["contracts"];

// Use environment variable to select chain for write operations, default to CELO
const DEFAULT_CHAIN_KEY = "CELO";
const rawActiveChain = (process.env.CHAIN || process.env.NEXT_PUBLIC_DEFAULT_CHAIN || DEFAULT_CHAIN_KEY).toUpperCase();
const ACTIVE_CHAIN = (rawActiveChain in CHAINS ? rawActiveChain : DEFAULT_CHAIN_KEY) as keyof typeof CHAINS;

// Export all chains for cross-chain aggregation in read operations
export const ALL_CHAINS = Object.keys(CHAINS) as (keyof typeof CHAINS)[];

// Backward compatibility exports (for write operations)
export const CONTRACTS = CHAINS[ACTIVE_CHAIN].contracts;
export const VAULTS = CHAINS[ACTIVE_CHAIN].vaults;
export const DEFAULT_RPC_URL = CHAINS[ACTIVE_CHAIN].rpcUrl;

const normalizeAddress = (value?: string | null) =>
  value ? value.toLowerCase() : null;

export function getChainConfigById(chainId: number): { key: ChainKey; config: ChainConfig } | null {
  for (const key of Object.keys(CHAINS) as ChainKey[]) {
    const config = CHAINS[key];
    if (config.id === chainId) {
      return { key, config };
    }
  }
  return null;
}

export function getChainConfigByKey(chain: string): { key: ChainKey; config: ChainConfig } | null {
  const normalized = chain.trim();
  if (!normalized) return null;
  const upper = normalized.toUpperCase();
  if (upper in CHAINS) {
    const key = upper as ChainKey;
    return { key, config: CHAINS[key] };
  }
  const lower = normalized.toLowerCase();
  for (const key of Object.keys(CHAINS) as ChainKey[]) {
    if (CHAINS[key].name.toLowerCase() === lower) {
      return { key, config: CHAINS[key] };
    }
  }
  return null;
}

export function findChainByVaultAddress(address: string): { key: ChainKey; config: ChainConfig } | null {
  const target = normalizeAddress(address);
  if (!target) return null;
  for (const key of Object.keys(CHAINS) as ChainKey[]) {
    const config = CHAINS[key];
    for (const vault of Object.values(config.vaults)) {
      if (normalizeAddress(vault.address) === target) {
        return { key, config };
      }
    }
  }
  return null;
}

export function findChainByContractAddress(address: string): { key: ChainKey; config: ChainConfig } | null {
  const target = normalizeAddress(address);
  if (!target) return null;
  for (const key of Object.keys(CHAINS) as ChainKey[]) {
    const config = CHAINS[key];
    if (
      normalizeAddress(config.contracts.GOAL_MANAGER) === target ||
      normalizeAddress(config.contracts.LEADERBOARD) === target
    ) {
      return { key, config };
    }
  }
  return null;
}

export function resolveChainConfig(params: {
  chainId?: number | string | null;
  chain?: string | null;
  vaultAddress?: string | null;
  contractAddress?: string | null;
}): { key: ChainKey; config: ChainConfig } | null {
  if (params.chainId !== undefined && params.chainId !== null && params.chainId !== "") {
    const chainId =
      typeof params.chainId === "string" ? Number(params.chainId) : params.chainId;
    if (Number.isFinite(chainId)) {
      const byId = getChainConfigById(chainId);
      if (byId) return byId;
    }
  }

  if (params.chain) {
    const byKey = getChainConfigByKey(params.chain);
    if (byKey) return byKey;
  }

  if (params.vaultAddress) {
    const byVault = findChainByVaultAddress(params.vaultAddress);
    if (byVault) return byVault;
  }

  if (params.contractAddress) {
    const byContract = findChainByContractAddress(params.contractAddress);
    if (byContract) return byContract;
  }

  return null;
}

export function getContractsForChain(params: {
  chainId?: number | string | null;
  chain?: string | null;
  vaultAddress?: string | null;
  contractAddress?: string | null;
}): ContractsConfig {
  return resolveChainConfig(params)?.config.contracts ?? CONTRACTS;
}

export function getVaultsForChain(params: {
  chainId?: number | string | null;
  chain?: string | null;
  vaultAddress?: string | null;
  contractAddress?: string | null;
}): VaultMap {
  return resolveChainConfig(params)?.config.vaults ?? VAULTS;
}

// Contract ABIs
export { VAULT_ABI, GOAL_MANAGER_ABI, LEADERBOARD_ABI } from "../abis";

// Leaderboard score decimals - based on USDC (6 decimals) as the base scoring unit
export const LEADERBOARD_DECIMALS = 6;
