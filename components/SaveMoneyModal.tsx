"use client";

import { useState, useMemo } from "react";
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
import { useActiveAccount } from "thirdweb/react";
import { NEW_SUPPORTED_TOKENS } from "@/lib/services/thirdwebService";
import { getTokenIcon } from "@/lib/utils/tokenIcons";

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

  const handleSave = async () => {
    if (!form.token || !form.amount || !form.lockPeriod) return;

    // Check if wallet is connected
    if (!account) {
      setError("Please connect your wallet first");
      return;
    }

    // Validate amount doesn't exceed available balance
    if (form.token && userBalances[form.token]) {
      const maxAmount = parseFloat(formatAmount(
        userBalances[form.token],
        tokenInfos[form.token]?.decimals || 18
      ));
      const inputAmount = parseFloat(form.amount);
      if (inputAmount > maxAmount) {
        setError(`Amount exceeds available balance of ${maxAmount} ${tokenInfos[form.token]?.symbol}`);
        return;
      }
    }

    setError(null);
    setIsSaving(true);

    try {
      // Note: The parent component's onSave function should handle token approval
      // before attempting to deposit tokens to the contract
      await onSave(form.token, form.amount, Number.parseInt(form.lockPeriod));
      setForm({ token: "", amount: "", lockPeriod: "2592000" });
      onClose();
    } catch (err: any) {
      console.error("Error saving money:", err);
      if (err.message?.includes("ERC20: insufficient allowance") || err.message?.includes("Approve contract first")) {
        setError("Please approve the contract to spend your tokens first. This should happen automatically.");
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
  const defaultLockPeriods = ["61", "604800", "2592000", "7776000", "15552000"]; // 61 seconds, 7 days, 30, 90, 180 days


  






  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[90vw] max-w-xs mx-auto bg-white border-0 shadow-lg">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-base font-medium text-gray-900">
              Save Money
            </DialogTitle>
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
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium text-gray-600 mb-1 block">
                  Amount
                </Label>
                {form.token && userBalances[form.token] && (
                  <button
                    type="button"
                    onClick={() => {
                      const maxAmount = formatAmount(
                        userBalances[form.token],
                        tokenInfos[form.token]?.decimals || 18
                      );
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
                disabled={loading || isSaving || !form.token || !form.amount || !account}
                className="flex-1 h-9 text-sm bg-primary hover:bg-secondary text-white"
              >
                {loading || isSaving ? "Saving..." : "Save"}
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