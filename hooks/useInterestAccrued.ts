"use client"

import { useState, useEffect } from "react"
import { getContract } from "thirdweb"
import { client } from "@/lib/thirdweb/client"
import { celo } from "thirdweb/chains"
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService"

// Ministables contract ABI for interest calculations
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

interface TokenInterest {
  tokenAddress: string
  tokenSymbol: string
  principal: number
  currentBalance: number
  interestEarned: number
  apy: number
}

interface UseInterestAccruedReturn {
  totalInterestUsd: number
  tokenInterests: TokenInterest[]
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

// Helper function to get APY based on lock period (same as SaveMoneyModal)
function getAPY(lockPeriodSeconds: number): number {
  if (lockPeriodSeconds >= 15552000) return 12 // 180 days = 12%
  if (lockPeriodSeconds >= 7776000) return 8   // 90 days = 8%
  if (lockPeriodSeconds >= 2592000) return 5   // 30 days = 5%
  if (lockPeriodSeconds >= 604800) return 2    // 7 days = 2%
  return 5 // default 5%
}

export function useInterestAccrued(userAddress: string | undefined): UseInterestAccruedReturn {
  const [tokenInterests, setTokenInterests] = useState<TokenInterest[]>([])
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
      setTokenInterests([])
      return
    }

    const fetchInterestData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const interestPromises = SUPPORTED_TOKENS.map(async (tokenAddress) => {
          try {
            // Get current balance (includes principal + accrued interest)
            const currentBalance = await contract.call("getUserBalance", [userAddress, tokenAddress]) as bigint
            
            if (currentBalance > 0n) {
              const tokenInfo = TOKEN_INFO[tokenAddress]
              const decimals = tokenInfo?.decimals || 18
              
              // Format current balance
              const currentBalanceFormatted = formatTokenAmount(currentBalance.toString(), decimals)
              const currentBalanceNum = parseFloat(currentBalanceFormatted)
              
              // For now, we'll estimate principal vs interest based on typical returns
              // In a real implementation, you'd track deposit history
              const estimatedAPY = 5 // Average APY
              const estimatedTimeYears = 0.25 // Assume 3 months average
              const estimatedMultiplier = 1 + (estimatedAPY / 100) * estimatedTimeYears
              
              const estimatedPrincipal = currentBalanceNum / estimatedMultiplier
              const interestEarned = currentBalanceNum - estimatedPrincipal
              
              return {
                tokenAddress,
                tokenSymbol: tokenInfo?.symbol || "Unknown",
                principal: estimatedPrincipal,
                currentBalance: currentBalanceNum,
                interestEarned: Math.max(0, interestEarned),
                apy: estimatedAPY,
              } as TokenInterest
            }
            return null
          } catch (error) {
            console.error(`Error fetching interest for token ${tokenAddress}:`, error)
            return null
          }
        })

        const results = await Promise.all(interestPromises)
        const validInterests = results.filter((interest): interest is TokenInterest => interest !== null)
        
        setTokenInterests(validInterests)
      } catch (err) {
        console.error("Error fetching interest data:", err)
        setError("Failed to fetch interest data")
      } finally {
        setLoading(false)
      }
    }

    fetchInterestData()
  }, [userAddress, contract])

  const totalInterestUsd = tokenInterests.reduce((sum, token) => sum + token.interestEarned, 0)

  return {
    totalInterestUsd,
    tokenInterests,
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
