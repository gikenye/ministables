"use client"

import { useState, useEffect, createContext, useContext, type ReactNode } from "react"
import { createWalletClient, custom } from "viem"
import { celo } from "viem/chains"

interface WalletContextType {
  isConnected: boolean
  address: string | null
  connect: () => Promise<void>
  disconnect: () => void
  isConnecting: boolean
  walletClient: any
  error: string | null
}

const WalletContext = createContext<WalletContextType | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [walletClient, setWalletClient] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Only check connection on client side
    if (typeof window !== "undefined") {
      checkConnection()
    }
  }, [])

  const checkConnection = async () => {
    try {
      if (!window.ethereum) {
        return
      }

      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      })

      if (accounts && accounts.length > 0) {
        const client = createWalletClient({
          chain: celo,
          transport: custom(window.ethereum),
          account: accounts[0] as `0x${string}`,
        })

        setWalletClient(client)
        setAddress(accounts[0])
        setIsConnected(true)
        setError(null)
      }
    } catch (error) {
      console.error("Error checking wallet connection:", error)
      setError("Failed to check wallet connection")
    }
  }

  const connect = async () => {
    if (typeof window === "undefined") {
      setError("Wallet connection not available")
      return
    }

    if (!window.ethereum) {
      setError("Please install MetaMask or another Web3 wallet")
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      })

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found")
      }

      // Check current network
      const chainId = await window.ethereum.request({
        method: "eth_chainId",
      })

      // Switch to Celo network if not already on it
      if (chainId !== "0xa4ec") {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xa4ec" }],
          })
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
              })
            } catch (addError) {
              throw new Error("Failed to add Celo network to wallet")
            }
          } else {
            throw new Error("Failed to switch to Celo network")
          }
        }
      }

      // Create wallet client
      const client = createWalletClient({
        chain: celo,
        transport: custom(window.ethereum),
        account: accounts[0] as `0x${string}`,
      })

      setWalletClient(client)
      setAddress(accounts[0])
      setIsConnected(true)
      setError(null)
    } catch (error: any) {
      console.error("Error connecting wallet:", error)

      let errorMessage = "Failed to connect wallet"

      if (error.code === 4001) {
        errorMessage = "Connection was rejected by user"
      } else if (error.message.includes("User rejected")) {
        errorMessage = "Connection was rejected by user"
      } else if (error.message.includes("No accounts")) {
        errorMessage = "No wallet accounts found"
      } else if (error.message) {
        errorMessage = error.message
      }

      setError(errorMessage)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    setIsConnected(false)
    setAddress(null)
    setWalletClient(null)
    setError(null)
  }

  // Listen for account changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect()
        } else {
          setAddress(accounts[0])
          // Recreate wallet client with new account
          const client = createWalletClient({
            chain: celo,
            transport: custom(window.ethereum),
            account: accounts[0] as `0x${string}`,
          })
          setWalletClient(client)
        }
      }

      const handleChainChanged = (chainId: string) => {
        // Reload the page when chain changes
        window.location.reload()
      }

      window.ethereum.on("accountsChanged", handleAccountsChanged)
      window.ethereum.on("chainChanged", handleChainChanged)

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
          window.ethereum.removeListener("chainChanged", handleChainChanged)
        }
      }
    }
  }, [])

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        address,
        connect,
        disconnect,
        isConnecting,
        walletClient,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}
