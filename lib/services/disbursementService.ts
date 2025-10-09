import { ethers } from "ethers";
import { scroll } from "thirdweb/chains";
import { getTokensBySymbol } from "@/config/chainConfig";

const SETTLEMENT_SECRET = process.env.SETTLEMENT_SECRET;
const SCROLL_RPC_URL = "https://rpc.scroll.io";

if (!SETTLEMENT_SECRET) {
  throw new Error("SETTLEMENT_SECRET environment variable is required");
}

const provider = new ethers.providers.JsonRpcProvider(SCROLL_RPC_URL);
const wallet = new ethers.Wallet(SETTLEMENT_SECRET, provider);

const usdcAbi = [
  "function transfer(address to, uint256 amount) returns (bool)"
];

export async function disburseuSDC(recipientAddress: string, amountKES: number) {
  try {
    console.log(`💰 Disbursing USDC for ${amountKES} KES to ${recipientAddress}`);
    
    // Convert KES to USDC (assuming 1 USDC = 130 KES for now)
    const usdcAmount = Math.round((amountKES / 130) * 1e6); // USDC has 6 decimals
    
    console.log(`📊 Converting ${amountKES} KES to ${usdcAmount / 1e6} USDC`);
    
    const scrollTokens = getTokensBySymbol(scroll.id);
    const usdcAddress = scrollTokens.USDC.address;
    
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, wallet);
    
    const tx = await usdcContract.transfer(recipientAddress, usdcAmount);
    const receipt = await tx.wait();
    
    console.log(`✅ USDC disbursement successful: ${receipt.hash}`);
    
    return {
      success: true,
      transactionHash: receipt.hash,
      usdcAmount: usdcAmount / 1e6,
      kesAmount: amountKES,
      recipient: recipientAddress,
    };
    
  } catch (error) {
    console.error("❌ USDC disbursement failed:", error);
    throw error;
  }
}