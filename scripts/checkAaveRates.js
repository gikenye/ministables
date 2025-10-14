// Script to check raw Aave APY rates directly from Aave Pool
const AAVE_POOL = "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402"; // CORRECT Aave Pool from strategies
const RPC_URL = "https://forno.celo.org";

const TOKENS = {
  USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
  USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  CUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
};

async function getAaveRate(tokenAddress, tokenSymbol) {
  // getReserveData(address) selector: 0x35ea6a75
  const selector = "0x35ea6a75";
  const paddedAddress = tokenAddress.slice(2).padStart(64, "0");
  const callData = selector + paddedAddress;

  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          to: AAVE_POOL,
          data: callData,
        },
        "latest",
      ],
      id: 1,
    }),
  });

  const data = await response.json();

  console.log(`\n📊 ${tokenSymbol}:`);
  console.log(`   Token: ${tokenAddress}`);

  if (data.error) {
    console.log(`   ❌ Error: ${data.error.message}`);
    return null;
  }

  if (data.result && data.result !== "0x" && data.result.length > 194) {
    const hex = data.result;
    
    // Parse the tuple returned by getReserveData:
    // 0-64: configuration (uint256) - 64 hex chars
    // 64-96: liquidityIndex (uint128) - 32 hex chars (padded to 64)
    // 96-128: currentLiquidityRate (uint128) - 32 hex chars (padded to 64) <- THIS IS WHAT WE WANT
    
    // Skip "0x" (2) + config (64) + liquidityIndex (64) = 130
    const liquidityRateHex = "0x" + hex.slice(130, 194);
    const liquidityRate = BigInt(liquidityRateHex);
    
    // Rates are in Ray (1e27), convert to percentage
    const supplyAPY = Number(liquidityRate) / 1e25;

    console.log(`   Raw Hex: ${liquidityRateHex}`);
    console.log(`   Raw Value: ${liquidityRate.toString()}`);
    console.log(`   ✅ Supply APY: ${supplyAPY.toFixed(4)}%`);

    return supplyAPY;
  } else {
    console.log(`   ⚠️  No valid result returned`);
  }

  return null;
}

async function main() {
  console.log("🔍 Fetching raw Aave V3 APY rates from Celo...");
  console.log("=" .repeat(60));

  for (const [symbol, address] of Object.entries(TOKENS)) {
    await getAaveRate(address, symbol);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n✅ Done! These are BASE APY rates from Aave V3.");
  console.log("\nLock boosts will be added on top:");
  console.log("  - No lock: +0%");
  console.log("  - 30 days: +0.5%");
  console.log("  - 90 days: +2%");
  console.log("  - 180 days: +5%");
}

main().catch(console.error);
