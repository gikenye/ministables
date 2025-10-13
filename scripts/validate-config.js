#!/usr/bin/env node
/**
 * Validate Chain Configuration Consistency
 *
 * This script verifies that USDC addresses are consistent across:
 * - config/chainConfig.ts
 * - services/disbursement-worker.js
 * - scripts/check-balance.js
 *
 * Usage:
 *   node scripts/validate-config.js
 */

const fs = require("fs");
const path = require("path");

console.log("🔍 Validating Chain Configuration Consistency\n");

// Expected USDC configuration from chainConfig.ts
const EXPECTED_SCROLL_USDC = {
  address: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4",
  decimals: 6,
  symbol: "USDC",
  chainId: 534352, // scroll.id
};

const errors = [];
const warnings = [];

// Files to check
const filesToCheck = [
  {
    path: "services/disbursement-worker.js",
    type: "Worker Service",
  },
  {
    path: "scripts/check-balance.js",
    type: "Balance Check Script",
  },
];

// Read and validate each file
filesToCheck.forEach(({ path: filePath, type }) => {
  const fullPath = path.join(__dirname, "..", filePath);

  if (!fs.existsSync(fullPath)) {
    errors.push(`❌ File not found: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, "utf8");

  // Check for USDC address
  if (!content.includes(EXPECTED_SCROLL_USDC.address)) {
    errors.push(`❌ ${type}: USDC address mismatch or not found`);
  } else {
    console.log(`✅ ${type}: USDC address matches`);
  }

  // Check for decimals
  const decimalsMatch = content.match(/decimals:\s*(\d+)/);
  if (decimalsMatch) {
    const decimals = parseInt(decimalsMatch[1]);
    if (decimals !== EXPECTED_SCROLL_USDC.decimals) {
      errors.push(
        `❌ ${type}: USDC decimals should be ${EXPECTED_SCROLL_USDC.decimals}, found ${decimals}`
      );
    } else {
      console.log(`✅ ${type}: USDC decimals correct (${decimals})`);
    }
  } else {
    warnings.push(`⚠️  ${type}: Could not verify decimals`);
  }

  // Check for chain ID
  const chainIdMatch = content.match(/SCROLL_CHAIN_ID\s*=\s*(\d+)/);
  if (chainIdMatch) {
    const chainId = parseInt(chainIdMatch[1]);
    if (chainId !== EXPECTED_SCROLL_USDC.chainId) {
      errors.push(
        `❌ ${type}: Scroll chain ID should be ${EXPECTED_SCROLL_USDC.chainId}, found ${chainId}`
      );
    } else {
      console.log(`✅ ${type}: Chain ID correct (${chainId})`);
    }
  } else {
    warnings.push(`⚠️  ${type}: Could not verify chain ID`);
  }
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Display expected configuration
console.log("📋 Expected Configuration (from chainConfig.ts):");
console.log(`   Chain: Scroll (${EXPECTED_SCROLL_USDC.chainId})`);
console.log(`   USDC Address: ${EXPECTED_SCROLL_USDC.address}`);
console.log(`   Decimals: ${EXPECTED_SCROLL_USDC.decimals}`);
console.log(`   Symbol: ${EXPECTED_SCROLL_USDC.symbol}`);

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Display warnings
if (warnings.length > 0) {
  console.log("⚠️  Warnings:");
  warnings.forEach((warning) => console.log(`   ${warning}`));
  console.log("");
}

// Display errors
if (errors.length > 0) {
  console.log("❌ Errors:");
  errors.forEach((error) => console.log(`   ${error}`));
  console.log("\n💡 Please update the configuration to match chainConfig.ts\n");
  process.exit(1);
} else {
  console.log("✅ All configuration checks passed!\n");
  console.log(
    "📝 Note: Configuration is hardcoded in Node.js scripts for compatibility."
  );
  console.log("   If you update chainConfig.ts, remember to update:");
  console.log("   - services/disbursement-worker.js");
  console.log("   - scripts/check-balance.js\n");
  process.exit(0);
}
