"use client"

import { useState, useEffect, createContext, useContext, type ReactNode } from "react"
import { createPublicClient, http, parseUnits, getContract } from "viem"
import { celo } from "viem/chains"
import { useWallet } from "./wallet"

// Contract addresses
const MINILEND_ADDRESS = "0x89E356E80De29B466E774A5Eb543118B439EE41E"
const ORACLE_ADDRESS = "0x96D7E17a4Af7af46413A7EAD48f01852C364417A"

// ABIs
const MINILEND_ABI = [
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
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "depositCollateral",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "address", name: "collateralToken", type: "address" },
    ],
    name: "borrow",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "repay",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "supportedStablecoins",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "supportedCollateral",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "defaultLockPeriods",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "user", type: "address" },
      { internalType: "address", name: "token", type: "address" },
    ],
    name: "getUserBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "userDeposits",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "userBorrows",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "userCollateral",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "depositLockEnd",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "borrowStartTime",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const

const ERC20_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const

const ORACLE_ABI = [
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "getMedianRate",
    outputs: [
      { internalType: "uint256", name: "rate", type: "uint256" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "rates",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const

// All supported tokens from the oracle contract
const ALL_SUPPORTED_TOKENS = {
  // Native and major stablecoins
  CELO: {
    address: "0x471EcE3750Da237f93B8E339c536989b8978a438",
    symbol: "CELO",
    name: "Celo",
    decimals: 18,
    category: "native",
  },
  cUSD: {
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    symbol: "cUSD",
    name: "Celo Dollar",
    decimals: 18,
    category: "stablecoin",
  },
  cEUR: {
    address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
    symbol: "cEUR",
    name: "Celo Euro",
    decimals: 18,
    category: "stablecoin",
  },
  cREAL: {
    address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
    symbol: "cREAL",
    name: "Celo Brazilian Real",
    decimals: 18,
    category: "stablecoin",
  },

  // Regional stablecoins
  eXOF: {
    address: "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08",
    symbol: "eXOF",
    name: "Electronic CFA Franc",
    decimals: 18,
    category: "regional",
  },
  cKES: {
    address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0",
    symbol: "cKES",
    name: "Celo Kenyan Shilling",
    decimals: 18,
    category: "regional",
  },
  PUSO: {
    address: "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B",
    symbol: "PUSO",
    name: "Philippine Peso",
    decimals: 18,
    category: "regional",
  },
  cCOP: {
    address: "0x8A567e2aE79CA692Bd748aB832081C45de4041eA",
    symbol: "cCOP",
    name: "Celo Colombian Peso",
    decimals: 18,
    category: "regional",
  },
  cGHS: {
    address: "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313",
    symbol: "cGHS",
    name: "Celo Ghanaian Cedi",
    decimals: 18,
    category: "regional",
  },

  // International stablecoins
  USDT: {
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    category: "international",
  },
  USDC: {
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    category: "international",
  },
  USDGLO: {
    address: "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3",
    symbol: "USDGLO",
    name: "Glo Dollar",
    decimals: 18,
    category: "international",
  },
}

interface TokenInfo {
  address: string
  symbol: string
  name: string
  decimals: number
  category: string
}

interface ContractContextType {
  supportedStablecoins: string[]
  supportedCollateral: string[]
  defaultLockPeriods: string[]
  allTokens: Record<string, TokenInfo>
  loading: boolean
  deposit: (token: string, amount: string, lockPeriod: number) => Promise<string>
  depositCollateral: (token: string, amount: string) => Promise<string>
  borrow: (token: string, amount: string, collateralToken: string) => Promise<string>
  repay: (token: string, amount: string) => Promise<string>
  getUserBalance: (user: string, token: string) => Promise<string>
  getUserDeposits: (user: string, token: string) => Promise<string>
  getUserBorrows: (user: string, token: string) => Promise<string>
  getUserCollateral: (user: string, token: string) => Promise<string>
  getDepositLockEnd: (user: string, token: string) => Promise<number>
  getBorrowStartTime: (user: string, token: string) => Promise<number>
  getTotalSupply: (token: string) => Promise<string>
  getTokenBalance: (token: string, user: string) => Promise<string>
  getTokenInfo: (token: string) => Promise<{ symbol: string; decimals: number }>
  getOracleRate: (token: string) => Promise<{ rate: string; timestamp: number }>
}

const ContractContext = createContext<ContractContextType | null>(null)

export function ContractProvider({ children }: { children: ReactNode }) {
  const { walletClient } = useWallet()
  const [loading, setLoading] = useState(false)
  const [supportedStablecoins, setSupportedStablecoins] = useState<string[]>([])
  const [supportedCollateral, setSupportedCollateral] = useState<string[]>([])
  const [defaultLockPeriods, setDefaultLockPeriods] = useState<string[]>([])

  const publicClient = createPublicClient({
    chain: celo,
    transport: http("https://forno.celo.org"),
  })

  const miniLendContract = getContract({
    address: MINILEND_ADDRESS,
    abi: MINILEND_ABI,
    client: publicClient,
  })

  useEffect(() => {
    loadContractData()
  }, [])

  const loadContractData = async () => {
    try {
      // Use all tokens from the oracle contract
      const stablecoins = [
        ALL_SUPPORTED_TOKENS.cUSD.address,
        ALL_SUPPORTED_TOKENS.cEUR.address,
        ALL_SUPPORTED_TOKENS.cREAL.address,
        ALL_SUPPORTED_TOKENS.eXOF.address,
        ALL_SUPPORTED_TOKENS.cKES.address,
        ALL_SUPPORTED_TOKENS.PUSO.address,
        ALL_SUPPORTED_TOKENS.cCOP.address,
        ALL_SUPPORTED_TOKENS.cGHS.address,
        ALL_SUPPORTED_TOKENS.USDT.address,
        ALL_SUPPORTED_TOKENS.USDC.address,
        ALL_SUPPORTED_TOKENS.USDGLO.address,
      ]

      const collateral = [
        ALL_SUPPORTED_TOKENS.CELO.address,
        ALL_SUPPORTED_TOKENS.USDC.address,
        ALL_SUPPORTED_TOKENS.cUSD.address,
        ALL_SUPPORTED_TOKENS.USDT.address,
      ]

      setSupportedStablecoins(stablecoins)
      setSupportedCollateral(collateral)
      setDefaultLockPeriods(["2592000", "5184000", "10368000"]) // 30, 60, 120 days
    } catch (error) {
      console.error("Error loading contract data:", error)
    }
  }

  const getTokenInfo = async (tokenAddress: string): Promise<{ symbol: string; decimals: number }> => {
    try {
      // First check if it's in our predefined tokens
      const predefinedToken = Object.values(ALL_SUPPORTED_TOKENS).find(
        (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
      )

      if (predefinedToken) {
        return {
          symbol: predefinedToken.symbol,
          decimals: predefinedToken.decimals,
        }
      }

      // Fallback to contract call
      const tokenContract = getContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        client: publicClient,
      })

      const [symbol, decimals] = await Promise.all([tokenContract.read.symbol(), tokenContract.read.decimals()])

      return { symbol: symbol as string, decimals: decimals as number }
    } catch (error) {
      console.error("Error getting token info:", error)
      return { symbol: "Unknown", decimals: 18 }
    }
  }

  const getTokenBalance = async (tokenAddress: string, userAddress: string): Promise<string> => {
    try {
      const tokenContract = getContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        client: publicClient,
      })

      const balance = await tokenContract.read.balanceOf([userAddress as `0x${string}`])
      return balance.toString()
    } catch (error) {
      console.error("Error getting token balance:", error)
      return "0"
    }
  }

  const getOracleRate = async (tokenAddress: string): Promise<{ rate: string; timestamp: number }> => {
    try {
      const oracleContract = getContract({
        address: ORACLE_ADDRESS as `0x${string}`,
        abi: ORACLE_ABI,
        client: publicClient,
      })

      const [rate, timestamp] = await oracleContract.read.getMedianRate([tokenAddress as `0x${string}`])
      return {
        rate: rate.toString(),
        timestamp: Number(timestamp),
      }
    } catch (error) {
      console.error("Error getting oracle rate:", error)
      // Fallback to mock rates if oracle fails
      const mockRates: Record<string, string> = {
        [ALL_SUPPORTED_TOKENS.CELO.address]: "1000000000000000000", // 1e18
        [ALL_SUPPORTED_TOKENS.cUSD.address]: "1428571428571428571",
        [ALL_SUPPORTED_TOKENS.cEUR.address]: "1571428571428571428",
        [ALL_SUPPORTED_TOKENS.cREAL.address]: "285714285714285714",
        [ALL_SUPPORTED_TOKENS.eXOF.address]: "2380952380952381",
        [ALL_SUPPORTED_TOKENS.cKES.address]: "10989010989010989",
        [ALL_SUPPORTED_TOKENS.PUSO.address]: "24571428571428571",
        [ALL_SUPPORTED_TOKENS.cCOP.address]: "357142857142857",
        [ALL_SUPPORTED_TOKENS.cGHS.address]: "95238095238095238",
        [ALL_SUPPORTED_TOKENS.USDT.address]: "1428571428571428571",
        [ALL_SUPPORTED_TOKENS.USDC.address]: "1428571428571428571",
        [ALL_SUPPORTED_TOKENS.USDGLO.address]: "1428571428571428571",
      }

      return {
        rate: mockRates[tokenAddress] || "1000000000000000000",
        timestamp: Math.floor(Date.now() / 1000),
      }
    }
  }

  const deposit = async (token: string, amount: string, lockPeriod: number): Promise<string> => {
    if (!walletClient) throw new Error("Wallet not connected")

    setLoading(true)
    try {
      const tokenInfo = await getTokenInfo(token)
      const amountWei = parseUnits(amount, tokenInfo.decimals)

      // First approve the token
      const approveTx = await walletClient.writeContract({
        address: token as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [MINILEND_ADDRESS, amountWei],
      })

      // Wait for approval
      await publicClient.waitForTransactionReceipt({ hash: approveTx })

      // Now deposit
      const tx = await walletClient.writeContract({
        address: MINILEND_ADDRESS,
        abi: MINILEND_ABI,
        functionName: "deposit",
        args: [token as `0x${string}`, amountWei, BigInt(lockPeriod)],
      })

      return tx
    } catch (error: any) {
      console.error("Deposit error:", error)
      if (error.message.includes("insufficient funds")) {
        throw new Error("You don't have enough money in your wallet.")
      } else if (error.message.includes("User rejected")) {
        throw new Error("Transaction was cancelled.")
      } else {
        throw new Error("Failed to save money. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const depositCollateral = async (token: string, amount: string): Promise<string> => {
    if (!walletClient) throw new Error("Wallet not connected")

    setLoading(true)
    try {
      const tokenInfo = await getTokenInfo(token)
      const amountWei = parseUnits(amount, tokenInfo.decimals)

      // First approve the token
      const approveTx = await walletClient.writeContract({
        address: token as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [MINILEND_ADDRESS, amountWei],
      })

      // Wait for approval
      await publicClient.waitForTransactionReceipt({ hash: approveTx })

      // Now deposit collateral
      const tx = await walletClient.writeContract({
        address: MINILEND_ADDRESS,
        abi: MINILEND_ABI,
        functionName: "depositCollateral",
        args: [token as `0x${string}`, amountWei],
      })

      return tx
    } catch (error: any) {
      console.error("Deposit collateral error:", error)
      if (error.message.includes("insufficient funds")) {
        throw new Error("You don't have enough money in your wallet.")
      } else if (error.message.includes("User rejected")) {
        throw new Error("Transaction was cancelled.")
      } else {
        throw new Error("Failed to deposit collateral. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const borrow = async (token: string, amount: string, collateralToken: string): Promise<string> => {
    if (!walletClient) throw new Error("Wallet not connected")

    setLoading(true)
    try {
      const tokenInfo = await getTokenInfo(token)
      const amountWei = parseUnits(amount, tokenInfo.decimals)

      const tx = await walletClient.writeContract({
        address: MINILEND_ADDRESS,
        abi: MINILEND_ABI,
        functionName: "borrow",
        args: [token as `0x${string}`, amountWei, collateralToken as `0x${string}`],
      })

      return tx
    } catch (error: any) {
      console.error("Borrow error:", error)

      // Check for specific contract errors
      if (error.message.includes("No collateral deposited")) {
        throw new Error("You need to deposit collateral first before borrowing.")
      } else if (error.message.includes("Insufficient collateral")) {
        throw new Error("You need more collateral to borrow this amount.")
      } else if (error.message.includes("Token borrow cap exceeded")) {
        throw new Error("The borrowing limit for this token has been reached.")
      } else if (error.message.includes("Borrowing paused")) {
        throw new Error("Borrowing is currently unavailable for this money type.")
      } else if (error.message.includes("User rejected")) {
        throw new Error("Transaction was cancelled.")
      } else {
        throw new Error("Failed to borrow money. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const repay = async (token: string, amount: string): Promise<string> => {
    if (!walletClient) throw new Error("Wallet not connected")

    setLoading(true)
    try {
      const tokenInfo = await getTokenInfo(token)
      const amountWei = parseUnits(amount, tokenInfo.decimals)

      // First approve the token
      const approveTx = await walletClient.writeContract({
        address: token as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [MINILEND_ADDRESS, amountWei],
      })

      // Wait for approval
      await publicClient.waitForTransactionReceipt({ hash: approveTx })

      // Now repay
      const tx = await walletClient.writeContract({
        address: MINILEND_ADDRESS,
        abi: MINILEND_ABI,
        functionName: "repay",
        args: [token as `0x${string}`, amountWei],
      })

      return tx
    } catch (error: any) {
      console.error("Repay error:", error)
      if (error.message.includes("insufficient funds")) {
        throw new Error("You don't have enough money to pay back this amount.")
      } else if (error.message.includes("User rejected")) {
        throw new Error("Transaction was cancelled.")
      } else {
        throw new Error("Failed to pay back loan. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const getUserBalance = async (user: string, token: string): Promise<string> => {
    try {
      const balance = await miniLendContract.read.getUserBalance([user as `0x${string}`, token as `0x${string}`])
      return balance.toString()
    } catch (error) {
      console.error("Error getting user balance:", error)
      return "0"
    }
  }

  const getUserDeposits = async (user: string, token: string): Promise<string> => {
    try {
      const deposits = await miniLendContract.read.userDeposits([user as `0x${string}`, token as `0x${string}`])
      return deposits.toString()
    } catch (error) {
      console.error("Error getting user deposits:", error)
      return "0"
    }
  }

  const getUserBorrows = async (user: string, token: string): Promise<string> => {
    try {
      const borrows = await miniLendContract.read.userBorrows([user as `0x${string}`, token as `0x${string}`])
      return borrows.toString()
    } catch (error) {
      console.error("Error getting user borrows:", error)
      return "0"
    }
  }

  const getUserCollateral = async (user: string, token: string): Promise<string> => {
    try {
      const collateral = await miniLendContract.read.userCollateral([user as `0x${string}`, token as `0x${string}`])
      return collateral.toString()
    } catch (error) {
      console.error("Error getting user collateral:", error)
      return "0"
    }
  }

  const getDepositLockEnd = async (user: string, token: string): Promise<number> => {
    try {
      const lockEnd = await miniLendContract.read.depositLockEnd([user as `0x${string}`, token as `0x${string}`])
      return Number(lockEnd)
    } catch (error) {
      console.error("Error getting deposit lock end:", error)
      return 0
    }
  }

  const getBorrowStartTime = async (user: string, token: string): Promise<number> => {
    try {
      const startTime = await miniLendContract.read.borrowStartTime([user as `0x${string}`, token as `0x${string}`])
      return Number(startTime)
    } catch (error) {
      console.error("Error getting borrow start time:", error)
      return 0
    }
  }

  const getTotalSupply = async (token: string): Promise<string> => {
    try {
      const supply = await miniLendContract.read.totalSupply([token as `0x${string}`])
      return supply.toString()
    } catch (error) {
      console.error("Error getting total supply:", error)
      return "0"
    }
  }

  return (
    <ContractContext.Provider
      value={{
        supportedStablecoins,
        supportedCollateral,
        defaultLockPeriods,
        allTokens: ALL_SUPPORTED_TOKENS,
        loading,
        deposit,
        depositCollateral,
        borrow,
        repay,
        getUserBalance,
        getUserDeposits,
        getUserBorrows,
        getUserCollateral,
        getDepositLockEnd,
        getBorrowStartTime,
        getTotalSupply,
        getTokenBalance,
        getTokenInfo,
        getOracleRate,
      }}
    >
      {children}
    </ContractContext.Provider>
  )
}

export function useContract() {
  const context = useContext(ContractContext)
  if (!context) {
    throw new Error("useContract must be used within a ContractProvider")
  }
  return context
}
