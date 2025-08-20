"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { TrendingUp, CreditCard } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { OnrampDepositModal } from "./OnrampDepositModal";
import { onrampService } from "@/lib/services/onrampService";
import { useToast } from "@/hooks/use-toast";
import { useActiveAccount, useSendTransaction, useWalletBalance } from "thirdweb/react";
// Define the minilend contract ABI for deposit function
export const minilendABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "token", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "uint256", "name": "lockPeriod", "type": "uint256"}
    ],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
import { getContract, prepareContractCall } from "thirdweb";
import { allowance } from "thirdweb/extensions/erc20";
import { client } from "@/lib/thirdweb/client";
import { celo } from "thirdweb/chains";
import { getTokenIcon } from "@/lib/utils/tokenIcons";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";
import { parseUnits } from "viem";

interface SaveMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (token: string, amount: string, lockPeriod: number) => Promise<void>;
  userBalances: Record<string, string>;
  tokenInfos: Record<string, { symbol: string; decimals: number }>;
  loading: boolean;
}

export function SaveMoneyModal({
  isOpen,
  onClose,
  onSave,
  userBalances,
  tokenInfos,
  loading,
}: SaveMoneyModalProps) {
  const account = useActiveAccount();

  const [form, setForm] = useState({
    token: "",
    amount: "",
    lockPeriod: "2592000", // 30 days default
  });

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showOnrampModal, setShowOnrampModal] = useState(false);
  const { toast } = useToast();

  const { data: walletBalanceData, isLoading: isBalanceLoading } = useWalletBalance({
    client,
    chain: celo,
    address: account?.address,
    tokenAddress: form.token || undefined,
  });

  // Also fetch native balance to support auto-wrap of gas token (CELO)
  const { data: nativeBalanceData } = useWalletBalance({
    client,
    chain: celo,
    address: account?.address,
  });

  const { mutateAsync: sendTransaction, isPending: isTransactionPending } = useSendTransaction({ payModal: false });

  const handleSave = async () => {
    if (!form.token || !form.amount || !form.lockPeriod) return;
    if (!account) {
      setError("Please connect your wallet first");
      return;
    }

    console.log("[SaveMoneyModal] Starting save with params:", {
      tokenAddress: form.token,
      tokenSymbol: tokenInfos[form.token]?.symbol,
      amount: form.amount,
      lockPeriod: form.lockPeriod,
      MINILEND_ADDRESS
    });
    
    // Validate balance
    const erc20Balance = parseFloat(walletBalanceData?.displayValue || "0");
    const inputAmount = parseFloat(form.amount);
    if (inputAmount > erc20Balance) {
      setError(`Amount exceeds available balance of ${erc20Balance} ${walletBalanceData?.symbol || ""}`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const decimals = tokenInfos[form.token]?.decimals || 18;
      const amountWei = parseUnits(form.amount, decimals);

      console.log("[SaveMoneyModal] Calculated wei amount:", {
        inputAmount,
        decimals,
        amountWei: amountWei.toString()
      });

      // Create token contract instance
      console.log("[SaveMoneyModal] Creating token contract instance for", form.token);
      const tokenContract = getContract({
        client,
        chain: celo,
        address: form.token
      });
      
      // 1. Check current allowance first
      const currentAllowance = await allowance({
        contract: tokenContract,
        owner: account.address,
        spender: MINILEND_ADDRESS,
      });
      
      console.log("[SaveMoneyModal] Current allowance:", currentAllowance.toString());
      
      // 2. If allowance is insufficient, approve
      if (currentAllowance < amountWei) {
        console.log("[SaveMoneyModal] Insufficient allowance, sending approve transaction");
        const approveTx = prepareContractCall({
          contract: tokenContract,
          method: "function approve(address spender, uint256 amount) returns (bool)",
          params: [MINILEND_ADDRESS, amountWei],
        });

        console.log("[SaveMoneyModal] Sending approve transaction");
        const approveResult = await sendTransaction(approveTx);
        console.log("[SaveMoneyModal] Approve transaction submitted:", approveResult?.transactionHash);
        
        // 3. Poll for allowance to be updated
        console.log("[SaveMoneyModal] Polling for allowance update...");
        let allowanceUpdated = false;
        
        for (let i = 0; i < 15; i++) {
          console.log(`[SaveMoneyModal] Allowance check attempt ${i+1}/15...`);
          // Wait 4 seconds between checks
          await new Promise(resolve => setTimeout(resolve, 4000));
          
          const newAllowance = await allowance({
            contract: tokenContract,
            owner: account.address,
            spender: MINILEND_ADDRESS,
          });
          
          console.log("[SaveMoneyModal] Updated allowance:", newAllowance.toString());
          
          if (newAllowance >= amountWei) {
            console.log("[SaveMoneyModal] Sufficient allowance confirmed!");
            allowanceUpdated = true;
            break;
          }
        }
        
        if (!allowanceUpdated) {
          console.log("[SaveMoneyModal] Allowance not updated after polling period");
          setError("Approval not confirmed on-chain. Please try again in a few moments.");
          setIsSaving(false);
          return;
        }
      } else {
        console.log("[SaveMoneyModal] Existing allowance is sufficient, proceeding with deposit");
      }

      // 2. Deposit
      console.log("[SaveMoneyModal] Creating Minilend contract instance with address:", MINILEND_ADDRESS);
      const minilendContract = getContract({
        client,
        chain: celo,
        address: MINILEND_ADDRESS,
        abi: minilendABI // Add explicit ABI
      });
      
      console.log("[SaveMoneyModal] Preparing deposit transaction with params:", {
        token: form.token,
        amount: amountWei.toString(),
        lockPeriod: form.lockPeriod
      });
      
      const depositTx = prepareContractCall({
        contract: minilendContract,
        method: "deposit",
        params: [
          form.token,
          amountWei,
          BigInt(parseInt(form.lockPeriod)),
        ],
      });
      
      console.log("[SaveMoneyModal] Sending deposit transaction");
      const depositResult = await sendTransaction(depositTx);
      console.log("[SaveMoneyModal] Deposit result:", depositResult);
      
      if (depositResult?.transactionHash) {
        console.log("[SaveMoneyModal] Deposit transaction submitted with hash:", depositResult.transactionHash);
        // No need to wait for receipt - assume submitted transaction will eventually confirm
        console.log("[SaveMoneyModal] Deposit transaction submitted successfully!");
      }

      setForm({
        token: "",
        amount: "",
        lockPeriod: "2592000",
      });
      onClose();
    } catch (err: any) {
      console.error("[SaveMoneyModal] Error during save:", err);
      
      // Provide clearer error messages
      if (err.message && err.message.includes("transfer amount exceeds allowance")) {
        setError("Transaction failed: The approval hasn't been confirmed yet. Please try again in a few moments.");
      } else if (err.message && err.message.includes("user rejected")) {
        setError("Transaction was rejected by the user.");
      } else {
        setError(err.message || "Failed to save money. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getLockPeriodText = (seconds: string) => {
    const totalSeconds = Number.parseInt(seconds);
    if (totalSeconds < 3600) {
      return `${totalSeconds} seconds`;
    } else if (totalSeconds < 86400) {
      const hours = Math.floor(totalSeconds / 3600);
      return `${hours} hours`;
    } else {
      const days = totalSeconds / 86400;
      return `${days} days`;
    }
  };

  // Get supported tokens from props
  const supportedStablecoins = Object.keys(tokenInfos);
  const defaultLockPeriods = ["604800", "2592000", "7776000", "15552000"]; // 61 seconds, 7 days, 30, 90, 180 days

  const selectedTokenDecimals = form.token ? (tokenInfos[form.token]?.decimals || 18) : 18;
  const walletBalance = parseFloat(walletBalanceData?.displayValue || "0");

  const formatDisplayNumber = (value: number): string => {
    if (!isFinite(value)) return "0.0000";
    return value.toFixed(4);
  };

  const setAmountByPercent = (ratio: number) => {
    if (!walletBalance || walletBalance <= 0) return;
    const raw = walletBalance * ratio;
    const value = formatDisplayNumber(raw);
    setForm({ ...form, amount: value });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[90vw] max-w-xs mx-auto bg-white border-0 shadow-lg">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-base font-medium text-gray-900">
              Save Money
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-600">
              Choose a token and amount to save. Your wallet will prompt for approval and the transaction.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-200 p-2 rounded text-xs mb-3">
              {error}
            </div>
          )}

          {!account && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-600 p-2 rounded text-xs mb-3">
              Connect wallet to continue
            </div>
          )}

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-1 block">
                Money Type
              </Label>
              <Select
                value={form.token}
                onValueChange={(value) => {
                  console.log("[SaveMoneyModal] Selected token:", {
                    address: value,
                    symbol: tokenInfos[value]?.symbol,
                    decimals: tokenInfos[value]?.decimals
                  });
                  setForm({ ...form, token: value });
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {supportedStablecoins.map((token) => {
                    const tokenInfo = tokenInfos[token];
                    const symbol = tokenInfo?.symbol || token.slice(0, 6) + "...";
                    return (
                      <SelectItem key={token} value={token}>
                        <div className="flex items-center gap-2">
                          {getTokenIcon(symbol).startsWith('http') ? (
                            <img src={getTokenIcon(symbol)} alt={symbol} className="w-4 h-4 rounded-full" />
                          ) : (
                            <span className="text-sm">{getTokenIcon(symbol)}</span>
                          )}
                          <span className="font-medium">{symbol}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {form.token && (
                <div className="mt-2 text-xs text-gray-700">
                  Wallet balance: {formatDisplayNumber(walletBalance)} {walletBalanceData?.symbol || tokenInfos[form.token]?.symbol}
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium text-gray-600 mb-1 block">
                  Amount
                </Label>
                {form.token && walletBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const maxAmount = formatDisplayNumber(walletBalance);
                      setForm({ ...form, amount: maxAmount });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Max
                  </button>
                )}
              </div>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.0000"
                value={form.amount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setForm({ ...form, amount: value });
                  }
                }}
                className="h-10"
              />
              {form.token && (
                <div className="mt-2 text-xs text-gray-600">
                  Wallet balance: {formatDisplayNumber(walletBalance)} {tokenInfos[form.token]?.symbol}
                </div>
              )}
              {form.token && walletBalance > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setAmountByPercent(0.1)}
                  >
                    10%
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setAmountByPercent(0.2)}
                  >
                    20%
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setAmountByPercent(0.5)}
                  >
                    50%
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setAmountByPercent(1)}
                  >
                    Max
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-medium text-gray-600 mb-1 block">
                Lock For
              </Label>
              <Select
                value={form.lockPeriod}
                onValueChange={(value) => setForm({ ...form, lockPeriod: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {defaultLockPeriods.map((period) => (
                    <SelectItem key={period} value={period}>
                      {getLockPeriodText(period)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-3">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 h-9 text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading || isSaving || isTransactionPending || !form.token || !form.amount || !account}
                className="flex-1 h-9 text-sm bg-primary hover:bg-secondary text-white"
              >
                {loading || isSaving || isTransactionPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showOnrampModal && (
      <OnrampDepositModal
        isOpen={showOnrampModal}
        onClose={() => setShowOnrampModal(false)}
        selectedAsset={tokenInfos[form.token]?.symbol || ""}
        assetSymbol={tokenInfos[form.token]?.symbol || ""}
        onSuccess={(transactionCode, amount) => {
          try {
            toast({
              title: "Deposit Initiated",
              description: `${tokenInfos[form.token]?.symbol} deposit processing`,
            });
          } catch (error) {
            console.error("Error showing success toast:", error);
          } finally {
            setShowOnrampModal(false);
          }
        }}
      />
      )}
    </>
  );
}