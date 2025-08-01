"use client";

import { useState } from "react";
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
import { useContract, ensureCeloNetwork } from "@/lib/contract";
import { formatAmount } from "@/lib/utils";
import { OnrampDepositModal } from "./OnrampDepositModal";
import { onrampService } from "@/lib/services/onrampService";
import { useToast } from "@/hooks/use-toast";

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
  const { supportedStablecoins, defaultLockPeriods, allTokens } = useContract();

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

    setError(null);
    setIsSaving(true);

    try {
      // Ensure we're on the Celo network before proceeding
      await ensureCeloNetwork();

      // Proceed with the save operation
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
    const days = Number.parseInt(seconds) / 86400;
    return `${days} days`;
  };

  const getTokenCategory = (tokenAddress: string) => {
    const token = Object.values(allTokens).find(
      (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
    );
    return token?.category || "unknown";
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "regional":
        return "🌍";
      case "international":
        return "🌐";
      case "stablecoin":
        return "💰";
      default:
        return "💱";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "regional":
        return "text-green-600";
      case "international":
        return "text-blue-600";
      case "stablecoin":
        return "text-purple-600";
      default:
        return "text-gray-600";
    }
  };

  // Group tokens by category
  const groupedTokens = supportedStablecoins.reduce(
    (acc, tokenAddress) => {
      const category = getTokenCategory(tokenAddress);
      if (!acc[category]) acc[category] = [];
      acc[category].push(tokenAddress);
      return acc;
    },
    {} as Record<string, string[]>
  );

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
                  {Object.entries(groupedTokens).map(([category, tokens]) => (
                    <div key={category}>
                      <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {getCategoryIcon(category)} {category}
                      </div>
                      {tokens.map((token) => {
                        const tokenInfo =
                          tokenInfos[token] ||
                          allTokens[
                            Object.keys(allTokens).find(
                              (key) => allTokens[key].address === token
                            ) || ""
                          ];
                        return (
                          <SelectItem key={token} value={token}>
                            <div className="flex items-center">
                              <span
                                className={`text-xs mr-2 ${getCategoryColor(category)}`}
                              >
                                {getCategoryIcon(category)}
                              </span>
                              {tokenInfo?.symbol || token.slice(0, 6) + "..."}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label
                htmlFor="save-amount"
                className="text-sm font-medium text-gray-700"
              >
                Amount
              </Label>
              <Input
                id="save-amount"
                type="number"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="mt-1 min-h-[48px]"
                min="0.01"
                step="0.01"
              />
              {form.token && userBalances[form.token] && (
                <p className="text-sm text-gray-600 mt-1">
                  Available:{" "}
                  {formatAmount(
                    userBalances[form.token],
                    tokenInfos[form.token]?.decimals || 18
                  )}{" "}
                  {tokenInfos[form.token]?.symbol}
                </p>
              )}
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
                disabled={loading || isSaving || !form.token || !form.amount}
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
          toast({
            title: "Mobile Money Deposit Initiated",
            description: `Your ${tokenInfos[form.token]?.symbol} deposit will be processed once payment is confirmed.`,
          });
          setShowOnrampModal(false);
        }}
      />
    </>
  );
}