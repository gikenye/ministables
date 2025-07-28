"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useConnect, useDisconnect, useActiveWallet, useActiveWalletChain, useActiveWalletConnectionStatus, useSwitchActiveWalletChain } from "thirdweb/react";
import { celo } from "thirdweb/chains";

// Define the WalletContextType interface
interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  walletClient: any | null; // Use 'any' for compatibility, as Thirdweb Wallet doesn't match viem's WalletClient
  error: string | null;
  chainId: string | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletClient, setWalletClient] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);

  const wallet = useActiveWallet();
  const connectionStatus = useActiveWalletConnectionStatus();
  const currentChain = useActiveWalletChain();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const switchChain = useSwitchActiveWalletChain();

  // Map Thirdweb connection status to isConnected and isConnecting
  useEffect(() => {
    setIsConnected(connectionStatus === "connected");
    setIsConnecting(connectionStatus === "connecting");
    setAddress(wallet?.getAccount()?.address || null);
    setWalletClient(wallet || null);
    setChainId(currentChain?.id ? `0x${currentChain.id.toString(16)}` : null);
  }, [connectionStatus, wallet, currentChain]);

  // Ensure Celo network on wallet connection
  useEffect(() => {
    const switchToCelo = async () => {
      try {
        if (wallet && currentChain?.id !== celo.id) {
          await switchChain(celo);
          console.log("Switched to Celo network");
        }
      } catch (error) {
        console.error("Error switching to Celo network:", error);
        setError("Failed to switch to Celo network");
      }
    };
    if (wallet) {
      switchToCelo();
    }
  }, [wallet, currentChain, switchChain]);

  // Handle wallet connection
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("No wallet detected. Please install a wallet extension or use a wallet-enabled browser.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Connect using Thirdweb's connect hook
      await connect(async () => {
        // Assuming wallets are defined in ThirdwebProvider
        const walletInstance = await import("thirdweb/wallets").then((module) =>
          module.createWallet("io.metamask")
        );
        return walletInstance;
      });
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

  // Handle wallet disconnection
  const disconnectWallet = () => {
    disconnect();
    setIsConnected(false);
    setAddress(null);
    setWalletClient(null);
    setChainId(null);
    setError(null);
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        address,
        connect: connectWallet,
        disconnect: disconnectWallet,
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