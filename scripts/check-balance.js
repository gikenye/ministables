#!/usr/bin/env node
/**
 * Check Settlement Wallet Balance
 *
 * This script checks the USDC and ETH balance of the settlement wallet
 * and alerts if balance is below threshold.
 *
 * Usage:
 *   node scripts/check-balance.js
 */

const { ethers } = require("ethers");
require("dotenv").config();

const SETTLEMENT_SECRET = process.env.SETTLEMENT_SECRET;

// Scroll chain ID and USDC configuration
// Source: config/chainConfig.ts -> TOKENS[scroll.id] -> USDC
// Note: Hardcoded here for Node.js compatibility (script runs outside Next.js)
const SCROLL_CHAIN_ID = 534352; // scroll.id
const SCROLL_USDC_CONFIG = {
  address: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4", // Must match chainConfig.ts
  decimals: 6,
  symbol: "USDC",
};

const USDC_ADDRESS = SCROLL_USDC_CONFIG.address;
const USDC_DECIMALS = SCROLL_USDC_CONFIG.decimals;
const MIN_USDC_THRESHOLD = 10;
const MIN_ETH_THRESHOLD = 0.000001;

const SCROLL_RPC = "https://rpc.scroll.io";

const usdcAbi = ["function balanceOf(address owner) view returns (uint256)"];

async function checkBalance() {
  if (!SETTLEMENT_SECRET) {
    console.error("❌ SETTLEMENT_SECRET not configured");
    process.exit(1);
  }

  try {
    const provider = new ethers.providers.JsonRpcProvider(SCROLL_RPC);
    const wallet = new ethers.Wallet(SETTLEMENT_SECRET, provider);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, provider);

    console.log("💳 Settlement Wallet Address:", wallet.address);
    console.log("━".repeat(60));

    // Check ETH balance
    const ethBalance = await provider.getBalance(wallet.address);
    const ethFormatted = ethers.utils.formatEther(ethBalance);
    console.log(`⛽ ETH Balance: ${ethFormatted} ETH`);

    if (parseFloat(ethFormatted) < MIN_ETH_THRESHOLD) {
      console.error(
        `🚨 WARNING: ETH balance below ${MIN_ETH_THRESHOLD} ETH threshold!`
      );
    } else {
      console.log(`✅ ETH balance sufficient`);
    }

    // Check USDC balance
    const usdcBalance = await usdcContract.balanceOf(wallet.address);
    const usdcFormatted = ethers.utils.formatUnits(usdcBalance, USDC_DECIMALS);
    console.log(`💵 USDC Balance: ${usdcFormatted} USDC`);

    if (parseFloat(usdcFormatted) < MIN_USDC_THRESHOLD) {
      console.error(
        `🚨 WARNING: USDC balance below ${MIN_USDC_THRESHOLD} USDC threshold!`
      );
      console.error(`   Please top up the settlement wallet immediately!`);
    } else {
      console.log(`✅ USDC balance sufficient`);
    }

    // Estimate how many transactions can be processed
    const avgTransactionUSDC = 0.076; // Average USDC per transaction
    const estimatedTransactions = Math.floor(
      parseFloat(usdcFormatted) / avgTransactionUSDC
    );
    console.log("━".repeat(60));
    console.log(
      `📊 Estimated Remaining Transactions: ~${estimatedTransactions}`
    );
    console.log(
      `   (Based on ${avgTransactionUSDC} USDC average per transaction)`
    );

    // Check for pending jobs
    const { MongoClient } = require("mongodb");
    const MONGODB_URI = process.env.MONGODB_URI;

    if (MONGODB_URI) {
      const mongoClient = new MongoClient(MONGODB_URI);
      await mongoClient.connect();
      const db = mongoClient.db("ministables");

      const pendingCount = await db
        .collection("disbursement_queue")
        .countDocuments({ status: "pending" });
      const failedCount = await db
        .collection("disbursement_queue")
        .countDocuments({ status: "failed" });

      console.log("━".repeat(60));
      console.log(`📋 Queue Status:`);
      console.log(`   Pending Jobs: ${pendingCount}`);
      console.log(`   Failed Jobs: ${failedCount}`);

      if (pendingCount > estimatedTransactions) {
        console.error(`🚨 WARNING: Not enough USDC for all pending jobs!`);
        console.error(
          `   Need approximately ${(pendingCount * avgTransactionUSDC).toFixed(2)} USDC`
        );
      }

      await mongoClient.close();
    }
  } catch (error) {
    console.error("❌ Error checking balance:", error.message);
    process.exit(1);
  }
}

checkBalance();
