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
export const VAULT_ABI = [
  "function allocateOnrampDeposit(address user, uint256 amount, bytes32 txHash) external returns (uint256)",
  "function deposits(address user, uint256 index) external view returns (uint256 shares, uint256 principal, uint256 depositTime, uint256 lockEnd, bool pledgedAsCollateral)",
  "function depositCount(address user) external view returns (uint256)",
  "event OnrampDeposit(address indexed user, uint256 indexed depositId, uint256 amount, uint256 shares, bytes32 indexed txHash)",
  "event Deposited(address indexed user, uint256 indexed depositId, uint256 amount, uint256 shares, uint256 lockTier)",
];

export const GOAL_MANAGER_ABI = [
  "function getQuicksaveGoal(address vault, address user) external view returns (uint256)",
  "function createGoal(address vault, uint256 targetAmount, uint256 targetDate, string calldata metadataURI) external returns (uint256)",
  "function createGoalFor(address creator, address vault, uint256 targetAmount, uint256 targetDate, string calldata metadataURI) external returns (uint256)",
  "function createQuicksaveGoalFor(address user, address vault) external returns (uint256)",
  "function attachDeposits(uint256 goalId, uint256[] calldata depositIds) external",
  "function cancelGoal(uint256 goalId) external",
  "function attachDepositsOnBehalf(uint256 goalId, address owner, uint256[] calldata depositIds) external",
  "function forceAddMember(uint256 goalId, address member) external",
  "function forceRemoveMember(uint256 goalId, address member) external",
  "function goals(uint256) external view returns (uint256 id, address creator, address vault, uint256 targetAmount, uint256 targetDate, string metadataURI, uint256 createdAt, bool cancelled, bool completed)",
  "function getGoalProgressFull(uint256 goalId) external view returns (uint256 totalValue, uint256 percentBps)",
  "function attachmentCount(uint256 goalId) external view returns (uint256)",
  "function attachmentAt(uint256 goalId, uint256 index) external view returns (tuple(address owner, uint256 depositId, uint256 attachedAt, bool pledged))",
  "function depositToGoal(bytes32 key) external view returns (uint256)",
  "event GoalCreated(uint256 indexed goalId, address indexed creator, address indexed vault, uint256 targetAmount, uint256 targetDate, string metadataURI)",
  "event DepositAttached(uint256 indexed goalId, address indexed owner, uint256 indexed depositId, uint256 attachedAt)",
  "event DepositDetached(uint256 indexed goalId, address indexed owner, uint256 indexed depositId, uint256 detachedAt)",
  "event AttachmentPledged(uint256 indexed goalId, address indexed owner, uint256 indexed depositId)",
  "event GoalCompleted(uint256 indexed goalId, uint256 completedAt, uint256 totalValue)",
  "event MemberInvited(uint256 indexed goalId, address indexed inviter, address indexed invitee)",
  "event InviteRevoked(uint256 indexed goalId, address indexed revoker, address indexed invitee)",
  "event MemberJoined(uint256 indexed goalId, address indexed member)",
  "event MemberRemoved(uint256 indexed goalId, address indexed member)",
  "event GoalCancelled(uint256 indexed goalId)",

];

export const LEADERBOARD_ABI = [
  "function recordDepositOnBehalf(address user, uint256 amount) external",
  "function getUserScore(address user) external view returns (uint256)",
  "function getTopListLength() external view returns (uint256)",
  "function getTopRange(uint256 start, uint256 end) external view returns (address[] users, uint256[] userScores)",
  "function scores(address user) external view returns (uint256)",
  "function topList(uint256 index) external view returns (address)",
];

// Leaderboard score decimals - based on USDC (6 decimals) as the base scoring unit
export const LEADERBOARD_DECIMALS = 6;
