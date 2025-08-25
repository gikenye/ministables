"use client"

import { useState, useEffect } from "react"
import { useReadContract } from "thirdweb/react"
import { getContract } from "thirdweb"
import { client } from "@/lib/thirdweb/client"
import { celo } from "thirdweb/chains"
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService"

// Ministables contract ABI - key functions for deposits
const MINISTABLES_ABI = [
  {
    inputs: [
      { internalType: "address", name: "user", type: "address" },
      { internalType: "address", name: "token", type: "address" }
    ],
    name: "getUserBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
      { internalType: "uint256", name: "", type: "uint256" }
    ],
    name: "userDeposits",
    outputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "lockEnd", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const

interface UserDeposit {
  tokenAddress: string
  tokenSymbol: string
  amount: string
  formattedAmount: string
  usdValue: number
  isLocked: boolean
  lockEndTime: number
}

interface UseUserDepositsReturn {
  deposits: UserDeposit[]
  totalUsdValue: number
  loading: boolean
  error: string | null
}

const TOKEN_INFO: Record<string, { symbol: string; decimals: number }> = {
  "0x471EcE3750Da237f93B8E339c536989b8978a438": { symbol: "CELO", decimals: 18 },
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": { symbol: "cUSD", decimals: 18 },
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": { symbol: "cEUR", decimals: 18 },
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": { symbol: "cREAL", decimals: 18 },
  "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": { symbol: "eXOF", decimals: 18 },
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": { symbol: "cKES", decimals: 18 },
  "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": { symbol: "PUSO", decimals: 18 },
  "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": { symbol: "cCOP", decimals: 18 },
  "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": { symbol: "cGHS", decimals: 18 },
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": { symbol: "USDT", decimals: 6 },
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": { symbol: "USDC", decimals: 6 },
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": { symbol: "USDGLO", decimals: 18 },
  "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71": { symbol: "cNGN", decimals: 18 },
}

const SUPPORTED_TOKENS = Object.keys(TOKEN_INFO)

export function useUserDeposits(userAddress: string | undefined): UseUserDepositsReturn {
  const [deposits, setDeposits] = useState<UserDeposit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const contract = getContract({
    client,
    chain: celo,
    address: MINILEND_ADDRESS,
    abi: MINISTABLES_ABI,
  })

  useEffect(() => {
    if (!userAddress) {
      setDeposits([])
      return
    }

    const fetchUserDeposits = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const depositPromises = SUPPORTED_TOKENS.map(async (tokenAddress) => {
          try {
            // Get user balance for this token
            const balance = await contract.call("getUserBalance", [userAddress, tokenAddress]) as bigint
            
            if (balance > 0n) {
              const tokenInfo = TOKEN_INFO[tokenAddress]
              const decimals = tokenInfo?.decimals || 18
              
              // Format the amount
              const formattedAmount = formatTokenAmount(balance.toString(), decimals)
              const numericAmount = parseFloat(formattedAmount)
              
              // For now, assume 1:1 USD value for stablecoins (you can enhance this with oracle prices)
              const usdValue = numericAmount
              
              return {
                tokenAddress,
                tokenSymbol: tokenInfo?.symbol || "Unknown",
                amount: balance.toString(),
                formattedAmount,
                usdValue,
                isLocked: false, // This would require additional contract calls to determine
                lockEndTime: 0,
              } as UserDeposit
            }
            return null
          } catch (error) {
            console.error(`Error fetching balance for token ${tokenAddress}:`, error)
            return null
          }
        })

        const results = await Promise.all(depositPromises)
        const validDeposits = results.filter((deposit): deposit is UserDeposit => deposit !== null)
        
        setDeposits(validDeposits)
      } catch (err) {
        console.error("Error fetching user deposits:", err)
        setError("Failed to fetch deposit data")
      } finally {
        setLoading(false)
      }
    }

    fetchUserDeposits()
  }, [userAddress, contract])

  const totalUsdValue = deposits.reduce((sum, deposit) => sum + deposit.usdValue, 0)

  return {
    deposits,
    totalUsdValue,
    loading,
    error,
  }
}

function formatTokenAmount(amountStr: string, decimals: number): string {
  try {
    const amount = BigInt(amountStr || "0")
    const divisor = BigInt(10 ** decimals)
    const intPart = amount / divisor
    const fracPart = amount % divisor
    
    // Get fractional part with proper decimal places
    const fracStr = fracPart.toString().padStart(decimals, "0")
    const truncatedFrac = fracStr.slice(0, 4).replace(/0+$/, "") || "0"
    
    return `${intPart.toString()}.${truncatedFrac}`
  } catch {
    return "0.00"
  }
}
