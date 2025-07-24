"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { createWalletClient, custom, type WalletClient } from "viem";
import { celo } from "viem/chains";

// Define the Ethereum window type
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Celo Mainnet Chain ID
export const CELO_CHAIN_ID_HEX = "0xa4c0";
export const CELO_CHAIN_ID_DECIMAL = 42220;

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  walletClient: WalletClient | null;
  error: string | null;
  chainId: string | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);

  // Check if any wallet provider is available
  const isProviderAvailable = typeof window !== "undefined" && !!window.ethereum;

  // Check for existing connection on component mount
  useEffect(() => {
    if (isProviderAvailable) {
      checkConnection();
    }
  }, [isProviderAvailable]);

  // Check if user is already connected
  const checkConnection = async () => {
    try {
      // Get accounts without prompting user
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      if (accounts && accounts.length > 0) {
        // Get current chain ID
        const currentChainId = await window.ethereum.request({
          method: "eth_chainId",
        });

        // Create wallet client
        const client = createWalletClient({
          chain: celo,
          transport: custom(window.ethereum),
          account: accounts[0] as `0x${string}`,
        });

        setWalletClient(client);
        setAddress(accounts[0]);
        setChainId(currentChainId);
        setIsConnected(true);
        setError(null);
      }
    } catch (error) {
      console.error("Error checking connection:", error);
      // Don't set error state here as this is a silent check
    }
  };

  // Connect to wallet using the generic approach
  const connect = async () => {
    if (!isProviderAvailable) {
      setError("No wallet detected. Please install a wallet extension or use a wallet-enabled browser.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request accounts - this will prompt the user to connect
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found");
      }

      // Get current chain ID
      const currentChainId = await window.ethereum.request({
        method: "eth_chainId",
      });
      setChainId(currentChainId);

      // Create wallet client
      const client = createWalletClient({
        chain: celo,
        transport: custom(window.ethereum),
        account: accounts[0] as `0x${string}`,
      });

      setWalletClient(client);
      setAddress(accounts[0]);
      setIsConnected(true);
      setError(null);
    } catch (error: any) {
      console.error("Error connecting wallet:", error);

      let errorMessage = "Failed to connect wallet";

      if (error.code === 4001) {
        errorMessage = "Connection was rejected by user";
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet
  const disconnect = () => {
    setIsConnected(false);
    setAddress(null);
    setWalletClient(null);
    setChainId(null);
    setError(null);
  };

  // Listen for account and chain changes
  useEffect(() => {
    if (isProviderAvailable) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          disconnect();
        } else if (accounts[0] !== address) {
          // User switched accounts
          setAddress(accounts[0]);
          // Recreate wallet client with new account
          const client = createWalletClient({
            chain: celo,
            transport: custom(window.ethereum),
            account: accounts[0] as `0x${string}`,
          });
          setWalletClient(client);
        }
      };

      const handleChainChanged = (newChainId: string) => {
        setChainId(newChainId);
        // Reload the page on chain change
        window.location.reload();
      };

      // Subscribe to events
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      // Cleanup function
      return () => {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged,
        );
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, [isProviderAvailable, address]);

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
        chainId,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
