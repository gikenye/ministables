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
import { signIn } from "next-auth/react"; // Import signIn

declare global {
  interface Window {
    ethereum?: any;
  }
}

export const CELO_CHAIN_ID_HEX = "0xa4c0";
export const CELO_CHAIN_ID_DECIMAL = 42220;

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  connect: () => Promise<string | null>; // Modified to return address
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

  const isProviderAvailable = typeof window !== "undefined" && !!window.ethereum;

  useEffect(() => {
    if (isProviderAvailable) {
      checkConnection();
    }
  }, [isProviderAvailable]);

  const checkConnection = async () => {
    try {
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });
      if (accounts && accounts.length > 0) {
        const currentChainId = await window.ethereum.request({
          method: "eth_chainId",
        });
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

        // Sign in with NextAuth
        console.log("[checkConnection] Signing in with address:", accounts[0]);
        const response = await signIn("self-protocol", {
          address: accounts[0],
          verificationData: "",
          redirect: false,
        });
        console.log("[checkConnection] Sign-in response:", response);
        if (response?.error) {
          console.error("[checkConnection] Sign-in error:", response.error);
        }
      }
    } catch (error) {
      console.error("[checkConnection] Error checking connection:", error);
    }
  };

  const connect = async () => {
    if (!isProviderAvailable) {
      setError("No wallet detected. Please install a wallet extension or use a wallet-enabled browser.");
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found");
      }

      const currentChainId = await window.ethereum.request({
        method: "eth_chainId",
      });
      setChainId(currentChainId);

      const client = createWalletClient({
        chain: celo,
        transport: custom(window.ethereum),
        account: accounts[0] as `0x${string}`,
      });
      setWalletClient(client);
      setAddress(accounts[0]);
      setIsConnected(true);
      setError(null);

      // Sign in with NextAuth
      console.log("[connect] Signing in with address:", accounts[0]);
      const response = await signIn("self-protocol", {
        address: accounts[0],
        verificationData: "",
        redirect: false,
      });
      console.log("[connect] Sign-in response:", response);
      if (response?.error) {
        console.error("[connect] Sign-in error:", response.error);
        setError(response.error);
        return null;
      }

      return accounts[0]; // Return the connected address
    } catch (error: any) {
      console.error("[connect] Error connecting wallet:", error);
      let errorMessage = "Failed to connect wallet";
      if (error.code === 4001) {
        errorMessage = "Connection was rejected by user";
      } else if (error.message) {
        errorMessage = error.message;
      }
      setError(errorMessage);
      return null;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setIsConnected(false);
    setAddress(null);
    setWalletClient(null);
    setChainId(null);
    setError(null);
  };

  useEffect(() => {
    if (isProviderAvailable) {
      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else if (accounts[0] !== address) {
          setAddress(accounts[0]);
          const client = createWalletClient({
            chain: celo,
            transport: custom(window.ethereum),
            account: accounts[0] as `0x${string}`,
          });
          setWalletClient(client);
          // Sign in with new address
          console.log("[handleAccountsChanged] Signing in with new address:", accounts[0]);
          const response = await signIn("self-protocol", {
            address: accounts[0],
            verificationData: "",
            redirect: false,
          });
          console.log("[handleAccountsChanged] Sign-in response:", response);
          if (response?.error) {
            console.error("[handleAccountsChanged] Sign-in error:", response.error);
          }
        }
      };

      const handleChainChanged = (newChainId: string) => {
        setChainId(newChainId);
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
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