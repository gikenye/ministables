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
import { signIn } from "next-auth/react";

export const CELO_CHAIN_ID_HEX = "0xa4c0";
export const CELO_CHAIN_ID_DECIMAL = 42220;

interface StoredWalletConnection {
  address: string;
  signature: string;
  provider: string;
  timestamp: number;
}

interface WalletProvider {
  id: string;
  name: string;
  deepLink: (url: string) => string;
}

interface EnhancedWalletContextType {
  isConnected: boolean;
  address: string | null;
  connect: (providerId?: string) => Promise<string | null>;
  disconnect: () => void;
  isConnecting: boolean;
  walletClient: WalletClient | null;
  error: string | null;
  chainId: string | null;
  showWalletModal: boolean;
  setShowWalletModal: (show: boolean) => void;
  availableProviders: WalletProvider[];
}

const WALLET_PROVIDERS: WalletProvider[] = [
  {
    id: "metamask",
    name: "MetaMask",
    deepLink: (url: string) => `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, "")}`
  },
  {
    id: "trust",
    name: "Trust Wallet", 
    deepLink: (url: string) => `https://link.trustwallet.com/open_url?coin_id=52752&url=${encodeURIComponent(url)}`
  }
];

const EnhancedWalletContext = createContext<EnhancedWalletContextType | null>(null);

export function EnhancedWalletProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const isProviderAvailable = typeof window !== "undefined" && !!window.ethereum;

  const storeWalletConnection = (address: string, signature: string, provider: string) => {
    const connection: StoredWalletConnection = {
      address,
      signature,
      provider,
      timestamp: Date.now()
    };
    localStorage.setItem('wallet_connection', JSON.stringify(connection));
  };

  const getStoredConnection = (): StoredWalletConnection | null => {
    const stored = localStorage.getItem('wallet_connection');
    if (!stored) return null;
    
    try {
      const connection = JSON.parse(stored);
      if (Date.now() - connection.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('wallet_connection');
        return null;
      }
      return connection;
    } catch {
      return null;
    }
  };

  const connect = async (providerId?: string) => {
    if (!providerId) {
      setShowWalletModal(true);
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      if (isProviderAvailable) {
        return await connectDirectly();
      }
      return await connectViaDeepLink(providerId);
    } catch (error: any) {
      setError(error.message || "Failed to connect wallet");
      return null;
    } finally {
      setIsConnecting(false);
    }
  };

  const connectDirectly = async () => {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts?.length) throw new Error("No accounts found");

    const address = accounts[0];
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    
    const message = `Connect to MiniLend\nAddress: ${address}\nTime: ${Date.now()}`;
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [message, address]
    });

    const client = createWalletClient({
      chain: celo,
      transport: custom(window.ethereum),
      account: address as `0x${string}`,
    });

    setWalletClient(client);
    setAddress(address);
    setChainId(chainId);
    setIsConnected(true);

    storeWalletConnection(address, signature, "direct");

    await signIn("self-protocol", {
      address,
      verificationData: "",
      redirect: false,
    });

    return address;
  };

  const connectViaDeepLink = async (providerId: string) => {
    const provider = WALLET_PROVIDERS.find(p => p.id === providerId);
    if (!provider) throw new Error(`Unsupported provider: ${providerId}`);

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const returnUrl = `${window.location.origin}${window.location.pathname}?wallet_return=${sessionId}`;
    
    localStorage.setItem(`wallet_session_${sessionId}`, JSON.stringify({
      timestamp: Date.now(),
      provider: providerId
    }));

    const deepLinkUrl = provider.deepLink(returnUrl);
    
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 5 * 60 * 1000);
      
      const checkReturn = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const returnedSession = urlParams.get('wallet_return');
        
        if (returnedSession === sessionId) {
          clearTimeout(timeout);
          handleWalletReturn(sessionId).then(resolve).catch(reject);
        }
      };

      checkReturn();
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          setTimeout(checkReturn, 500);
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibility);
      
      const cleanup = () => {
        clearTimeout(timeout);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
      
      const originalResolve = resolve;
      const originalReject = reject;
      resolve = (value: string) => { cleanup(); originalResolve(value); };
      reject = (error: Error) => { cleanup(); originalReject(error); };

      window.location.href = deepLinkUrl;
    });
  };

  const handleWalletReturn = async (sessionId: string): Promise<string> => {
    let attempts = 0;
    while (!window.ethereum && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!window.ethereum) {
      throw new Error("Wallet provider not available");
    }

    return await connectDirectly();
  };

  const disconnect = () => {
    setIsConnected(false);
    setAddress(null);
    setWalletClient(null);
    setChainId(null);
    setError(null);
    localStorage.removeItem('wallet_connection');
  };

  useEffect(() => {
    const stored = getStoredConnection();
    if (stored && isProviderAvailable) {
      setAddress(stored.address);
      setIsConnected(true);
      
      const client = createWalletClient({
        chain: celo,
        transport: custom(window.ethereum),
        account: stored.address as `0x${string}`,
      });
      setWalletClient(client);
    }
  }, [isProviderAvailable]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('wallet_return');
    
    if (sessionId) {
      handleWalletReturn(sessionId).then(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('wallet_return');
        window.history.replaceState({}, '', url.toString());
      }).catch(console.error);
    }
  }, []);

  return (
    <EnhancedWalletContext.Provider
      value={{
        isConnected,
        address,
        connect,
        disconnect,
        isConnecting,
        walletClient,
        error,
        chainId,
        showWalletModal,
        setShowWalletModal,
        availableProviders: WALLET_PROVIDERS,
      }}
    >
      {children}
    </EnhancedWalletContext.Provider>
  );
}

export function useEnhancedWallet() {
  const context = useContext(EnhancedWalletContext);
  if (!context) {
    throw new Error("useEnhancedWallet must be used within an EnhancedWalletProvider");
  }
  return context;
}