import { resolveChainConfig, type ChainKey } from "@/lib/backend/constants";
import type { MetaGoal, VaultAsset } from "@/lib/backend/types";

export type ChainParams = {
  chainId?: string | number | null;
  chain?: string | null;
  vaultAddress?: string | null;
  contractAddress?: string | null;
};

export function resolveChainKey(params: ChainParams): ChainKey | null {
  return resolveChainConfig(params)?.key ?? null;
}

export function getGoalsForChain(
  metaGoal: MetaGoal,
  chainKey?: ChainKey | null
): Partial<Record<VaultAsset, string>> {
  if (chainKey && metaGoal.onChainGoalsByChain?.[chainKey]) {
    return metaGoal.onChainGoalsByChain[chainKey] || {};
  }
  return metaGoal.onChainGoals || {};
}

export function setGoalsForChain(
  metaGoal: MetaGoal,
  chainKey: ChainKey | null,
  goals: Partial<Record<VaultAsset, string>>
): MetaGoal {
  if (!chainKey) {
    metaGoal.onChainGoals = goals;
    return metaGoal;
  }
  metaGoal.onChainGoalsByChain = {
    ...(metaGoal.onChainGoalsByChain || {}),
    [chainKey]: goals,
  };
  metaGoal.onChainGoals = goals;
  return metaGoal;
}

export function setGoalForChain(
  metaGoal: MetaGoal,
  chainKey: ChainKey | null,
  asset: VaultAsset,
  goalId: string
): MetaGoal {
  const current = getGoalsForChain(metaGoal, chainKey);
  const next = { ...current, [asset]: goalId };
  return setGoalsForChain(metaGoal, chainKey, next);
}

export function getAllGoals(metaGoal: MetaGoal): Array<{
  chainKey?: ChainKey;
  asset: VaultAsset;
  goalId: string;
}> {
  if (metaGoal.onChainGoalsByChain) {
    const entries: Array<{
      chainKey?: ChainKey;
      asset: VaultAsset;
      goalId: string;
    }> = [];
    for (const [chainKey, assetMap] of Object.entries(
      metaGoal.onChainGoalsByChain
    )) {
      for (const [asset, goalId] of Object.entries(assetMap || {})) {
        if (!goalId) continue;
        entries.push({
          chainKey: chainKey as ChainKey,
          asset: asset as VaultAsset,
          goalId: goalId as string,
        });
      }
    }
    if (entries.length > 0) return entries;
  }

  return Object.entries(metaGoal.onChainGoals || {})
    .filter(([, goalId]) => !!goalId)
    .map(([asset, goalId]) => ({
      asset: asset as VaultAsset,
      goalId: goalId as string,
    }));
}
