import { ethers } from "ethers";
import { scroll } from "thirdweb/chains";
import { getTokensBySymbol } from "@/config/chainConfig";

const SETTLEMENT_SECRET = process.env.SETTLEMENT_SECRET;
const PRETIUM_BASE_URI = process.env.PRETIUM_BASE_URI;
const PRETIUM_API_KEY = process.env.PRETIUM_API_KEY;
const SCROLL_RPC_URL = "https://scroll.api.onfinality.io/public";

if (!SETTLEMENT_SECRET) {
  throw new Error("SETTLEMENT_SECRET environment variable is required");
}

if (!PRETIUM_BASE_URI || !PRETIUM_API_KEY) {
  throw new Error("PRETIUM_BASE_URI and PRETIUM_API_KEY environment variables are required");
}

const provider = new ethers.providers.JsonRpcProvider({
  url: SCROLL_RPC_URL,
  timeout: 60000
});
const wallet = new ethers.Wallet(SETTLEMENT_SECRET, provider);

const usdcAbi = [
  "function transfer(address to, uint256 amount) returns (bool)"
];

async function getExchangeRate(): Promise<number> {
  try {
    const response = await fetch(`${PRETIUM_BASE_URI}/v1/exchange-rate`, {
      method: "POST",
      headers: {
        "x-api-key": PRETIUM_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ currency_code: "KES" }),
    });
    
    const data = await response.json() as { data: { selling_rate: number } };
    return data.data.selling_rate;
  } catch (error) {
    console.warn("⚠️ Failed to fetch exchange rate, using fallback:", error);
    return 131.02; // Fallback rate
  }
}

export async function disburseuSDC(recipientAddress: string, amountKES: number): Promise<{
  success: boolean;
  transactionHash: string;
  usdcAmount: number;
  kesAmount: number;
  recipient: string;
}> {
  console.log("🔥 disburseuSDC function called", { recipientAddress, amountKES });
  
  try {
    console.log(`💰 Disbursing USDC for ${amountKES} KES to ${recipientAddress}`);
    
    // Get current exchange rate
    const exchangeRate = await getExchangeRate();
    console.log(`💱 Current KES/USDC rate: ${exchangeRate}`);
    
    // Convert KES to USDC using current rate
    const usdcAmount = Math.round((amountKES / exchangeRate) * 1e6); // USDC has 6 decimals
    
    console.log(`📊 Converting ${amountKES} KES to ${usdcAmount / 1e6} USDC at rate ${exchangeRate}`);
    
    const scrollTokens = getTokensBySymbol(scroll.id);
    const usdcAddress = scrollTokens.USDC.address;
    
    const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, wallet);
    
    const tx = await usdcContract.transfer(recipientAddress, usdcAmount) as ethers.ContractTransaction;
    const receipt = await tx.wait() as ethers.ContractReceipt;
    
    console.log(`✅ USDC disbursement successful: ${receipt.transactionHash}`);
    
    return {
      success: true,
      transactionHash: receipt.transactionHash,
      usdcAmount: usdcAmount / 1e6,
      kesAmount: amountKES,
      recipient: recipientAddress,
    };
    
  } catch (error) {
    console.error("❌ USDC disbursement failed:", error);
    throw error;
  }
}