import { ethers } from "ethers";
import { CHAINS, ALL_CHAINS, VAULT_ABI, resolveChainConfig } from "../constants";
import { createProvider } from "../utils";

export class CrossChainService {
  async getUserDepositsAcrossChains(
    userAddress: string,
    options?: { chainId?: number | string | null; chain?: string | null }
  ): Promise<{
    totalValueUSD: number;
    depositsByChain: Record<string, { deposits: any[]; totalUSD: number }>;
  }> {
    const depositsByChain: Record<string, { deposits: any[]; totalUSD: number }> = {};
    let totalValueUSD = 0;

    const resolved = options ? resolveChainConfig(options) : null;
    const chainKeys = resolved ? [resolved.key] : ALL_CHAINS;

    for (const chainKey of chainKeys) {
      const chain = CHAINS[chainKey];
      const provider = createProvider(chain.rpcUrl);
      const deposits: any[] = [];
      let chainTotalUSD = 0;

      for (const [asset, vaultConfig] of Object.entries(chain.vaults)) {
        try {
          const vault = new ethers.Contract(vaultConfig.address, VAULT_ABI, provider);
          const depositCount = await vault.depositCount(userAddress);

          for (let i = 0; i < Number(depositCount); i++) {
            const [shares, principal, depositTime, lockEnd] = await vault.deposits(userAddress, i);
            const amountUSD = parseFloat(
              ethers.formatUnits(principal, vaultConfig.decimals)
            );

            deposits.push({
              depositId: i.toString(),
              vault: vaultConfig.address,
              asset,
              chain: chainKey,
              amountUSD,
              depositTime: Number(depositTime),
              lockEnd: Number(lockEnd),
            });

            chainTotalUSD += amountUSD;
          }
        } catch (error) {
          console.warn(`Failed to fetch ${asset} deposits on ${chainKey}:`, error);
        }
      }

      if (deposits.length > 0) {
        depositsByChain[chainKey] = { deposits, totalUSD: chainTotalUSD };
        totalValueUSD += chainTotalUSD;
      }
    }

    return { totalValueUSD, depositsByChain };
  }
}
