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
import { getContract, prepareContractCall, waitForReceipt } from "thirdweb";
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

  const { mutateAsync: sendTransaction, isPending: isTransactionPending } = useSendTransaction();

  const handleSave = async () => {
    if (!form.token || !form.amount || !form.lockPeriod) return;
    if (!account) {
      setError("Please connect your wallet first");
      return;
    }

    const maxAmount = parseFloat(walletBalanceData?.displayValue || "0");
    const inputAmount = parseFloat(form.amount);
    if (inputAmount > maxAmount) {
      setError(`Amount exceeds available balance of ${maxAmount} ${walletBalanceData?.symbol || ""}`);
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const decimals = tokenInfos[form.token]?.decimals || 18;
      const amountWei = parseUnits(form.amount, decimals);

      const tokenContract = getContract({ client, chain: celo, address: form.token });
      const approveTransaction = prepareContractCall({
        contract: tokenContract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [MINILEND_ADDRESS, amountWei],
      });

      const approveResult = await sendTransaction( approveTransaction );
      if (approveResult?.transactionHash) {
        await waitForReceipt({ client, chain: celo, transactionHash: approveResult.transactionHash });
      }

      const minilendContract = getContract({ client, chain: celo, address: MINILEND_ADDRESS });
      const depositTransaction = prepareContractCall({
        contract: minilendContract,
        method: "function deposit(address token, uint256 amount, uint256 lockPeriod)",
        params: [form.token, amountWei, BigInt(parseInt(form.lockPeriod))],
      });

      const depositResult = await sendTransaction( depositTransaction );
      if (depositResult?.transactionHash) {
        await waitForReceipt({ client, chain: celo, transactionHash: depositResult.transactionHash });
      }

      setForm({ token: "", amount: "", lockPeriod: "2592000" });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save money. Please try again.");
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

  const formatDisplayNumber = (value: number, maxDecimals: number): string => {
    if (!isFinite(value)) return "0";
    const s = value.toFixed(Math.min(maxDecimals, 6));
    return s.includes(".") ? s.replace(/0+$/ , "").replace(/\.$/, "") : s;
  };

  const setAmountByPercent = (ratio: number) => {
    if (!walletBalance || walletBalance <= 0) return;
    const raw = walletBalance * ratio;
    const value = formatDisplayNumber(raw, selectedTokenDecimals);
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
            <div className="bg-red-50 border border-red-200 text-red-600 p-2 rounded text-xs mb-3">
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
                onValueChange={(value) => setForm({ ...form, token: value })}
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
                  Wallet balance: {walletBalanceData?.displayValue || "0"} {walletBalanceData?.symbol || tokenInfos[form.token]?.symbol}
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium text-gray-600 mb-1 block">
                  Amount
                </Label>
                {walletBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const maxAmount = formatDisplayNumber(walletBalance, selectedTokenDecimals);
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
                placeholder="0.00"
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
                  Wallet balance: {formatDisplayNumber(walletBalance, selectedTokenDecimals)} {tokenInfos[form.token]?.symbol}
                </div>
              )}
              {walletBalance > 0 && (
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
    </>
  );
}