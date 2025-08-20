"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownLeft, Shield, AlertCircle, CreditCard, ChevronDown } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { parseUnits } from "viem";
import { OnrampDepositModal } from "./OnrampDepositModal";
import { onrampService } from "@/lib/services/onrampService";
import { oracleService } from "@/lib/services/oracleService";
import { NEW_SUPPORTED_TOKENS, MINILEND_ADDRESS } from "@/lib/services/thirdwebService";
import { getTokenIcon } from "@/lib/utils/tokenIcons";
import { getContract, prepareContractCall, waitForReceipt } from "thirdweb";
import { client } from "@/lib/thirdweb/client";
import { celo } from "thirdweb/chains";

import { useActiveAccount, useSendTransaction, useReadContract, useWalletBalance } from "thirdweb/react";

interface BorrowMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBorrow: (
    token: string,
    amount: string,
    collateralToken: string
  ) => Promise<void>;
  onDepositCollateral: (token: string, amount: string) => Promise<void>;
  userBalances: Record<string, string>;
  userCollaterals: Record<string, string>;
  tokenInfos: Record<string, { symbol: string; decimals: number }>;
  loading: boolean;
}

// Constants
const COLLATERALIZATION_RATIO = 1.5; // 150% collateralization

// Error handling utility
const handleTransactionError = (error: any, toast: any, defaultMessage: string) => {
  console.error("Transaction error:", error);
  
  if (error.message?.includes("FILE_ERROR_NO_SPACE") ||
      error.message?.includes("QuotaExceededError") ||
      error.message?.includes("no space")) {
    toast({
      title: "Storage Error",
      description: "Your device is running out of disk space. Please free up some space and try again.",
      variant: "destructive",
    });
  } else if (error.message?.includes("User rejected") ||
             error.message?.includes("rejected the request")) {
    toast({
      title: "Transaction Cancelled",
      description: "You cancelled the transaction in your wallet.",
      variant: "default",
    });
  } else {
    toast({
      title: "Error",
      description: error.message || defaultMessage,
      variant: "destructive",
    });
  }
};

export function BorrowMoneyModal({
  isOpen,
  onClose,
  onBorrow,
  onDepositCollateral,
  userBalances,
  userCollaterals,
  tokenInfos,
  loading,

}: BorrowMoneyModalProps) {
  const { toast } = useToast();
  const account = useActiveAccount();
  
  const contract = getContract({
    client,
    chain: celo,
    address: MINILEND_ADDRESS,
  });
  
  // Valid collateral assets from deployment config
  const SUPPORTED_COLLATERAL = useMemo(() => [
    "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
    "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
    "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD


    // "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
    // "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3", // USDGLO
  ], []);
  
  // Only cKES available for borrowing for now
  const SUPPORTED_STABLECOINS = useMemo(() => {
    return ["0x456a3D042C0DbD3db53D5489e98dFb038553B0d0"]; // cKES only
    // return Object.keys(tokenInfos).filter(token => 
    //   !["0xcebA9300f2b948710d2653dD7B07f33A8B32118C", "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3"].includes(token)
    // );
  }, []);

  const [form, setForm] = useState({
    token: "",
    collateralToken: "",
    amount: "",
  });

  const [requiredCollateral, setRequiredCollateral] = useState<string | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOnrampModal, setShowOnrampModal] = useState(false);
  const [showSecurityDropdown, setShowSecurityDropdown] = useState(false);

  const securityDropdownRef = useRef<HTMLDivElement>(null);

  const hasCollateral = (token: string) => {
    const collateral = userCollaterals[token];
    return collateral && collateral !== "0";
  };

  const hasSufficientCollateral = (token: string, required: string) => {
    if (!hasCollateral(token)) return false;
    const available = parseFloat(formatAmount(
      userCollaterals[token],
      tokenInfos[token]?.decimals || 18
    ));
    return available >= parseFloat(required);
  };

  // Use same simplified logic as TVL - only fetch totalSupply to reduce requests
  const { data: totalSupply, isPending: checkingLiquidity } = useReadContract({
    contract,
    method: "function totalSupply(address) view returns (uint256)",
    params: [form.token || "0x0000000000000000000000000000000000000000"],
    queryOptions: {
      enabled: !!form.token,
      retry: 2,
    },
  });

  const selectedTokenLiquidity = useMemo(() => {
    if (!form.token || checkingLiquidity) return null;
    if (!totalSupply || totalSupply <= 0) return "0";
    
    const decimals = tokenInfos[form.token]?.decimals || 18;
    return formatAmount(totalSupply.toString(), decimals);
  }, [form.token, totalSupply, tokenInfos, checkingLiquidity]);

  const { mutateAsync: sendTransaction, isPending: isTransactionPending } = useSendTransaction({ payModal: false });

  // Balances for auto-wrap support when depositing collateral in CELO
  const { data: collateralTokenBalance } = useWalletBalance({
    client,
    chain: celo,
    address: account?.address,
    tokenAddress: form.collateralToken || undefined,
  });
  const { data: nativeBalanceData } = useWalletBalance({
    client,
    chain: celo,
    address: account?.address,
  });

  const handleBorrowWithCollateral = async () => {
    if (!form.token || !form.collateralToken || !form.amount || !requiredCollateral) return;

    if (selectedTokenLiquidity === "0") {
      toast({
        title: "No Liquidity Available",
        description: `There is no liquidity available for ${tokenInfos[form.token]?.symbol}. Please select a different token.`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setTransactionStatus("Processing loan request...");

    try {
      if (!hasSufficientCollateral(form.collateralToken, requiredCollateral)) {
        setTransactionStatus("Depositing collateral...");
        const decimals = tokenInfos[form.collateralToken]?.decimals || 18;
        const walletBalance = parseFloat(formatAmount(
          userBalances[form.collateralToken] || "0",
          decimals
        ));
        const CELO_ERC20 = "0x471EcE3750Da237f93B8E339c536989b8978a438";
        const required = parseFloat(requiredCollateral);

        // Auto-wrap native CELO to ERC-20 if collateral is CELO and ERC-20 balance is short
        if (form.collateralToken === CELO_ERC20 && walletBalance < required) {
          const nativeBal = parseFloat(nativeBalanceData?.displayValue || "0");
          const amountToWrap = Math.min(required - walletBalance, nativeBal);
          if (amountToWrap > 0) {
            const celoContract = getContract({ client, chain: celo, address: CELO_ERC20 });
            const wrapTx = prepareContractCall({
              contract: celoContract,
              method: "function deposit()",
              params: [],
              value: parseUnits(amountToWrap.toString(), 18),
            });
            const wrapResult = await sendTransaction(wrapTx);
            if (wrapResult?.transactionHash) {
              await waitForReceipt({ client, chain: celo, transactionHash: wrapResult.transactionHash });
            }
          }
        }

        // Re-check balance after potential wrap
        const updatedBalance = parseFloat(formatAmount(
          userBalances[form.collateralToken] || "0",
          decimals
        ));
        if (updatedBalance < required) {
          throw new Error(`Insufficient ${tokenInfos[form.collateralToken]?.symbol} in wallet. You need ${requiredCollateral} but only have ${updatedBalance.toFixed(4)}.`);
        }

        setTransactionStatus("Depositing collateral...");
        await onDepositCollateral(form.collateralToken, requiredCollateral);
        setTransactionStatus("Collateral deposited ✓");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setTransactionStatus("Processing loan...");
      await onBorrow(form.token, form.amount, form.collateralToken);
      
      setTransactionStatus("Loan completed ✓");
      toast({
        title: "Loan Successful",
        description: `${form.amount} ${tokenInfos[form.token]?.symbol} has been sent to your wallet`,
      });
      
      setTimeout(() => {
        setForm({ token: "", collateralToken: "", amount: "" });
        setTransactionStatus(null);
        onClose();
      }, 2000);
    } catch (error: any) {
      setTransactionStatus("Transaction failed ✗");
      
      if (error.message?.includes("insufficient reserves") || error.message?.includes("E5")) {
        toast({
          title: "Insufficient Contract Reserves",
          description: "The contract doesn't have enough funds for this loan. Please try a smaller amount.",
          variant: "destructive",
        });
      } else {
        handleTransactionError(error, toast, "Failed to complete loan transaction");
      }
      
      setTimeout(() => setTransactionStatus(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const run = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0 || !form.token || !form.collateralToken) {
      setRequiredCollateral(null);
      return;
    }
    
      const ensurePrice = async (address: string) => {
        if (tokenPrices[address] !== undefined) return tokenPrices[address];
        try {
          const price = await oracleService.getTokenPrice(address);
          setTokenPrices((prev) => ({ ...prev, [address]: price }));
          return price;
        } catch {
          return NaN;
        }
      };

      const [borrowTokenPrice, collateralTokenPrice] = await Promise.all([
        ensurePrice(form.token),
        ensurePrice(form.collateralToken),
      ]);

      if (!isFinite(borrowTokenPrice) || !isFinite(collateralTokenPrice) || borrowTokenPrice <= 0 || collateralTokenPrice <= 0) {
        setRequiredCollateral(null);
        return;
      }

    const borrowValueUSD = parseFloat(form.amount) * borrowTokenPrice;
    const requiredCollateralUSD = borrowValueUSD * COLLATERALIZATION_RATIO;
    const requiredCollateralAmount = requiredCollateralUSD / collateralTokenPrice;
    setRequiredCollateral(requiredCollateralAmount.toFixed(6));
  };
    run();
  }, [form.amount, form.token, form.collateralToken, tokenPrices]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (securityDropdownRef.current && !securityDropdownRef.current.contains(event.target as Node)) {
        setShowSecurityDropdown(false);
      }
    };

    if (showSecurityDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSecurityDropdown]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-xs mx-auto bg-white border-0 shadow-lg">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-base font-medium text-gray-900">
            Borrow Money
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Borrow tokens using collateral
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Borrow
            </Label>
            <Select
              value={form.token}
              onValueChange={(value) => setForm({ ...form, token: value })}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Choose token" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_STABLECOINS.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 text-center">
                    No tokens available for borrowing
                  </div>
                ) : (
                  SUPPORTED_STABLECOINS.map((token) => {
                    const tokenInfo = tokenInfos[token];
                    const symbol = tokenInfo?.symbol || token.slice(0, 6) + "...";
                    return (
                      <SelectItem key={token} value={token}>
                        <div className="flex items-center gap-2">
                          {getTokenIcon(symbol).startsWith('http') || getTokenIcon(symbol).startsWith('/') ? (
                            <img src={getTokenIcon(symbol)} alt={symbol} className="w-4 h-4 rounded-full" />
                          ) : (
                            <span className="text-sm">{getTokenIcon(symbol)}</span>
                          )}
                          <span className="font-medium">{symbol}</span>
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
            
            {form.token && (
              <div className="mt-2 text-xs text-gray-600">
                {checkingLiquidity ? (
                  <span>Checking liquidity...</span>
                ) : selectedTokenLiquidity === "0" ? (
                  <span className="text-red-600 font-medium">⚠️ No liquidity available for this asset</span>
                ) : selectedTokenLiquidity ? (
                  <span className="text-green-600">Available: {selectedTokenLiquidity} {tokenInfos[form.token]?.symbol}</span>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Amount
            </Label>
            <Input
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="h-10"
              min="0.01"
              step="0.01"
            />
          </div>

          <div className="relative" ref={securityDropdownRef}>
            <Label className="text-xs font-medium text-gray-600 mb-1 block">
              Use as Security
            </Label>
            <button
              type="button"
              onClick={() => setShowSecurityDropdown(!showSecurityDropdown)}
              className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-md text-left flex items-center justify-between hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex items-center gap-2">
                {form.collateralToken ? (
                  <>
                    {getTokenIcon(tokenInfos[form.collateralToken]?.symbol || '').startsWith('http') || getTokenIcon(tokenInfos[form.collateralToken]?.symbol || '').startsWith('/') ? (
                      <img src={getTokenIcon(tokenInfos[form.collateralToken]?.symbol || '')} alt={tokenInfos[form.collateralToken]?.symbol} className="w-4 h-4 rounded-full" />
                    ) : (
                      <span className="text-sm">{getTokenIcon(tokenInfos[form.collateralToken]?.symbol || '')}</span>
                    )}
                    <span className="font-medium">{tokenInfos[form.collateralToken]?.symbol}</span>
                  </>
                ) : (
                  <span className="text-gray-500">Select security</span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showSecurityDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showSecurityDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                {SUPPORTED_COLLATERAL.map((token) => {
                  const tokenInfo = tokenInfos[token];
                  const symbol = tokenInfo?.symbol || token.slice(0, 6) + "...";
                  return (
                    <button
                      key={token}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, collateralToken: token });
                        setShowSecurityDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                    >
                      {getTokenIcon(symbol).startsWith('http') || getTokenIcon(symbol).startsWith('/') ? (
                        <img src={getTokenIcon(symbol)} alt={symbol} className="w-4 h-4 rounded-full" />
                      ) : (
                        <span className="text-sm">{getTokenIcon(symbol)}</span>
                      )}
                      <span className="font-medium">{symbol}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {form.collateralToken && (
            <div className="mt-2 grid grid-cols-1 gap-1 text-xs">
              <div className="text-gray-600">
                Wallet balance: {formatAmount(
                  userBalances[form.collateralToken] || "0",
                  tokenInfos[form.collateralToken]?.decimals || 18
                )} {tokenInfos[form.collateralToken]?.symbol}
              </div>
              {hasCollateral(form.collateralToken) && (
                <div className="text-gray-600">
                  Deposited collateral: {formatAmount(
                    userCollaterals[form.collateralToken] || "0",
                    tokenInfos[form.collateralToken]?.decimals || 18
                  )} {tokenInfos[form.collateralToken]?.symbol}
                </div>
              )}
            </div>
          )}

          {requiredCollateral && form.collateralToken && (
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <div className="text-xs text-blue-800">
                Required: {requiredCollateral} {tokenInfos[form.collateralToken]?.symbol}
                {hasCollateral(form.collateralToken) && (
                  <div className="text-green-600 mt-1">
                    Available: {formatAmount(
                      userCollaterals[form.collateralToken],
                      tokenInfos[form.collateralToken]?.decimals || 18
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {form.collateralToken && requiredCollateral && !hasSufficientCollateral(form.collateralToken, requiredCollateral) && onrampService.isAssetSupportedForOnramp(tokenInfos[form.collateralToken]?.symbol || "") && (
            <div className="bg-green-50 border border-green-200 rounded p-2">
              <div className="text-xs font-medium text-green-800 mb-2">
                Need {tokenInfos[form.collateralToken]?.symbol}?
              </div>
              <Button
                onClick={() => setShowOnrampModal(true)}
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs border-green-400 text-green-700 hover:bg-green-100"
              >
                <CreditCard className="w-3 h-3 mr-1" />
                Mobile Money
              </Button>
            </div>
          )}

          {transactionStatus && (
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <div className="text-xs text-blue-800 font-medium">
                {transactionStatus}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-9 text-sm"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBorrowWithCollateral}
              disabled={
                isProcessing ||
                isTransactionPending ||
                !form.token ||
                !form.collateralToken ||
                !form.amount ||
                !requiredCollateral ||
                selectedTokenLiquidity === "0" ||
                checkingLiquidity
              }
              className="flex-1 h-9 text-sm bg-primary hover:bg-secondary text-white"
            >
              {isProcessing || isTransactionPending ? "Processing..." : "Borrow"}
            </Button>
          </div>
        </div>
      </DialogContent>

      {showOnrampModal && (
      <OnrampDepositModal
        isOpen={showOnrampModal}
        onClose={() => setShowOnrampModal(false)}
        selectedAsset={tokenInfos[form.collateralToken]?.symbol || ""}
        assetSymbol={tokenInfos[form.collateralToken]?.symbol || ""}
        onSuccess={(transactionCode, amount) => {
          toast({
            title: "Deposit Initiated",
            description: `${tokenInfos[form.collateralToken]?.symbol} deposit processing`,
          });
          setShowOnrampModal(false);
        }}
      />
      )}
    </Dialog>
  );
}
