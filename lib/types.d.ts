interface Window {
  ethereum?: {
    isMiniPay?: boolean;
    [key: string]: any;
  };
  trustwallet?: any;
  web3?: {
    currentProvider: any;
  };
}