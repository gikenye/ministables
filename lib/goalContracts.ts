import { getContract } from "thirdweb";
import { client } from "@/lib/thirdweb/client";
import { GOAL_CONTRACTS, LEADERBOARD_CONTRACTS, VAULT_CONTRACTS } from "@/config/chainConfig";
import { GOAL_MANAGER_ABI, LEADERBOARD_ABI, VAULT_ABI } from "@/lib/abis";
import type { Chain } from "thirdweb/chains";

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
