import { NextRequest, NextResponse } from "next/server";
import { VaultMonitoringService } from "@/lib/services/vaultMonitoringService";
import {
  CHAINS,
  hasVaultContracts,
  getVaultAddress,
  VAULT_CONTRACTS,
} from "@/config/chainConfig";

/**
 * POST /api/goals/vault-sync
 * Manually trigger vault state synchronization with goal progress
 * This endpoint can be called to sync smart contract events with the goal backend
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainId, tokenSymbol, userAddress } = body;

    if (!chainId) {
      return NextResponse.json(
        { error: "Chain ID is required" },
        { status: 400 }
      );
    }

    // Validate that the chain supports vault contracts
    if (!hasVaultContracts(chainId)) {
      return NextResponse.json(
        { error: `Chain ${chainId} does not support vault contracts` },
        { status: 400 }
      );
    }

    // Get the appropriate chain object from our supported chains
    const chain = CHAINS.find((c) => c.id === chainId);
    if (!chain) {
      return NextResponse.json(
        { error: `Unsupported chain ID: ${chainId}` },
        { status: 400 }
      );
    }

    if (tokenSymbol) {
      // Sync specific token vault
      await VaultMonitoringService.syncVaultStateWithGoals(
        chain,
        tokenSymbol,
        userAddress
      );

      return NextResponse.json({
        message: `Successfully synced vault state for ${tokenSymbol} on chain ${chainId}`,
        chainId,
        tokenSymbol,
        userAddress,
      });
    } else {
      // Sync all vaults on the chain
      await VaultMonitoringService.monitorAllVaultsOnChain(chain);

      return NextResponse.json({
        message: `Successfully synced all vault states on chain ${chainId}`,
        chainId,
      });
    }
  } catch (error) {
    console.error("Error syncing vault state:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to sync vault state" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/goals/vault-sync?chainId=42220&tokenSymbol=USDC
 * Get last processed block information for vault monitoring
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainIdParam = searchParams.get("chainId");
    const tokenSymbol = searchParams.get("tokenSymbol");

    if (!chainIdParam) {
      return NextResponse.json(
        { error: "Chain ID is required" },
        { status: 400 }
      );
    }

    const chainId = parseInt(chainIdParam);

    if (tokenSymbol) {
      // Get specific vault info
      const vaultAddress = getVaultAddress(chainId, tokenSymbol);
      const lastProcessedBlock =
        await VaultMonitoringService.getLastProcessedBlock(
          chainId,
          vaultAddress
        );

      return NextResponse.json({
        chainId,
        tokenSymbol,
        vaultAddress,
        lastProcessedBlock: lastProcessedBlock.toString(),
      });
    } else {
      // Get all vault info for chain
      const vaultContracts = VAULT_CONTRACTS[chainId];

      if (!vaultContracts) {
        return NextResponse.json(
          { error: `No vault contracts found for chain ${chainId}` },
          { status: 404 }
        );
      }

      const vaultInfo = await Promise.all(
        Object.entries(vaultContracts).map(async ([symbol, address]) => {
          const lastProcessedBlock =
            await VaultMonitoringService.getLastProcessedBlock(
              chainId,
              address as string
            );

          return {
            tokenSymbol: symbol,
            vaultAddress: address,
            lastProcessedBlock: lastProcessedBlock.toString(),
          };
        })
      );

      return NextResponse.json({
        chainId,
        vaults: vaultInfo,
      });
    }
  } catch (error) {
    console.error("Error getting vault sync info:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to get vault sync info" },
      { status: 500 }
    );
  }
}
