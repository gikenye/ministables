import { NextRequest, NextResponse } from "next/server"
import { createThirdwebClient, getContract, prepareContractCall, sendTransaction } from "thirdweb"
import { privateKeyToAccount } from "thirdweb/wallets"
import { celo } from "thirdweb/chains"
import { parseUnits } from "viem"
import { getTokensBySymbol } from "@/config/chainConfig"

// Minilend contract ABI for deposit function
const minilendABI = [
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "lockPeriod", type: "uint256" },
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const

// Get token addresses from chainConfig
const getTokenAddress = (symbol: string) => {
  const tokens = getTokensBySymbol(celo.id)
  return tokens[symbol]?.address
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate callback data
    const { 
      transaction_code, 
      status, 
      amount, 
      asset, 
      address,
      callback_metadata 
    } = body

    console.log("[Onramp Callback] Received:", {
      transaction_code,
      status,
      amount,
      asset,
      address: address?.substring(0, 10) + '...',
      has_metadata: !!callback_metadata
    })

    // Only process successful transactions with auto-deposit metadata
    if (status !== "completed" || !callback_metadata?.auto_deposit) {
      return NextResponse.json({ 
        success: true, 
        message: "Callback received but no auto-deposit required" 
      })
    }

    const {
      minilend_contract,
      user_address,
      lock_period = "2592000" // 30 days default
    } = callback_metadata

    if (!minilend_contract || !user_address) {
      console.error("[Onramp Callback] Missing required metadata")
      return NextResponse.json({ 
        success: false, 
        error: "Missing required callback metadata" 
      }, { status: 400 })
    }

    // Get token address
    const tokenAddress = getTokenAddress(asset)
    if (!tokenAddress) {
      console.error("[Onramp Callback] Unsupported asset:", asset)
      return NextResponse.json({ 
        success: false, 
        error: `Unsupported asset: ${asset}` 
      }, { status: 400 })
    }

    // Initialize thirdweb client with server-side account
    const serverPrivateKey = process.env.SERVER_PRIVATE_KEY
    if (!serverPrivateKey) {
      console.error("[Onramp Callback] Missing SERVER_PRIVATE_KEY")
      return NextResponse.json({ 
        success: false, 
        error: "Server configuration error" 
      }, { status: 500 })
    }

    const client = createThirdwebClient({
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
    })

    const account = privateKeyToAccount({
      client,
      privateKey: serverPrivateKey,
    })

    // Create contract instance
    const minilendContract = getContract({
      client,
      chain: celo,
      address: minilend_contract,
      abi: minilendABI,
    })

    // Convert amount to wei (assuming 6 decimals for stablecoins)
    const amountWei = parseUnits(amount.toString(), 6)

    // Prepare deposit transaction on behalf of user
    const depositTx = prepareContractCall({
      contract: minilendContract,
      method: "deposit",
      params: [
        tokenAddress,
        amountWei,
        BigInt(parseInt(lock_period)),
      ],
    })

    console.log("[Onramp Callback] Executing auto-deposit:", {
      user: user_address?.substring(0, 10) + '...',
      token: asset,
      amount,
      lockPeriod: lock_period
    })

    // Execute the deposit transaction
    const result = await sendTransaction({
      transaction: depositTx,
      account,
    })

    console.log("[Onramp Callback] Auto-deposit successful:", result.transactionHash)

    return NextResponse.json({
      success: true,
      message: "Auto-deposit completed successfully",
      transaction_hash: result.transactionHash,
      deposited_amount: amount,
      lock_period: lock_period
    })

  } catch (error: any) {
    console.error("[Onramp Callback] Error:", error)
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to process auto-deposit"
    }, { status: 500 })
  }
}