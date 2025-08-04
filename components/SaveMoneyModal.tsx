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
      // The thirdweb contract provider handles network switching automatically
      await onSave(form.token, form.amount, Number.parseInt(form.lockPeriod));
      setForm({ token: "", amount: "", lockPeriod: "2592000" });
      onClose();
    } catch (err: any) {
      console.error("Error saving money:", err);
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
  const defaultLockPeriods = ["61", "604800", "2592000", "7776000", "15552000"]; // 61 seconds, 7 days, 30, 90, 180 days

  const getTokenCategory = (tokenAddress: string) => {
    const tokenInfo = Object.values(NEW_SUPPORTED_TOKENS).find(
      t => t.address.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    if (!tokenInfo) return "stablecoin";
    
    // International stablecoins
    if (['USDC', 'USDT', 'USDGLO'].includes(tokenInfo.symbol)) return "international";
    // Regional currencies
    if (['cKES', 'eXOF', 'PUSO', 'cCOP', 'cGHS'].includes(tokenInfo.symbol)) return "regional";
    // Major stablecoins
    if (['cUSD', 'cEUR', 'cREAL'].includes(tokenInfo.symbol)) return "major";
    // Native token
    if (tokenInfo.symbol === 'CELO') return "native";
    
    return "stablecoin";
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "international":
        return "🌐";
      case "regional":
        return "🌍";
      case "major":
        return "💰";
      case "native":
        return "🟡";
      default:
        return "💱";
    }
  };
  
  const getTokenIcon = (symbol: string) => {
    const icons: Record<string, string> = {
      CELO: "🟡",
      cUSD: "🇺🇸",
      cEUR: "🇪🇺", 
      cREAL: "🇧🇷",
      eXOF: "🌍",
      cKES: "🇰🇪",
      PUSO: "🇵🇭",
      cCOP: "🇨🇴",
      cGHS: "🇬🇭",
      USDT: "🇺🇸",
      USDC: "🇺🇸",
      USDGLO: "🌍",
    };
    return icons[symbol] || "💱";
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "international":
        return "text-blue-600";
      case "regional":
        return "text-green-600";
      case "major":
        return "text-purple-600";
      case "native":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };
  
  const getCategoryName = (category: string) => {
    switch (category) {
      case "international":
        return "International";
      case "regional":
        return "Regional";
      case "major":
        return "Major Stablecoins";
      case "native":
        return "Native Token";
      default:
        return "Other";
    }
  };

  // Group tokens by category - memoized for performance
  const groupedTokens = useMemo(() => {
    return supportedStablecoins.reduce(
      (acc, tokenAddress) => {
        const category = getTokenCategory(tokenAddress);
        if (!acc[category]) acc[category] = [];
        acc[category].push(tokenAddress);
        return acc;
      },
      {} as Record<string, string[]>
    );
  }, [supportedStablecoins]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm mx-auto bg-white border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center text-gray-900 text-lg font-semibold">
              <TrendingUp className="w-5 h-5 mr-2 text-primary" />
              Save Money
            </DialogTitle>
            <DialogDescription>
              Deposit money to earn interest over time
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {/* Show wallet connection status */}
          {!account && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-600 p-3 rounded-lg text-sm mb-4">
              Please connect your wallet to continue
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label
                htmlFor="save-token"
                className="text-sm font-medium text-gray-700"
              >
                Money Type
              </Label>
              <Select
                value={form.token}
                onValueChange={(value) => setForm({ ...form, token: value })}
              >
                <SelectTrigger className="mt-1 min-h-[48px]">
                  <SelectValue placeholder="Select money type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedTokens).map(([category, tokens]) => {
                    const categoryIcon = getCategoryIcon(category);
                    const categoryColor = getCategoryColor(category);
                    return (
                      <div key={category}>
                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {categoryIcon} {getCategoryName(category)}
                        </div>
                        {tokens.map((token) => {
                          const tokenInfo = tokenInfos[token];
                          const balance = userBalances[token] || "0";
                          const formattedBalance = formatAmount(balance, tokenInfo?.decimals || 18);
                          return (
                            <SelectItem key={token} value={token}>
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center">
                                  <span className="text-lg mr-2">
                                    {getTokenIcon(tokenInfo?.symbol || "")}
                                  </span>
                                  <span className="font-medium">
                                    {tokenInfo?.symbol || token.slice(0, 6) + "..."}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 ml-2">
                                  {formattedBalance}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label
                  htmlFor="save-amount"
                  className="text-sm font-medium text-gray-700"
                >
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
                    className="text-xs text-primary hover:text-secondary font-medium active:scale-95 transition-all"
                  >
                    Use max: {formatAmount(
                      userBalances[form.token],
                      tokenInfos[form.token]?.decimals || 18
                    )} {tokenInfos[form.token]?.symbol}
                  </button>
                )}
              </div>
              <Input
                id="save-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty value or valid decimal numbers
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setForm({ ...form, amount: value });
                  }
                }}
                className="mt-1 min-h-[48px]"
              />
            </div>

            <div>
              <Label
                htmlFor="save-lock"
                className="text-sm font-medium text-gray-700"
              >
                Lock For
              </Label>
              <Select
                value={form.lockPeriod}
                onValueChange={(value) => setForm({ ...form, lockPeriod: value })}
              >
                <SelectTrigger className="mt-1 min-h-[48px]">
                  <SelectValue placeholder="Select lock period" />
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

            {/* Deposit Options */}
            {form.token && onrampService.isAssetSupportedForOnramp(tokenInfos[form.token]?.symbol || "") && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm font-medium text-blue-800 mb-2">
                  Need to deposit {tokenInfos[form.token]?.symbol}?
                </div>
                <Button
                  onClick={() => setShowOnrampModal(true)}
                  variant="outline"
                  className="w-full border-blue-400 text-blue-700 hover:bg-blue-100 min-h-[40px] bg-transparent"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Deposit via Mobile Money
                </Button>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 min-h-[48px] bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading || isSaving || !form.token || !form.amount || !account}
                className="flex-1 bg-primary hover:bg-secondary text-white min-h-[48px]"
              >
                {loading || isSaving ? "Saving..." : "Save Now"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Optimized Onramp Deposit Modal */}
      <OnrampDepositModal
        isOpen={showOnrampModal}
        onClose={() => setShowOnrampModal(false)}
        selectedAsset={tokenInfos[form.token]?.symbol || ""}
        assetSymbol={tokenInfos[form.token]?.symbol || ""}
        onSuccess={(transactionCode, amount) => {
          try {
            toast({
              title: "Mobile Money Deposit Initiated",
              description: `Your ${tokenInfos[form.token]?.symbol} deposit will be processed once payment is confirmed.`,
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