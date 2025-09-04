interface Window {
  ethereum?: {
    isMiniPay?: boolean;
    isValora?: boolean;
    isMetaMask?: boolean;
    isCoinbaseWallet?: boolean;
    isTrust?: boolean;
    [key: string]: any;
  };
  trustwallet?: any;
  web3?: {
    currentProvider: any;
  };
}