"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { createPublicClient, http, parseUnits, getContract, fallback } from "viem";
import { celo } from "viem/chains";
import { useWallet } from "./wallet";

// Helper function to ensure user is on Celo network
export async function ensureCeloNetwork(): Promise<void> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No wallet detected. Please install MetaMask or another Web3 wallet.");
  }

  try {
    // Check current network
    const chainId = await window.ethereum.request({
      method: "eth_chainId",
    });

    // If not on Celo (chainId 0xa4ec), prompt to switch
    if (chainId !== "0xa4ec") {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xa4ec" }],
        });
      } catch (switchError: any) {
        // If the chain hasn't been added to MetaMask
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0xa4ec",
                  chainName: "Celo Mainnet",
                  nativeCurrency: {
                    name: "CELO",
                    symbol: "CELO",
                    decimals: 18,
                  },
                  rpcUrls: ["https://forno.celo.org"],
                  blockExplorerUrls: ["https://celoscan.io/"],
                },
              ],
            });
          } catch (addError) {
            throw new Error("Failed to add Celo network to wallet");
          }
        } else {
          throw new Error("Please switch to the Celo network in your wallet settings.");
        }
      }
    }
  } catch (error: any) {
    console.error("Error ensuring Celo network:", error);
    throw new Error(error.message || "Failed to connect to Celo network");
  }
}

// Contract addresses
export const MINILEND_ADDRESS = "0x89E356E80De29B466E774A5Eb543118B439EE41E";
export const ORACLE_ADDRESS = "0x96D7E17a4Af7af46413A7EAD48f01852C364417A";

// ABIs
export const MINILEND_ABI = [
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
    ],
    name: "withdraw",
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
    stateMutability: "view",
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
] as const;

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
] as const;

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
] as const;

// All supported tokens from the oracle contract
export const ALL_SUPPORTED_TOKENS = {
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
};

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  category: string;
}

interface ContractContextType {
  supportedStablecoins: string[];
  supportedCollateral: string[];
  defaultLockPeriods: string[];
  allTokens: Record<string, TokenInfo>;
  loading: boolean;
  deposit: (
    token: string,
    amount: string,
    lockPeriod: number
  ) => Promise<string>;
  depositCollateral: (token: string, amount: string) => Promise<string>;
  borrow: (
    token: string,
    amount: string,
    collateralToken: string
  ) => Promise<string>;
  repay: (token: string, amount: string) => Promise<string>;
  withdraw: (token: string, amount: string) => Promise<string>;
  getUserBalance: (user: string, token: string) => Promise<string>;
  getUserDeposits: (user: string, token: string) => Promise<string>;
  getUserBorrows: (user: string, token: string) => Promise<string>;
  getUserCollateral: (user: string, token: string) => Promise<string>;
  getDepositLockEnd: (user: string, token: string) => Promise<number>;
  getBorrowStartTime: (user: string, token: string) => Promise<number>;
  getTotalSupply: (token: string) => Promise<string>;
  getTokenBalance: (token: string, user: string) => Promise<string>;
  getTokenInfo: (
    token: string
  ) => Promise<{ symbol: string; decimals: number }>;
  getOracleRate: (
    token: string
  ) => Promise<{ rate: string; timestamp: number }>;
  batchGetUserData: (user: string, tokens: string[]) => Promise<any[]>;
}

const ContractContext = createContext<ContractContextType | null>(null);

export function ContractProvider({ children }: { children: ReactNode }) {
  const { walletClient } = useWallet();
  const [loading, setLoading] = useState(false);
  const [supportedStablecoins, setSupportedStablecoins] = useState<string[]>(
    []
  );
  const [supportedCollateral, setSupportedCollateral] = useState<string[]>([]);
  const [defaultLockPeriods, setDefaultLockPeriods] = useState<string[]>([]);
  
  // Cache for token info and oracle rates
  const [tokenInfoCache, setTokenInfoCache] = useState<Record<string, { symbol: string; decimals: number; timestamp: number }>>({});
  const [oracleRateCache, setOracleRateCache] = useState<Record<string, { rate: string; timestamp: number; cacheTime: number }>>({});
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const getRpcEndpoints = () => {
    const customRpc = process.env.NEXT_PUBLIC_CELO_RPC_URL;
    const endpoints = [
      "https://forno.celo.org",
      "https://rpc.ankr.com/celo", 
      "https://1rpc.io/celo"
    ];
    
    if (customRpc) {
      endpoints.unshift(customRpc);
    }
    
    return endpoints.map(url => http(url, { retryCount: 2, retryDelay: 1000 }));
  };

  const publicClient = createPublicClient({
    chain: celo,
    transport: fallback(getRpcEndpoints()),
  });

  const miniLendContract = getContract({
    address: MINILEND_ADDRESS,
    abi: MINILEND_ABI,
    client: publicClient,
  });

  useEffect(() => {
    loadContractData();
  }, []);

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
      ];

      const collateral = [
        ALL_SUPPORTED_TOKENS.CELO.address,
        ALL_SUPPORTED_TOKENS.USDC.address,
        ALL_SUPPORTED_TOKENS.cUSD.address,
        ALL_SUPPORTED_TOKENS.USDT.address,
      ];

      setSupportedStablecoins(stablecoins);
      setSupportedCollateral(collateral);
      setDefaultLockPeriods(["61","604800","2592000", "5184000", "10368000"]); // 1 min, 30, 60, 120 days
    } catch (error) {
      console.error("Error loading contract data:", error);
    }
  };

  const getTokenInfo = async (
    tokenAddress: string
  ): Promise<{ symbol: string; decimals: number }> => {
    try {
      // Check cache first
      const cached = tokenInfoCache[tokenAddress];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return { symbol: cached.symbol, decimals: cached.decimals };
      }

      // First check if it's in our predefined tokens
      const predefinedToken = Object.values(ALL_SUPPORTED_TOKENS).find(
        (token) => token.address.toLowerCase() === tokenAddress.toLowerCase()
      );

      if (predefinedToken) {
        const result = {
          symbol: predefinedToken.symbol,
          decimals: predefinedToken.decimals,
        };
        // Cache predefined token info
        setTokenInfoCache(prev => ({
          ...prev,
          [tokenAddress]: { ...result, timestamp: Date.now() }
        }));
        return result;
      }

      // Fallback to contract call
      const tokenContract = getContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        client: publicClient,
      });

      const [symbol, decimals] = await Promise.all([
        tokenContract.read.symbol(),
        tokenContract.read.decimals(),
      ]);

      const result = { symbol: symbol as string, decimals: decimals as number };
      // Cache the result
      setTokenInfoCache(prev => ({
        ...prev,
        [tokenAddress]: { ...result, timestamp: Date.now() }
      }));
      return result;
    } catch (error) {
      console.error("Error getting token info:", error);
      return { symbol: "Unknown", decimals: 18 };
    }
  };

  const getTokenBalance = async (
    tokenAddress: string,
    userAddress: string
  ): Promise<string> => {
    try {
      const tokenContract = getContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        client: publicClient,
      });

      const balance = await tokenContract.read.balanceOf([
        userAddress as `0x${string}`,
      ]);
      return balance.toString();
    } catch (error) {
      console.error("Error getting token balance:", error);
      return "0";
    }
  };

  const getOracleRate = async (
    tokenAddress: string
  ): Promise<{ rate: string; timestamp: number }> => {
    try {
      // Check cache first
      const cached = oracleRateCache[tokenAddress];
      if (cached && Date.now() - cached.cacheTime < CACHE_DURATION) {
        return { rate: cached.rate, timestamp: cached.timestamp };
      }

      const oracleContract = getContract({
        address: ORACLE_ADDRESS as `0x${string}`,
        abi: ORACLE_ABI,
        client: publicClient,
      });

      const [rate, timestamp] = await oracleContract.read.getMedianRate([
        tokenAddress as `0x${string}`,
      ]);
      
      const result = {
        rate: rate.toString(),
        timestamp: Number(timestamp),
      };
      
      // Cache the result
      setOracleRateCache(prev => ({
        ...prev,
        [tokenAddress]: { ...result, cacheTime: Date.now() }
      }));
      
      return result;
    } catch (error) {
      console.error("Error getting oracle rate:", error);
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
      };

      const result = {
        rate: mockRates[tokenAddress] || "1000000000000000000",
        timestamp: Math.floor(Date.now() / 1000),
      };
      
      // Cache fallback result too
      setOracleRateCache(prev => ({
        ...prev,
        [tokenAddress]: { ...result, cacheTime: Date.now() }
      }));
      
      return result;
    }
  };

  // Safe approve function that handles tokens requiring allowance reset
  const safeApprove = async (token: string, spender: string, amount: bigint): Promise<void> => {
    if (!walletClient || !walletClient.account) throw new Error("Wallet not connected");
    try {
      // For USDC and potentially other tokens that require setting allowance to 0 first
      // This mimics the behavior of OpenZeppelin's forceApprove
      if (token.toLowerCase() === ALL_SUPPORTED_TOKENS.USDC.address.toLowerCase()) {
        console.log("Using safe approval pattern for USDC token");
        try {
          // First set allowance to 0
          const resetTx = await walletClient.writeContract({
            address: token as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [spender as `0x${string}`, BigInt(0)],
            chain: celo,
            account: walletClient.account!,
          });
          
          // Wait for the reset transaction to complete
          await publicClient.waitForTransactionReceipt({ hash: resetTx });
          console.log("Successfully reset USDC allowance to 0");
        } catch (resetError: any) {
          console.error("Error resetting allowance:", resetError);
          // Check for disk space errors
          if (resetError.message?.includes("FILE_ERROR_NO_SPACE") ||
              resetError.message?.includes("QuotaExceededError") ||
              resetError.message?.includes("no space")) {
            throw new Error("Your device is running out of disk space. Please free up some space and try again.");
          }
          // If resetting fails, we'll still try to set the allowance directly
          // Some implementations might not require the reset
        }
      }
      
      // Now set the actual allowance
      const approveTx = await walletClient.writeContract({
        address: token as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [spender as `0x${string}`, amount],
        chain: celo,
        account: walletClient.account!,
      });
      
      // Wait for approval
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      console.log(`Successfully approved ${amount} tokens for ${spender}`);
    } catch (error: any) {
      console.error("Safe approve error:", error);
      if (error.message?.includes("FILE_ERROR_NO_SPACE") ||
          error.message?.includes("QuotaExceededError") ||
          error.message?.includes("no space")) {
        throw new Error("Your device is running out of disk space. Please free up some space and try again.");
      } else if (error.message?.includes("Internal JSON-RPC error") || 
                error.message?.includes("RPC Error") ||
                error.message?.includes("network error")) {
        throw new Error("Network connection issue. Please check your internet and try again.");
      } else if (error.message?.includes("User rejected") ||
                error.message?.includes("rejected the request")) {
        console.log("User cancelled the transaction in their wallet");
        throw new Error("Transaction was cancelled. You rejected the request in your wallet.");
      } else if (error.message.includes("chain")) {
        throw new Error("Please switch to the Celo network in your wallet settings.");
      } else {
        throw new Error(`Failed to approve token: ${error.message}`);
      }
    }
  };

  const deposit = async (
    token: string,
    amount: string,
    lockPeriod: number
  ): Promise<string> => {
    if (!walletClient || !walletClient.account) throw new Error("Wallet not connected");

    setLoading(true);
    try {
      const tokenInfo = await getTokenInfo(token);
      const amountWei = parseUnits(amount, tokenInfo.decimals);

      // First approve the token using safe approval pattern
      await safeApprove(token, MINILEND_ADDRESS, amountWei);

      // Now deposit
      const tx = await walletClient.writeContract({
        address: MINILEND_ADDRESS,
        abi: MINILEND_ABI,
        functionName: "deposit",
        args: [token as `0x${string}`, amountWei, BigInt(lockPeriod)],
        chain: celo,
        account: walletClient.account!,
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // Check if transaction was successful
      if (receipt.status === 'reverted') {
        throw new Error("Transaction failed. Please check the transaction on CeloScan for details.");
      }

      return tx;
    } catch (error: any) {
      console.error("Deposit error:", error);
      if (error.message?.includes("Internal JSON-RPC error") || 
          error.message?.includes("RPC Error") ||
          error.message?.includes("network error")) {
        throw new Error("Network connection issue. Please check your internet and try again.");
      } else if (error.message.includes("insufficient funds")) {
        throw new Error("You don't have enough money in your wallet.");
      } else if (error.message.includes("User rejected")) {
        throw new Error("Transaction was cancelled.");
      } else if (error.message.includes("chain")) {
        throw new Error("Please switch to the Celo network in your wallet settings.");
      } else {
        throw new Error("Failed to save money. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const depositCollateral = async (
    token: string,
    amount: string
  ): Promise<string> => {
    if (!walletClient || !walletClient.account) throw new Error("Wallet not connected");

    setLoading(true);
    try {
      const tokenInfo = await getTokenInfo(token);
      const amountWei = parseUnits(amount, tokenInfo.decimals);

      // First approve the token using safe approval pattern
      await safeApprove(token, MINILEND_ADDRESS, amountWei);

      // Now deposit collateral
      const tx = await walletClient.writeContract({
        address: MINILEND_ADDRESS,
        abi: MINILEND_ABI,
        functionName: "depositCollateral",
        args: [token as `0x${string}`, amountWei],
        chain: celo,
        account: walletClient.account!,
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // Check if transaction was successful
      if (receipt.status === 'reverted') {
        throw new Error("Transaction failed. Please check the transaction on CeloScan for details.");
      }

      return tx;
    } catch (error: any) {
      console.error("Deposit collateral error:", error);
      if (error.message.includes("insufficient funds")) {
        throw new Error("You don't have enough money in your wallet.");
      } else if (error.message.includes("User rejected")) {
        throw new Error("Transaction was cancelled.");
      } else if (error.message.includes("chain")) {
        throw new Error("Please switch to the Celo network in your wallet settings.");
      } else {
        throw new Error("Failed to deposit collateral. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const borrow = async (
    token: string,
    amount: string,
    collateralToken: string
  ): Promise<string> => {
    if (!walletClient || !walletClient.account) throw new Error("Wallet not connected");

    setLoading(true);
    try {
      const tokenInfo = await getTokenInfo(token);
      const amountWei = parseUnits(amount, tokenInfo.decimals);

      const tx = await walletClient.writeContract({
        address: MINILEND_ADDRESS,
        abi: MINILEND_ABI,
        functionName: "borrow",
        args: [
          token as `0x${string}`,
          amountWei,
          collateralToken as `0x${string}`,
        ],
        chain: celo,
        account: walletClient.account!,
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // Check if transaction was successful
      if (receipt.status === 'reverted') {
        throw new Error("Transaction failed. Please check the transaction on CeloScan for details.");
      }

      return tx;
    } catch (error: any) {
      console.error("Borrow error:", error);

      // Check for RPC errors first
      if (error.message?.includes("Internal JSON-RPC error") || 
          error.message?.includes("RPC Error") ||
          error.message?.includes("network error")) {
        throw new Error("Network connection issue. Please check your internet and try again.");
      }
      
      // Check for specific contract errors
      if (error.message.includes("No collateral deposited")) {
        throw new Error(
          "You need to deposit collateral first before borrowing."
        );
      } else if (error.message.includes("Insufficient collateral")) {
        throw new Error("You need more collateral to borrow this amount.");
      } else if (error.message.includes("Token borrow cap exceeded")) {
        throw new Error("The borrowing limit for this token has been reached.");
      } else if (error.message.includes("Borrowing paused")) {
        throw new Error(
          "Borrowing is currently unavailable for this money type."
        );
      } else if (error.message.includes("User rejected")) {
        throw new Error("Transaction was cancelled.");
      } else if (error.message.includes("chain")) {
        throw new Error("Please switch to the Celo network in your wallet settings.");
      } else {
        throw new Error("Failed to borrow money. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const repay = async (token: string, amount: string): Promise<string> => {
    if (!walletClient || !walletClient.account) throw new Error("Wallet not connected");

    setLoading(true);
    try {
      const tokenInfo = await getTokenInfo(token);
      const amountWei = parseUnits(amount, tokenInfo.decimals);

      // First approve the token using safe approval pattern
      await safeApprove(token, MINILEND_ADDRESS, amountWei);

      // Now repay
      const tx = await walletClient.writeContract({
        address: MINILEND_ADDRESS,
        abi: MINILEND_ABI,
        functionName: "repay",
        args: [token as `0x${string}`, amountWei],
        chain: celo,
        account: walletClient.account!,
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // Check if transaction was successful
      if (receipt.status === 'reverted') {
        throw new Error("Transaction failed. Please check the transaction on CeloScan for details.");
      }

      return tx;
    } catch (error: any) {
      console.error("Repay error:", error);
      if (error.message.includes("insufficient funds")) {
        throw new Error("You don't have enough money to pay back this amount.");
      } else if (error.message.includes("User rejected")) {
        throw new Error("Transaction was cancelled.");
      } else if (error.message.includes("chain")) {
        throw new Error("Please switch to the Celo network in your wallet settings.");
      } else {
        throw new Error("Failed to pay back loan. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const withdraw = async (token: string, amount: string): Promise<string> => {
    if (!walletClient || !walletClient.account) throw new Error("Wallet not connected");

    setLoading(true);
    try {
      const tokenInfo = await getTokenInfo(token);
      const amountWei = parseUnits(amount, tokenInfo.decimals);

      const tx = await walletClient.writeContract({
        address: MINILEND_ADDRESS,
        abi: MINILEND_ABI,
        functionName: "withdraw",
        args: [token as `0x${string}`, amountWei],
        chain: celo,
        account: walletClient.account!,
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // Check if transaction was successful
      if (receipt.status === 'reverted') {
        throw new Error("Transaction failed. Please check the transaction on CeloScan for details.");
      }

      return tx;
    } catch (error: any) {
      console.error("Withdraw error:", error);
      if (error.message.includes("Deposit still locked")) {
        throw new Error(
          "Your deposit is still locked. Please wait until the lock period ends."
        );
      } else if (error.message.includes("Repay loans before withdrawing")) {
        throw new Error("You need to repay your loans before withdrawing.");
      } else if (error.message.includes("Insufficient deposit balance")) {
        throw new Error(
          "You don't have enough balance to withdraw this amount."
        );
      } else if (error.message.includes("User rejected")) {
        throw new Error("Transaction was cancelled.");
      } else if (error.message.includes("chain")) {
        throw new Error("Please switch to the Celo network in your wallet settings.");
      } else {
        throw new Error("Failed to withdraw money. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getUserBalance = async (
    user: string,
    token: string
  ): Promise<string> => {
    try {
      const balance = await miniLendContract.read.getUserBalance([
        user as `0x${string}`,
        token as `0x${string}`,
      ]);
      return balance.toString();
    } catch (error) {
      console.error("Error getting user balance:", error);
      return "0";
    }
  };

  const getUserDeposits = async (
    user: string,
    token: string
  ): Promise<string> => {
    try {
      const deposits = await miniLendContract.read.userDeposits([
        user as `0x${string}`,
        token as `0x${string}`,
      ]);
      return deposits.toString();
    } catch (error) {
      console.error("Error getting user deposits:", error);
      return "0";
    }
  };

  const getUserBorrows = async (
    user: string,
    token: string
  ): Promise<string> => {
    try {
      const borrows = await miniLendContract.read.userBorrows([
        user as `0x${string}`,
        token as `0x${string}`,
      ]);
      return borrows.toString();
    } catch (error) {
      console.error("Error getting user borrows:", error);
      return "0";
    }
  };

  const getUserCollateral = async (
    user: string,
    token: string
  ): Promise<string> => {
    try {
      const collateral = await miniLendContract.read.userCollateral([
        user as `0x${string}`,
        token as `0x${string}`,
      ]);
      return collateral.toString();
    } catch (error) {
      console.error("Error getting user collateral:", error);
      return "0";
    }
  };

  const getDepositLockEnd = async (
    user: string,
    token: string
  ): Promise<number> => {
    try {
      const lockEnd = await miniLendContract.read.depositLockEnd([
        user as `0x${string}`,
        token as `0x${string}`,
      ]);
      return Number(lockEnd);
    } catch (error) {
      console.error("Error getting deposit lock end:", error);
      return 0;
    }
  };

  const getBorrowStartTime = async (
    user: string,
    token: string
  ): Promise<number> => {
    try {
      const startTime = await miniLendContract.read.borrowStartTime([
        user as `0x${string}`,
        token as `0x${string}`,
      ]);
      return Number(startTime);
    } catch (error) {
      console.error("Error getting borrow start time:", error);
      return 0;
    }
  };

  const getTotalSupply = async (token: string): Promise<string> => {
    try {
      const supply = await miniLendContract.read.totalSupply([
        token as `0x${string}`,
      ]);
      return supply.toString();
    } catch (error) {
      console.error("Error getting total supply:", error);
      return "0";
    }
  };

  const batchGetUserData = async (user: string, tokens: string[]) => {
    try {
      const promises = tokens.map(async (token) => {
        const [deposits, borrows, collateral, lockEnd, totalSupply] = await Promise.all([
          getUserDeposits(user, token),
          getUserBorrows(user, token), 
          getUserCollateral(user, token),
          getDepositLockEnd(user, token),
          getTotalSupply(token)
        ]);
        return { token, deposits, borrows, collateral, lockEnd, totalSupply };
      });
      return await Promise.all(promises);
    } catch (error) {
      console.error("Error batch getting user data:", error);
      return [];
    }
  };

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
        withdraw,
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
        batchGetUserData,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
}

export function useContract() {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error("useContract must be used within a ContractProvider");
  }
  return context;
}
