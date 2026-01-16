// config/offrampConfig.ts
export const OFFRAMP_SETTLEMENT_WALLETS: Record<string, string | undefined> = {
  CELO: process.env.NEXT_PUBLIC_SETTLEMENT_CELO,
  BASE: process.env.NEXT_PUBLIC_SETTLEMENT_BASE
};
