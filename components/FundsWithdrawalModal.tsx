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
import { getTokenIcon } from "@/lib/utils/tokenIcons";

interface FundsWithdrawalModalProps {
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

export function FundsWithdrawalModal({
  isOpen,
  onClose,
  onWithdraw,
  userDeposits,
  depositLockEnds,
  tokenInfos,
  loading,
  userAddress,
  getWithdrawableAmount: getActualWithdrawableAmount,
}: FundsWithdrawalModalProps) {

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
      await onWithdraw(form.token, form.amount);
      setForm({ token: "", amount: "" });
      onClose();
    } catch (err: any) {
      console.error("Withdrawal error:", err);
      
      let errorMessage = "Transaction failed. Please try again.";
      
      // Handle wallet connection errors
      if (err.message?.includes("MetaMask") || err.message?.includes("extension not found")) {
        errorMessage = "Wallet connection failed. Please ensure your wallet is installed and unlocked.";
      }
      // Handle network errors
      else if (err.message?.includes("network") || err.message?.includes("RPC")) {
        errorMessage = "Network error. Please check your connection and try again.";
      }
      // Handle contract-specific errors
      else if (err.message?.includes("E4") || err.message?.includes("Insufficient matured deposit balance")) {
        errorMessage = `Insufficient unlocked deposits. Some ${tokenInfos[form.token]?.symbol} deposits may still be locked.`;
      } else if (err.message?.includes("E2") || err.message?.includes("Repay loans")) {
        errorMessage = "Please repay outstanding loans before withdrawing.";
      } else if (err.message?.includes("E5") || err.message?.includes("Insufficient contract reserve")) {
        errorMessage = "Insufficient liquidity. Please try again later.";
      }
      // Handle user rejection
      else if (err.message?.includes("rejected") || err.message?.includes("denied")) {
        errorMessage = "Transaction cancelled by user.";
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



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-sm mx-auto bg-white border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center text-gray-900 text-lg font-semibold">
            <ArrowUpRight className="w-5 h-5 mr-2 text-primary" />
            Withdraw Funds
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Withdraw your available balance
          </DialogDescription>
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
                💰 Available Balance:
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



          <div>
            <Label
              htmlFor="withdraw-token"
              className="text-sm font-medium text-gray-700"
            >
              Asset
            </Label>
            <Select
              value={form.token}
              onValueChange={(value) => setForm({ ...form, token: value })}
            >
              <SelectTrigger className="mt-1 min-h-[48px]">
                <SelectValue placeholder="Select asset" />
              </SelectTrigger>

              <SelectContent>
                {availableTokens.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-gray-500 text-center">
                    No balance available
                  </div>
                ) : (
                  availableTokens.map((token) => {
                    const tokenInfo = tokenInfos[token];
                    const withdrawable = getWithdrawableAmount(token);
                    const formattedWithdrawable = formatAmount(withdrawable, tokenInfo?.decimals || 18);
                    const iconUrl = getTokenIcon(tokenInfo?.symbol || "");
                    return (
                      <SelectItem key={token} value={token}>
                        <div className="flex items-center justify-between w-full min-w-0">
                          <div className="flex items-center min-w-0 flex-1">
                            {iconUrl.startsWith('http') ? (
                              <img src={iconUrl} alt={tokenInfo?.symbol} className="w-4 h-4 mr-2 flex-shrink-0" />
                            ) : (
                              <span className="text-sm mr-2 flex-shrink-0">{iconUrl}</span>
                            )}
                            <span className="font-medium text-sm truncate">
                              {tokenInfo?.symbol || token.slice(0, 6) + "..."}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                            {formattedWithdrawable}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })
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
                      Total Balance:
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
                💰 Cash Out
              </div>
              <div className="text-xs text-green-700 mb-3">
                Convert {tokenInfos[form.token]?.symbol} to local currency
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
                Cash Out
              </Button>
              {form.token && !offrampService.isCryptoSupportedForOfframp(tokenInfos[form.token]?.symbol || "") && (
                <p className="text-xs text-yellow-600 mt-1">
                  ⚠️ {tokenInfos[form.token]?.symbol} cash out not available
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
              {loading || isWithdrawing ? "Processing..." : "Withdraw"}
            </Button>
          </div>
        </div>
        {/* Mobile Money Withdrawal Modal */}
        {isOpen && form.token && tokenInfos[form.token] && (
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
              try {
                await onWithdraw(tokenAddress, amount);
                return "0x" + Math.random().toString(16).substr(2, 64);
              } catch (error) {
                console.error("Blockchain withdrawal failed:", error);
                throw new Error("Withdrawal transaction failed");
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}