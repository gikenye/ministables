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
  // onChainGoals is a global fallback; do not overwrite it on per-chain writes
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
  const onChainGoalsByChain = metaGoal.onChainGoalsByChain;
  const onChainGoals = metaGoal.onChainGoals;
  const entries: Array<{
    chainKey?: ChainKey;
    asset: VaultAsset;
    goalId: string;
  }> = [];

  if (onChainGoalsByChain) {
    for (const [chainKey, assetMap] of Object.entries(onChainGoalsByChain)) {
      for (const [asset, goalId] of Object.entries(assetMap || {})) {
        if (!goalId) continue;
        entries.push({
          chainKey: chainKey as ChainKey,
          asset: asset as VaultAsset,
          goalId: goalId as string,
        });
      }
    }
  }

  for (const [asset, goalId] of Object.entries(onChainGoals || {})) {
    if (!goalId) continue;
    entries.push({
      asset: asset as VaultAsset,
      goalId: goalId as string,
    });
  }

  const seen = new Set<string>();
  const deduped: typeof entries = [];
  for (const entry of entries) {
    if (seen.has(entry.goalId)) continue;
    seen.add(entry.goalId);
    deduped.push(entry);
  }
  return deduped;
}
