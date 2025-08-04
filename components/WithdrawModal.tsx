"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { NEW_SUPPORTED_TOKENS } from "@/lib/services/thirdwebService";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWithdraw: (token: string, amount: string) => Promise<void>;
  userDeposits: Record<string, string>;
  depositLockEnds: Record<string, number>;
  tokenInfos: Record<string, { symbol: string; decimals: number }>;
  loading: boolean;
  userAddress?: string;
  getWithdrawableAmount?: (token: string) => Promise<string>;
}

export function WithdrawModal({
  isOpen,
  onClose,
  onWithdraw,
  userDeposits,
  depositLockEnds,
  tokenInfos,
  loading,
  userAddress,
  getWithdrawableAmount: getActualWithdrawableAmount,
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
      setError("No funds available to withdraw. Your deposits may still be locked or you may have mixed lock periods.");
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
      if (err.message?.includes("E4") || err.message?.includes("Insufficient matured deposit balance")) {
        errorMessage = `Withdrawal failed: Insufficient unlocked deposits. Some of your ${tokenInfos[form.token]?.symbol} deposits may still be locked. Try a smaller amount or wait for more deposits to unlock.`;
      } else if (err.message?.includes("E2") || err.message?.includes("Repay loans before withdrawing")) {
        errorMessage = `Please repay all outstanding loans before withdrawing funds.`;
      } else if (err.message?.includes("E5") || err.message?.includes("Insufficient contract reserve")) {
        errorMessage = `Insufficient contract reserves. Please try again later.`;
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

  // Memoize supported tokens to prevent re-renders
  const supportedStablecoins = useMemo(() => Object.keys(tokenInfos), [tokenInfos]);

  const getTokenCategory = (tokenAddress: string) => {
    const tokenInfo = Object.values(NEW_SUPPORTED_TOKENS).find(
      t => t.address.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    if (!tokenInfo) return "other";
    
    if (['USDC', 'USDT', 'USDGLO'].includes(tokenInfo.symbol)) return "international";
    if (['cKES', 'eXOF', 'PUSO', 'cCOP', 'cGHS'].includes(tokenInfo.symbol)) return "regional";
    if (['cUSD', 'cEUR', 'cREAL'].includes(tokenInfo.symbol)) return "major";
    if (tokenInfo.symbol === 'CELO') return "native";
    
    return "other";
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





  const getWithdrawableAmount = useCallback((tokenAddress: string) => {
    const deposit = userDeposits[tokenAddress] || "0";
    const lockEnd = depositLockEnds[tokenAddress] || 0;

    if (deposit === "0") return "0";
    if (isLocked(lockEnd)) return "0";

    return deposit;
  }, [userDeposits, depositLockEnds]);

  // Memoize mixed locks check
  const hasPotentialMixedLocks = useCallback((tokenAddress: string) => {
    const deposit = userDeposits[tokenAddress] || "0";
    const lockEnd = depositLockEnds[tokenAddress] || 0;

    // If there's a deposit and a lock end time, there might be mixed locks
    // This is a heuristic since we can't know the actual deposit history
    return deposit !== "0" && lockEnd > 0;
  }, [userDeposits, depositLockEnds]);

  // Memoize available tokens filter
  const availableTokens = useMemo(() => 
    supportedStablecoins.filter(
      (token) => userDeposits[token] && userDeposits[token] !== "0"
    ), [supportedStablecoins, userDeposits]
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

            </div>
          )}

          {/* Lock Period Information */}
          {availableTokens.some(token => hasPotentialMixedLocks(token)) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-800 mb-1">
                ℹ️ Multiple Deposits Detected
              </p>
              <p className="text-xs text-blue-700">
                You may have multiple deposits with different unlock dates. The contract will automatically calculate your available withdrawal amount based on unlocked deposits only.
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
                      {getCategoryName(category)}
                    </div>
                    {tokens.map((token) => {
                      const tokenInfo = tokenInfos[token];
                      const withdrawable = getWithdrawableAmount(token);
                      const formattedWithdrawable = formatAmount(withdrawable, tokenInfo?.decimals || 18);
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
                              {formattedWithdrawable}
                            </span>
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
            <div className="flex justify-between items-center">
              <Label
                htmlFor="withdraw-amount"
                className="text-sm font-medium text-gray-700"
              >
                Amount
              </Label>
              {form.token && getWithdrawableAmount(form.token) !== "0" && (
                <button
                  type="button"
                  onClick={() => {
                    const maxAmount = formatAmount(
                      getWithdrawableAmount(form.token),
                      tokenInfos[form.token]?.decimals || 18
                    );
                    setForm({ ...form, amount: maxAmount });
                  }}
                  className="text-xs text-primary hover:text-secondary font-medium active:scale-95 transition-all"
                >
                  Use max: {formatAmount(
                    getWithdrawableAmount(form.token),
                    tokenInfos[form.token]?.decimals || 18
                  )} {tokenInfos[form.token]?.symbol}
                </button>
              )}
            </div>
            <Input
              id="withdraw-amount"
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

                // Clear error when user starts typing
                if (error && value !== form.amount) {
                  setError(null);
                }
              }}
              className="mt-1 min-h-[48px]"
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
                    <div className="bg-amber-50 border border-amber-200 rounded p-2">
                      <p className="text-sm text-amber-700">
                        🔒 Latest deposit locked until {formatDate(depositLockEnds[form.token])}
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        {hasPotentialMixedLocks(form.token) ? (
                          "You may have earlier deposits that are already unlocked. The contract will determine your actual withdrawable amount."
                        ) : (
                          "All your funds are locked until this date."
                        )}
                      </p>
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
