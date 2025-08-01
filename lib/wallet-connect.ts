"use client";

import { createWalletClient, custom, type WalletClient } from "viem";
import { celo } from "viem/chains";

export interface WalletConnectionResult {
  address: string;
  signature: string;
  provider: string;
}

export interface WalletProvider {
  id: string;
  name: string;
  icon: string;
  walletConnectId?: string;
  universalLink?: string;
  mobileLink?: string;
}

export const SUPPORTED_WALLETS: WalletProvider[] = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    walletConnectId: "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
    universalLink: "https://metamask.io/download/",
    mobileLink: "metamask://"
  },
  {
    id: "trust",
    name: "Trust Wallet",
    icon: "🛡️",
    walletConnectId: "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0",
    universalLink: "https://trustwallet.com/download",
    mobileLink: "trust://"
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "🔵",
    walletConnectId: "fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa",
    universalLink: "https://www.coinbase.com/wallet/downloads",
    mobileLink: "cbwallet://"
  }
];

interface WalletConnectSession {
  topic: string;
  accounts: string[];
  chainId: number;
}

export class WalletConnectionManager {
  private static instance: WalletConnectionManager;
  private connectionData: WalletConnectionResult | null = null;
  private pendingConnection: Promise<WalletConnectionResult> | null = null;
  private wcSession: WalletConnectSession | null = null;
  private qrCodeUri: string | null = null;

  static getInstance(): WalletConnectionManager {
    if (!WalletConnectionManager.instance) {
      WalletConnectionManager.instance = new WalletConnectionManager();
    }
    return WalletConnectionManager.instance;
  }

  // Generate WalletConnect URI for QR code or deep linking
  private generateWalletConnectUri(): string {
    const bridge = "https://bridge.walletconnect.org";
    const key = this.generateRandomKey();
    const version = "1";
    const chainId = "42220"; // Celo mainnet
    
    return `wc:${key}@${version}?bridge=${encodeURIComponent(bridge)}&key=${key}&chainId=${chainId}`;
  }

  private generateRandomKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Get stored connection result
  getStoredConnection(): WalletConnectionResult | null {
    const stored = localStorage.getItem('wallet_connection');
    if (!stored) return null;

    try {
      const data = JSON.parse(stored);
      // Check if connection is still valid (24 hours)
      if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
        this.clearStoredConnection();
        return null;
      }
      return {
        address: data.address,
        signature: data.signature,
        provider: data.provider
      };
    } catch {
      return null;
    }
  }

  // Store successful connection result
  private storeConnectionResult(result: WalletConnectionResult): void {
    const connectionData = {
      ...result,
      timestamp: Date.now()
    };
    localStorage.setItem('wallet_connection', JSON.stringify(connectionData));
    this.connectionData = result;
  }

  // Clear stored connection
  clearStoredConnection(): void {
    localStorage.removeItem('wallet_connection');
    this.connectionData = null;
    this.wcSession = null;
  }

  // Get QR code URI for display
  getQrCodeUri(): string | null {
    return this.qrCodeUri;
  }

  // Connect wallet using WalletConnect or direct injection
  async connectWallet(walletId: string): Promise<WalletConnectionResult> {
    if (this.pendingConnection) {
      return this.pendingConnection;
    }

    const wallet = SUPPORTED_WALLETS.find(w => w.id === walletId);
    if (!wallet) {
      throw new Error(`Unsupported wallet: ${walletId}`);
    }

    // Check if wallet is injected (desktop browser with extension)
    if (typeof window !== 'undefined' && window.ethereum) {
      return this.connectInjectedWallet(walletId);
    }

    // Use WalletConnect for mobile or non-injected connections
    return this.connectViaWalletConnect(wallet);
  }

  // Connect using injected wallet (browser extension)
  private async connectInjectedWallet(walletId: string): Promise<WalletConnectionResult> {
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      const message = `Connect to MiniLend\nTimestamp: ${Date.now()}`;
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address]
      });

      const result: WalletConnectionResult = {
        address,
        signature,
        provider: walletId
      };

      this.storeConnectionResult(result);
      return result;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to connect wallet');
    }
  }

  // Connect using WalletConnect protocol
  private async connectViaWalletConnect(wallet: WalletProvider): Promise<WalletConnectionResult> {
    const uri = this.generateWalletConnectUri();
    this.qrCodeUri = uri;

    this.pendingConnection = new Promise((resolve, reject) => {
      // Create deep link for mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile && wallet.mobileLink) {
        const encodedUri = encodeURIComponent(uri);
        const deepLink = `${wallet.mobileLink}wc?uri=${encodedUri}`;
        window.location.href = deepLink;
      }

      // Simulate WalletConnect session (in real implementation, use @walletconnect/client)
      const timeout = setTimeout(() => {
        this.pendingConnection = null;
        this.qrCodeUri = null;
        reject(new Error('Connection timeout'));
      }, 5 * 60 * 1000);

      // Simulate successful connection after user interaction
      // In real implementation, this would be handled by WalletConnect events
      const simulateConnection = () => {
        clearTimeout(timeout);
        
        // Mock connection result
        const mockAddress = '0x' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
        const mockSignature = '0x' + Array.from({length: 130}, () => Math.floor(Math.random() * 16).toString(16)).join('');
        
        const result: WalletConnectionResult = {
          address: mockAddress,
          signature: mockSignature,
          provider: wallet.id
        };

        this.storeConnectionResult(result);
        this.qrCodeUri = null;
        this.pendingConnection = null;
        resolve(result);
      };

      // For demo purposes, auto-connect after 3 seconds
      // Remove this in production and handle real WalletConnect events
      setTimeout(simulateConnection, 3000);
    });

    return this.pendingConnection;
  }

  // Create wallet client from stored connection
  createWalletClient(connection: WalletConnectionResult): WalletClient | null {
    // For WalletConnect connections, create a custom transport
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        return createWalletClient({
          chain: celo,
          transport: custom(window.ethereum),
          account: connection.address as `0x${string}`
        });
      } catch {
        return null;
      }
    }

    // For WalletConnect sessions, return null as transactions would be handled differently
    return null;
  }
}