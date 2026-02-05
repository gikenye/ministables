import { NextRequest, NextResponse } from "next/server";
import { GoalSyncService } from "@/lib/backend/services/goal-sync.service";
import { getContractsForChain, getVaultsForChain } from "@/lib/backend/constants";
import { createProvider, isValidAddress } from "@/lib/backend/utils";
import type { ErrorResponse } from "@/lib/backend/types";

export async function POST(request: NextRequest): Promise<NextResponse<{ success: boolean; synced: number; goalIds?: string[] } | ErrorResponse>> {
  try {
    const body = await request.json();
    const { userAddress, goalId, fromBlock, chainId, chain } = body;
    const chainParams = { chainId, chain };

    if (goalId) {
      if (typeof goalId !== "string" || goalId.trim() === "") {
        return NextResponse.json({ error: "Invalid goalId: must be a non-empty string" }, { status: 400 });
      }

      const provider = createProvider(chainParams);
      const contracts = getContractsForChain(chainParams);
      const vaults = getVaultsForChain(chainParams);
      const syncService = new GoalSyncService(provider, contracts, vaults);
      const result = await syncService.syncGoalFromChain(goalId.trim());
      
      return NextResponse.json({
        success: !!result,
        synced: result ? 1 : 0
      });
    }

    if (userAddress) {
      if (!isValidAddress(userAddress)) {
        return NextResponse.json({ error: "Invalid user address" }, { status: 400 });
      }

      let validatedFromBlock = -5000;
      if (fromBlock !== undefined) {
        const parsed = Number(fromBlock);
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
          return NextResponse.json({ error: "Invalid fromBlock: must be an integer" }, { status: 400 });
        }
        validatedFromBlock = parsed;
      }

      const provider = createProvider(chainParams);
      const contracts = getContractsForChain(chainParams);
      const vaults = getVaultsForChain(chainParams);
      const syncService = new GoalSyncService(provider, contracts, vaults);
      const discoveredGoalIds = await syncService.discoverUserGoalsFromEvents(userAddress, validatedFromBlock);
      await syncService.syncUserGoals(userAddress);
      
      return NextResponse.json({ 
        success: true, 
        synced: discoveredGoalIds.length,
        goalIds: discoveredGoalIds
      });
    }

    return NextResponse.json({ error: "Provide goalId or userAddress" }, { status: 400 });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
