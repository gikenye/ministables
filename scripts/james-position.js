const { ethers } = require("hardhat");

const VAULTS = [
  { name: "USDC", vault: "0xBEEf1612958A90F3553362c74Ccdf4c181512cf5", strategy: "0xcc53D95d1D65DBAFc204A532e6a5e065764869e1", decimals: 6 },
  { name: "cUSD", vault: "0x1077E075c879E8C95E7d0545b106B1448d035F37", strategy: "0xa97bA56C318694E1C08EdE9D8e2f0BDf16cebE21", decimals: 18 },
  { name: "USDT", vault: "0x90FF972CC2d12Ba495C8aC0887d6E9FD25B032c4", strategy: "0xc031F072AB12A0D26Ed513E727352Ee281B5A559", decimals: 6 },
];

async function main() {
  const [james] = await ethers.getSigners();
  console.log("👤 User:", james.address);
  console.log("=".repeat(60));

  let grandTotalPrincipal = 0;
  let grandTotalValue = 0;
  let grandTotalYield = 0;

  for (const config of VAULTS) {
    const vault = await ethers.getContractAt("SupplierVault", config.vault);
    const assetAddress = await vault.asset();
    const asset = await ethers.getContractAt("IERC20", assetAddress);
    
    const walletBalance = await asset.balanceOf(james.address);
    const depositCount = await vault.depositCount(james.address);

    console.log(`\n\n💎 ${config.name}`);
    console.log("─".repeat(60));
    console.log(`Wallet: ${ethers.formatUnits(walletBalance, config.decimals)} ${config.name}`);
    console.log(`Deposits: ${depositCount}`);
    
    if (depositCount === 0n && walletBalance === 0n) continue;

    let totalPrincipal = 0n;
    let totalCurrentValue = 0n;
    let totalYield = 0n;

    for (let i = 0; i < depositCount; i++) {
      try {
        const deposit = await vault.getUserDeposit(james.address, i);
        if (deposit.principal > 0) {
          console.log(`\n  #${i}: ${ethers.formatUnits(deposit.principal, config.decimals)} → ${ethers.formatUnits(deposit.currentValue, config.decimals)} ${config.name} (+${ethers.formatUnits(deposit.yieldEarned, config.decimals)}) ${deposit.canWithdraw ? "✅" : "🔒"}`);
          totalPrincipal += deposit.principal;
          totalCurrentValue += deposit.currentValue;
          totalYield += deposit.yieldEarned;
        }
      } catch (e) {}
    }

    if (config.strategy) {
      try {
        const strategy = await ethers.getContractAt("AaveStrategy", config.strategy);
        const deployed = await strategy.totalDeployed();
        const harvested = await strategy.totalYieldHarvested();
        console.log(`\n  Aave: ${ethers.formatUnits(deployed, config.decimals)} deployed, ${ethers.formatUnits(harvested, config.decimals)} harvested`);
      } catch (e) {}
    }

    if (totalPrincipal > 0) {
      console.log(`\n  Total: ${ethers.formatUnits(totalPrincipal, config.decimals)} → ${ethers.formatUnits(totalCurrentValue, config.decimals)} ${config.name}`);
      console.log(`  Yield: ${ethers.formatUnits(totalYield, config.decimals)} ${config.name} (${((Number(totalYield) / Number(totalPrincipal)) * 100).toFixed(4)}%)`);
      
      grandTotalPrincipal += Number(ethers.formatUnits(totalPrincipal, config.decimals));
      grandTotalValue += Number(ethers.formatUnits(totalCurrentValue, config.decimals));
      grandTotalYield += Number(ethers.formatUnits(totalYield, config.decimals));
    }
  }

  console.log("\n\n" + "=".repeat(60));
  console.log("📈 TOTAL POSITION");
  console.log("=".repeat(60));
  console.log(`Principal: $${grandTotalPrincipal.toFixed(6)}`);
  console.log(`Value:     $${grandTotalValue.toFixed(6)}`);
  console.log(`Yield:     $${grandTotalYield.toFixed(6)} (${grandTotalPrincipal > 0 ? ((grandTotalYield / grandTotalPrincipal) * 100).toFixed(4) : 0}%)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
