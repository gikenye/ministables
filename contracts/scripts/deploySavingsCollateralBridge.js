const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying SavingsCollateralBridge...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Configuration - Update these addresses for your deployment
  const MINISTABLES_ADDRESS = process.env.MINISTABLES_ADDRESS || "0x..."; // SupplierVault address
  const ORACLES_ADDRESS = process.env.ORACLES_ADDRESS || "0x..."; // SortedOracles address
  const LIQUIDATOR_ADDRESS = process.env.LIQUIDATOR_ADDRESS || deployer.address; // Default to deployer

  console.log("\nDeployment Configuration:");
  console.log("Ministables (SupplierVault):", MINISTABLES_ADDRESS);
  console.log("Oracles:", ORACLES_ADDRESS);
  console.log("Liquidator:", LIQUIDATOR_ADDRESS);

  // Validate addresses
  if (MINISTABLES_ADDRESS === "0x..." || ORACLES_ADDRESS === "0x...") {
    throw new Error("Please set MINISTABLES_ADDRESS and ORACLES_ADDRESS in environment variables");
  }

  // Deploy SavingsCollateralBridge
  console.log("\n1. Deploying SavingsCollateralBridge...");
  const SavingsCollateralBridge = await ethers.getContractFactory("SavingsCollateralBridge");
  const bridge = await SavingsCollateralBridge.deploy(MINISTABLES_ADDRESS, ORACLES_ADDRESS);
  await bridge.deployed();
  console.log("✓ SavingsCollateralBridge deployed to:", bridge.address);

  // Grant bridge role to the bridge contract
  console.log("\n2. Granting BRIDGE_ROLE to SavingsCollateralBridge...");
  const ministables = await ethers.getContractAt("Ministables", MINISTABLES_ADDRESS);
  
  try {
    const tx = await ministables.grantBridgeRole(bridge.address);
    await tx.wait();
    console.log("✓ BRIDGE_ROLE granted. Transaction:", tx.hash);
  } catch (error) {
    console.error("✗ Failed to grant BRIDGE_ROLE:", error.message);
    console.log("You may need to grant the role manually as the owner");
  }

  // Grant liquidator role
  console.log("\n3. Granting LIQUIDATOR_ROLE...");
  const LIQUIDATOR_ROLE = await bridge.LIQUIDATOR_ROLE();
  
  try {
    const tx = await bridge.grantRole(LIQUIDATOR_ROLE, LIQUIDATOR_ADDRESS);
    await tx.wait();
    console.log("✓ LIQUIDATOR_ROLE granted to:", LIQUIDATOR_ADDRESS);
    console.log("  Transaction:", tx.hash);
  } catch (error) {
    console.error("✗ Failed to grant LIQUIDATOR_ROLE:", error.message);
  }

  // Verify deployment
  console.log("\n4. Verifying deployment...");
  const supplierVault = await bridge.supplierVault();
  const oracles = await bridge.oracles();
  const savingsLtv = await bridge.SAVINGS_LTV();
  
  console.log("✓ Verification successful:");
  console.log("  SupplierVault:", supplierVault);
  console.log("  Oracles:", oracles);
  console.log("  Savings LTV:", savingsLtv.toString() + "%");

  // Output deployment info
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log("\nContract Addresses:");
  console.log("  SavingsCollateralBridge:", bridge.address);
  console.log("  Ministables (SupplierVault):", MINISTABLES_ADDRESS);
  console.log("  Oracles:", ORACLES_ADDRESS);
  console.log("\nRoles:");
  console.log("  Admin:", deployer.address);
  console.log("  Liquidator:", LIQUIDATOR_ADDRESS);
  console.log("\nConfiguration:");
  console.log("  LTV Ratio:", savingsLtv.toString() + "%");
  console.log("=".repeat(60));

  // Save deployment info to file
  const fs = require("fs");
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      savingsCollateralBridge: bridge.address,
      ministables: MINISTABLES_ADDRESS,
      oracles: ORACLES_ADDRESS,
    },
    roles: {
      admin: deployer.address,
      liquidator: LIQUIDATOR_ADDRESS,
    },
    configuration: {
      ltv: savingsLtv.toString(),
    },
  };

  const filename = `savings-collateral-bridge-deployment-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n✓ Deployment info saved to:", filename);

  // Next steps
  console.log("\n" + "=".repeat(60));
  console.log("NEXT STEPS");
  console.log("=".repeat(60));
  console.log("1. Verify contract on block explorer:");
  console.log("   npx hardhat verify --network <network> " + bridge.address + " " + MINISTABLES_ADDRESS + " " + ORACLES_ADDRESS);
  console.log("\n2. Test the deployment:");
  console.log("   - Deposit funds in Ministables");
  console.log("   - Wait for lock period to expire");
  console.log("   - Pledge deposits as collateral");
  console.log("   - Check collateral value");
  console.log("\n3. Integrate with BorrowerVault:");
  console.log("   - Add SAVINGS collateral type");
  console.log("   - Query bridge for collateral values");
  console.log("   - Implement liquidation with savings collateral");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
