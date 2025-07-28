// hooks/useThirdwebWallet.ts
import {
    useActiveAccount,
    useActiveWallet,
    useConnect,
    useDisconnect,
  } from "thirdweb/react";
  import { createWallet } from "thirdweb/wallets";
  import { celo } from "thirdweb/chains";
  
  export function useThirdwebWallet() {
    // Account info (address, chain, signer)
    const account = useActiveAccount();
  
    // Wallet instance (for actions like switchChain, disconnect)
    const wallet = useActiveWallet();
  
    // Connect logic
    const { connect, isConnecting, error: connectError } = useConnect();
  
    // Disconnect logic
    const { disconnect } = useDisconnect();
  
    // Example: connect to MetaMask
    const connectMetaMask = () =>
      connect(createWallet("io.metamask"), { chain: celo });
  
    // Example: connect to Coinbase Wallet
    const connectCoinbase = () =>
      connect(createWallet("com.coinbase.wallet"), { chain: celo });
  
    // Example: switch chain
    const switchToCelo = async () => {
      if (wallet) {
        await wallet.switchChain(celo);
      }
    };
  
    return {
      isConnected: !!account,
      address: account?.address ?? null,
      connectMetaMask,
      connectCoinbase,
      disconnect,
      isConnecting,
      error: connectError,
      chain: account?.chain,
      wallet,
      switchToCelo,
    };
  }
  