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
import { ArrowUpRight, Smartphone } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { MobileMoneyWithdrawModal } from "./EnhancedMobileMoneyWithdrawModal";
import { offrampService } from "@/lib/services/offrampService";

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

  const [form, setForm] = useState({
    token: "",
    amount: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showMobileMoneyModal, setShowMobileMoneyModal] = useState(false);

  const handleWithdraw = async () => {
    if (!form.token || !form.amount) return;

    const withdrawableAmount = getWithdrawableAmount(form.token);
    const maxWithdrawable = parseFloat(formatAmount(withdrawableAmount, tokenInfos[form.token]?.decimals || 18));
    const requestedAmount = parseFloat(form.amount);

    if (requestedAmount > maxWithdrawable) {
      setError(`Cannot withdraw ${form.amount} ${tokenInfos[form.token]?.symbol}. Maximum withdrawable: ${maxWithdrawable.toFixed(6)}`);
      return;
    }

    if (withdrawableAmount === "0") {
      setError("No funds available to withdraw. Your funds may be locked. If you made multiple deposits with different lock periods, try a smaller amount.");
      return;
    }

    setError(null);
    setIsWithdrawing(true);

    try {
      // Network switching is handled automatically by thirdweb
      await onWithdraw(form.token, form.amount);
      setForm({ token: "", amount: "" });
      onClose();
    } catch (err: any) {
      console.error("Error withdrawing money:", err);
      let errorMessage = err.message || "Failed to withdraw money. Please try again.";

      // Handle specific contract errors related to locked deposits
      if (err.message?.includes("Deposit still locked")) {
        errorMessage = `Withdrawal failed: Some of your ${tokenInfos[form.token]?.symbol} deposits are still locked. Try withdrawing a smaller amount or wait for all deposits to unlock.`;
      } else if (err.message?.includes("Insufficient deposit balance")) {
        errorMessage = `Insufficient balance. You may have mixed deposits with different lock periods. Try a smaller amount.`;
      }

      setError(errorMessage);
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

  // Mock supported tokens
  const supportedStablecoins = [
    "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
    "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
    "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
  ];

  const getTokenCategory = (tokenAddress: string) => {
    // Simplified categorization
    if (tokenAddress.includes("USDC") || tokenAddress.includes("USDT")) return "international";
    if (tokenAddress.includes("cUSD") || tokenAddress.includes("cEUR")) return "regional";
    return "stablecoin";
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

  // Calculate withdrawable amount for each token
  // Note: This is a simplified calculation. The actual contract has a bug where
  // multiple deposits with different lock periods overwrite each other.
  // In reality, we should track individual deposits, but since the contract
  // only stores the latest lock end, we show a warning when funds might be locked.
  const getWithdrawableAmount = (tokenAddress: string) => {
    const deposit = userDeposits[tokenAddress] || "0";
    const lockEnd = depositLockEnds[tokenAddress] || 0;

    if (deposit === "0") return "0";

    // If the latest deposit is still locked, assume all funds are locked
    // This is a conservative approach due to the contract's limitation
    if (isLocked(lockEnd)) return "0";

    return deposit;
  };

  // Check if there might be mixed lock periods (contract limitation)
  const hasPotentialMixedLocks = (tokenAddress: string) => {
    const deposit = userDeposits[tokenAddress] || "0";
    const lockEnd = depositLockEnds[tokenAddress] || 0;

    // If there's a deposit and a lock end time, there might be mixed locks
    // This is a heuristic since we can't know the actual deposit history
    return deposit !== "0" && lockEnd > 0;
  };

  // Filter tokens to show all with deposits (even if locked)
  const availableTokens = supportedStablecoins.filter(
    (token) => userDeposits[token] && userDeposits[token] !== "0"
  );

  // Group tokens by category - memoized for performance
  const groupedTokens = useMemo(() => 
    availableTokens.reduce(
      (acc, tokenAddress) => {
        const category = getTokenCategory(tokenAddress);
        if (!acc[category]) acc[category] = [];
        acc[category].push(tokenAddress);
        return acc;
      },
      {} as Record<string, string[]>
    ), [availableTokens]
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
          {/* Available balances summary */}
          {availableTokens.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="font-medium text-primary mb-2 text-sm">
                💰 Available to withdraw:
              </p>
              <div className="space-y-1">
                {availableTokens.slice(0, 4).map((token) => {
                  const withdrawable = getWithdrawableAmount(token);
                  const isTokenLocked = isLocked(depositLockEnds[token]);
                  return (
                    <div key={token} className="flex justify-between items-center text-sm">
                      <span className="font-medium">{tokenInfos[token]?.symbol}</span>
                      <span className={isTokenLocked ? "text-red-600" : "text-green-600"}>
                        {isTokenLocked ? (
                          <span>
                            🔒 Locked ({formatAmount(userDeposits[token], tokenInfos[token]?.decimals || 18)})
                          </span>
                        ) : (
                          <span>
                            {formatAmount(withdrawable, tokenInfos[token]?.decimals || 18)}
                            {hasPotentialMixedLocks(token) && (
                              <span className="text-xs text-orange-500 ml-1">*</span>
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
                {availableTokens.length > 4 && (
                  <p className="text-xs text-gray-500 text-center mt-1">
                    + {availableTokens.length - 4} more tokens
                  </p>
                )}
              </div>
              <div className="mt-2 text-xs text-orange-600">
                <p>* May have mixed lock periods - actual withdrawable amount might differ</p>
              </div>
            </div>
          )}

          {/* Contract Limitation Warning */}
          {availableTokens.some(token => hasPotentialMixedLocks(token)) && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm font-medium text-orange-800 mb-1">
                ⚠️ Important: Mixed Lock Periods
              </p>
              <p className="text-xs text-orange-700">
                If you made multiple deposits with different lock periods, the displayed amounts may not be accurate.
                If withdrawal fails, try a smaller amount as some deposits might still be locked.
              </p>
            </div>
          )}

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

              <SelectContent>
                {availableTokens.length === 0 && (
                  <div className="px-2 py-3 text-sm text-gray-500 text-center">
                    No funds available to withdraw
                  </div>
                )}
                {Object.entries(groupedTokens).map(([category, tokens]) => (
                  <div key={category}>
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {getCategoryIcon(category)} {category}
                    </div>
                    {tokens.map((token) => {
                      const tokenInfo = tokenInfos[token];
                      const categoryColor = getCategoryColor(category);
                      const categoryIcon = getCategoryIcon(category);
                      return (
                        <SelectItem key={token} value={token}>
                          <div className="flex items-center">
                            <span className={`text-xs mr-2 ${categoryColor}`}>
                              {categoryIcon}
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
              onChange={(e) => {
                const value = e.target.value;
                setForm({ ...form, amount: value });

                // Clear error when user starts typing
                if (error && value !== form.amount) {
                  setError(null);
                }
              }}
              className="mt-1 min-h-[48px]"
              min="0.01"
              step="0.01"
            />
            {form.token && userDeposits[form.token] && (
              <div className="mt-2 p-2 bg-blue-50 rounded-md">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      Total Saved:
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatAmount(
                        userDeposits[form.token],
                        tokenInfos[form.token]?.decimals || 18
                      )}{" "}
                      {tokenInfos[form.token]?.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      Can Withdraw:
                    </span>
                    <span className="text-base font-bold text-primary">
                      {formatAmount(
                        getWithdrawableAmount(form.token),
                        tokenInfos[form.token]?.decimals || 18
                      )}{" "}
                      {tokenInfos[form.token]?.symbol}
                    </span>
                  </div>
                  {isLocked(depositLockEnds[form.token]) && (
                    <div className="bg-red-50 border border-red-200 rounded p-2">
                      <p className="text-sm text-red-600">
                        🔒 Your funds are locked until {formatDate(depositLockEnds[form.token])}
                      </p>
                      <p className="text-xs text-red-500 mt-1">
                        You cannot withdraw locked funds before the unlock date.
                      </p>
                      {hasPotentialMixedLocks(form.token) && (
                        <p className="text-xs text-orange-600 mt-2 font-medium">
                          ⚠️ Note: If you made multiple deposits with different lock periods, some funds might be withdrawable even if others are locked. Try withdrawing a smaller amount if the transaction fails.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Money Withdrawal Option */}
          {form.token && tokenInfos[form.token] && !isLocked(depositLockEnds[form.token]) && getWithdrawableAmount(form.token) !== "0" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-sm font-medium text-green-800 mb-2">
                💰 Convert to Mobile Money
              </div>
              <div className="text-xs text-green-700 mb-3">
                Withdraw {tokenInfos[form.token]?.symbol} directly to your mobile money account
              </div>
              <Button
                onClick={() => setShowMobileMoneyModal(true)}
                variant="outline"
                className="w-full border-green-400 text-green-700 hover:bg-green-100 min-h-[40px] bg-transparent"
                disabled={
                  !form.token ||
                  getWithdrawableAmount(form.token) === "0" ||
                  !offrampService.isCryptoSupportedForOfframp(tokenInfos[form.token]?.symbol || "")
                }
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Withdraw to Mobile Money
              </Button>
              {form.token && !offrampService.isCryptoSupportedForOfframp(tokenInfos[form.token]?.symbol || "") && (
                <p className="text-xs text-yellow-600 mt-1">
                  ⚠️ {tokenInfos[form.token]?.symbol} mobile money withdrawal not yet supported
                </p>
              )}
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
              onClick={handleWithdraw}
              disabled={
                loading ||
                isWithdrawing ||
                !form.token ||
                !form.amount ||
                getWithdrawableAmount(form.token) === "0" ||
                parseFloat(form.amount) > parseFloat(formatAmount(getWithdrawableAmount(form.token), tokenInfos[form.token]?.decimals || 18))
              }
              className="flex-1 bg-primary hover:bg-secondary text-white min-h-[48px]"
            >
              {loading || isWithdrawing ? "Withdrawing..." : "Withdraw to Wallet"}
            </Button>
          </div>
        </div>

        {/* Mobile Money Withdrawal Modal */}
        {form.token && tokenInfos[form.token] && (
          <MobileMoneyWithdrawModal
            isOpen={showMobileMoneyModal}
            onClose={() => setShowMobileMoneyModal(false)}
            tokenSymbol={tokenInfos[form.token]?.symbol || ""}
            tokenAddress={form.token}
            network={offrampService.detectNetworkFromTokenAddress(form.token) || "celo"}
            availableAmount={formatAmount(
              getWithdrawableAmount(form.token),
              tokenInfos[form.token]?.decimals || 18
            )}
            decimals={tokenInfos[form.token]?.decimals || 18}
            onWithdrawSuccess={(orderID, amount) => {
              setShowMobileMoneyModal(false);
              setForm({ token: "", amount: "" });
              onClose();
            }}
            onBlockchainWithdraw={async (tokenAddress: string, amount: string) => {
              // This will call the same withdrawal function but return the transaction hash
              await onWithdraw(tokenAddress, amount);
              // In a real implementation, you'd need to modify onWithdraw to return the transaction hash
              // For now, we'll return a mock hash - this should be updated based on your contract implementation
              return "0x" + Math.random().toString(16).substr(2, 64);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
