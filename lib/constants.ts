// Vault contract ABI definitions
export const vaultABI = [
  {
    inputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "lockTierId", type: "uint256" },
    ],
    name: "deposit",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Withdrawal method ABI definition
export const withdrawMethodABI = {
  inputs: [{ internalType: "uint256", name: "depositId", type: "uint256" }],
  name: "withdraw",
  outputs: [
    { internalType: "uint256", name: "amountWithdrawn", type: "uint256" },
  ],
  stateMutability: "nonpayable",
  type: "function",
} as const;

// Default lock tier IDs
export const LOCK_TIERS = {
  THIRTY_DAY: 1,
  SIXTY_DAY: 2,
  NINETY_DAY: 3,
};

// Stablecoin symbols by network
export const SUPPORTED_STABLECOINS = {
  // Celo
  42220: ["USDC", "USDT", "CUSD"],
  // Scroll
  534352: ["USDC", "WETH"],
};
