import { getContract } from "thirdweb";
import { client } from "@/lib/thirdweb/client";
import { GOAL_CONTRACTS, LEADERBOARD_CONTRACTS, VAULT_CONTRACTS } from "@/config/chainConfig";
import type { Chain } from "thirdweb/chains";

export const GOAL_MANAGER_ABI = [
  "function createGoal(address vault, uint256 targetAmount, uint256 targetDate, string calldata metadataURI) external returns (uint256 goalId)",
  "function attachDeposits(uint256 goalId, uint256[] calldata depositIds) external",
  "function transferDeposit(uint256 fromGoalId, uint256 toGoalId, uint256 depositId) external",
  "function getQuicksaveGoal(address vault, address user) external view returns (uint256)",
  "function goals(uint256 goalId) external view returns (tuple(uint256 id, address creator, address vault, uint256 targetAmount, uint256 targetDate, string metadataURI, uint256 createdAt, bool cancelled, bool completed))",
  "function getGoalProgressFull(uint256 goalId) external view returns (uint256 totalValue, uint256 percentBps)",
  "function attachmentCount(uint256 goalId) external view returns (uint256)",
  "function attachmentAt(uint256 goalId, uint256 index) external view returns (tuple(address owner, uint256 depositId, uint256 attachedAt, bool pledged))",
  "event GoalCreated(uint256 indexed goalId, address indexed creator, address indexed vault, uint256 targetAmount, uint256 targetDate, string metadataURI)",
  "event DepositAttached(uint256 indexed goalId, address indexed owner, uint256 indexed depositId, uint256 attachedAt)",
  "event DepositDetached(uint256 indexed goalId, address indexed owner, uint256 indexed depositId, uint256 detachedAt)"
] as const;

export const LEADERBOARD_ABI = [
  "function getUserScore(address user) external view returns (uint256)",
  "function getTopListLength() external view returns (uint256)",
  "function getTopRange(uint256 start, uint256 end) external view returns (address[] memory users, uint256[] memory userScores)"
] as const;

export const VAULT_ABI = [
  "function deposit(uint256 amount, uint256 lockTierId) external returns (uint256 depositId)",
  "function getUserDeposit(address user, uint256 depositId) external view returns (uint256 principal, uint256 currentValue, uint256 yieldEarned, uint256 lockEnd, bool canWithdraw)",
  "function asset() external view returns (address)",
  "event Deposited(address indexed user, uint256 indexed depositId, uint256 amount, uint256 shares, uint256 lockTier)"
] as const;

export function getGoalManagerContract(chain: Chain) {
  const address = GOAL_CONTRACTS[chain.id];
  if (!address) throw new Error(`GoalManager not deployed on chain ${chain.id}`);
  
  return getContract({
    client,
    chain,
    address,
    abi: GOAL_MANAGER_ABI,
  });
}

export function getLeaderboardContract(chain: Chain) {
  const address = LEADERBOARD_CONTRACTS[chain.id];
  if (!address) throw new Error(`Leaderboard not deployed on chain ${chain.id}`);
  
  return getContract({
    client,
    chain,
    address,
    abi: LEADERBOARD_ABI,
  });
}

export function getVaultContract(chain: Chain, tokenSymbol: string) {
  const vaults = VAULT_CONTRACTS[chain.id];
  if (!vaults) throw new Error(`No vaults deployed on chain ${chain.id}`);
  
  const address = vaults[tokenSymbol.toUpperCase() as keyof typeof vaults];
  if (!address) throw new Error(`No vault for ${tokenSymbol} on chain ${chain.id}`);
  
  return getContract({
    client,
    chain,
    address,
    abi: VAULT_ABI,
  });
}

export interface ContractGoal {
  id: bigint;
  creator: string;
  vault: string;
  targetAmount: bigint;
  targetDate: bigint;
  metadataURI: string;
  createdAt: bigint;
  cancelled: boolean;
  completed: boolean;
}

export interface ContractAttachment {
  owner: string;
  depositId: bigint;
  attachedAt: bigint;
  pledged: boolean;
}

export interface GoalProgress {
  totalValue: bigint;
  percentBps: bigint;
}