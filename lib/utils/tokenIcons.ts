// Token icon mapping for all supported stablecoins
export const TOKEN_ICONS: Record<string, string> = {
  USDC: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png",
  USDT: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png",
  cUSD: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/6807f9a4185658fa6e759a27_Tokens.avif",
  CELO: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/6807f9a4185658fa6e759a27_Tokens.avif",
  cKES: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/68094e158b4206fbeba352aa_Tokens-3.avif",
  cNGN: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/6818d1976757a7c20485226f_Tokens%20(2).avif",
  Bkes: "/bpesa.jpg",

  // cEUR: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/68094dba7f0b2df3128d32b9_Tokens-1.avif",
  // cJPY: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/6818d1808fb46021b183d514_Tokens.avif",
  // cCHF: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/6818f6c260ae78f232451882_Tokens%20(4).avif",
  // cREAL: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/68094dd87de568a10dc9dee9_Tokens-2.avif",
  // PUSO: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/68094e4b2ace92471300f47e_Tokens-4.avif",
  // cCOP: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/6809503d3a1aaca00c33a8c6_Tokens.avif",
  // eXOF: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/6809507c17688df160cdfc4d_Tokens-1.png",
  // USDGLO: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/68094e4b2ace92471300f47e_Tokens-4.avif",
  // cGHS: "https://cdn.prod.website-files.com/6807f97b456d6dff3e784225/68094e158b4206fbeba352aa_Tokens-3.avif",
};

/**
 * Get the icon URL for a token symbol
 * @param symbol - Token symbol (e.g., "USDC", "cUSD")
 * @returns Icon URL or fallback emoji
 */
export const getTokenIcon = (symbol: string): string => {

  return TOKEN_ICONS[symbol] || "💱";
};