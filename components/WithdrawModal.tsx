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
import { ArrowUpRight } from "lucide-react";
import { useContract, ensureCeloNetwork } from "@/lib/contract";
import { formatAmount } from "@/lib/utils";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWithdraw: (token: string, amount: string) => Promise<void>;
  userDeposits: Record<string, string>;
  depositLockEnds: Record<string, number>;
  tokenInfos: Record<string, { symbol: string; decimals: number }>;
  loading: boolean;
}

export function WithdrawModal({
  isOpen,
  onClose,
  onWithdraw,
  userDeposits,
  depositLockEnds,
  tokenInfos,
  loading,
}: WithdrawModalProps) {
  const { supportedStablecoins, allTokens } = useContract();

  const [form, setForm] = useState({
    token: "",
    amount: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const handleWithdraw = async () => {
    if (!form.token || !form.amount) return;

    setError(null);
    setIsWithdrawing(true);

    try {
      // Ensure we're on the Celo network before proceeding
      await ensureCeloNetwork();

      // Proceed with the withdrawal
      await onWithdraw(form.token, form.amount);
      setForm({ token: "", amount: "" });
      onClose();
    } catch (err: any) {
      console.error("Error withdrawing money:", err);
      setError(err.message || "Failed to withdraw money. Please try again.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const isLocked = (timestamp: number) => {
    return timestamp > 0 && timestamp > Date.now() / 1000;
  };

  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return "No lock";
    return new Date(timestamp * 1000).toLocaleDateString();
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

  // Filter tokens to show all with deposits (even if locked)
  const availableTokens = supportedStablecoins.filter(
    (token) => userDeposits[token] && userDeposits[token] !== "0"
  );

  // Group tokens by category
  const groupedTokens = availableTokens.reduce(
    (acc, tokenAddress) => {
      const category = getTokenCategory(tokenAddress);
      if (!acc[category]) acc[category] = [];
      acc[category].push(tokenAddress);
      return acc;
    },
    {} as Record<string, string[]>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto bg-white border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center text-gray-900 text-lg font-semibold">
            <ArrowUpRight className="w-5 h-5 mr-2 text-primary" />
            Withdraw Money
          </DialogTitle>
          <DialogDescription>Withdraw your available funds</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label
              htmlFor="withdraw-token"
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
              {/* Show available balances summary before selection */}
              {availableTokens.length > 0 && !form.token && (
                <div className="mt-2 p-2 bg-blue-50 rounded-md text-sm">
                  <p className="font-medium text-primary mb-1">
                    Available balances:
                  </p>
                  {availableTokens.slice(0, 3).map((token) => (
                    <div
                      key={token}
                      className="flex justify-between items-center mb-1"
                    >
                      <span>{tokenInfos[token]?.symbol}</span>
                      <span className="font-medium">
                        {formatAmount(
                          userDeposits[token],
                          tokenInfos[token]?.decimals || 18
                        )}
                        {isLocked(depositLockEnds[token]) ? " (Locked)" : ""}
                      </span>
                    </div>
                  ))}
                  {availableTokens.length > 3 && (
                    <p className="text-xs text-gray-500 text-center">
                      + {availableTokens.length - 3} more
                    </p>
                  )}
                </div>
              )}
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
                {Object.keys(groupedTokens).length === 0 && (
                  <div className="px-2 py-3 text-sm text-gray-500 text-center">
                    No available tokens to withdraw
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label
              htmlFor="withdraw-amount"
              className="text-sm font-medium text-gray-700"
            >
              Amount
            </Label>
            <Input
              id="withdraw-amount"
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="mt-1 min-h-[48px]"
              min="0.01"
              step="0.01"
            />
            {form.token && userDeposits[form.token] && (
              <div className="mt-2 p-2 bg-blue-50 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">
                    Available:
                  </span>
                  <span className="text-base font-bold text-primary">
                    {formatAmount(
                      userDeposits[form.token],
                      tokenInfos[form.token]?.decimals || 18
                    )}{" "}
                    {tokenInfos[form.token]?.symbol}
                  </span>
                </div>
                {depositLockEnds[form.token] &&
                  isLocked(depositLockEnds[form.token]) && (
                    <p className="text-sm text-red-500 mt-1">
                      ⚠️ Locked until {formatDate(depositLockEnds[form.token])}
                    </p>
                  )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 min-h-[48px] bg-transparent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={
                loading ||
                isWithdrawing ||
                !form.token ||
                !form.amount ||
                isLocked(depositLockEnds[form.token]) ||
                !userDeposits[form.token] ||
                userDeposits[form.token] === "0"
              }
              className="flex-1 bg-primary hover:bg-secondary text-white min-h-[48px]"
            >
              {loading || isWithdrawing ? "Withdrawing..." : "Withdraw N"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
