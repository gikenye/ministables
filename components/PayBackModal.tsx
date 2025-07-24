"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
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
import { ArrowUpRight, AlertCircle, Clock, DollarSign } from "lucide-react";
import { useContract } from "@/lib/contract";
import { formatAmount } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

interface ActiveLoan {
  token: string;
  symbol: string;
  principal: string;
  estimatedInterest: string;
  totalOwed: string;
  borrowStartTime: number;
  decimals: number;
}

interface PayBackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPayBack: (token: string, amount: string) => Promise<void>;
  tokenInfos: Record<string, { symbol: string; decimals: number }>;
  loading: boolean;
}

export function PayBackModal({
  isOpen,
  onClose,
  onPayBack,
  tokenInfos,
  loading,
}: PayBackModalProps) {
  const { address } = useWallet();
  const { supportedStablecoins, getUserBorrows, getTokenInfo } = useContract();
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);

  const [form, setForm] = useState({
    token: "",
    amount: "",
  });

  // Load active loans when modal opens
  useEffect(() => {
    if (isOpen && address) {
      loadActiveLoans();
    }
  }, [isOpen, address, supportedStablecoins]);

  const loadActiveLoans = async () => {
    if (!address) return;

    setLoadingLoans(true);
    try {
      const loans: ActiveLoan[] = [];

      for (const tokenAddress of supportedStablecoins) {
        const borrowAmount = await getUserBorrows(address, tokenAddress);

        if (borrowAmount && borrowAmount !== "0") {
          const tokenInfo =
            tokenInfos[tokenAddress] || (await getTokenInfo(tokenAddress));

          // Estimate interest (simplified calculation - in real app you'd get this from contract)
          const principal = Number(
            formatAmount(borrowAmount, tokenInfo.decimals)
          );
          const estimatedInterest = principal * 0.05; // 5% estimated interest
          const totalOwed = principal + estimatedInterest;

          loans.push({
            token: tokenAddress,
            symbol: tokenInfo.symbol,
            principal: borrowAmount,
            estimatedInterest: (
              estimatedInterest * Math.pow(10, tokenInfo.decimals)
            ).toString(),
            totalOwed: (
              totalOwed * Math.pow(10, tokenInfo.decimals)
            ).toString(),
            borrowStartTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // Mock: 30 days ago
            decimals: tokenInfo.decimals,
          });
        }
      }

      setActiveLoans(loans);
    } catch (error) {
      console.error("Error loading active loans:", error);
    } finally {
      setLoadingLoans(false);
    }
  };

  const handleLoanSelect = (loan: ActiveLoan) => {
    setSelectedLoan(loan);
    setForm({
      token: loan.token,
      amount: formatAmount(loan.totalOwed, loan.decimals),
    });
  };

  const handlePayBack = async () => {
    if (!form.token || !form.amount) return;

    await onPayBack(form.token, form.amount);
    setForm({ token: "", amount: "" });
    setSelectedLoan(null);
    onClose();
    // Reload loans after payment
    setTimeout(() => {
      if (address) loadActiveLoans();
    }, 2000);
  };

  const formatTimeAgo = (timestamp: number) => {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  const getTokenFlag = (symbol: string) => {
    const flags: Record<string, string> = {
      cKES: "🇰🇪",
      cUSD: "🇺🇸",
      cEUR: "🇪🇺",
      cREAL: "🇧🇷",
      eXOF: "🌍",
      PUSO: "🇵🇭",
      cCOP: "🇨🇴",
      cGHS: "🇬🇭",
      USDT: "🇺🇸",
      USDC: "🇺🇸",
      USDGLO: "🌍",
    };
    return flags[symbol] || "💱";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto bg-white border-0 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-gray-900 text-lg font-semibold">
            <ArrowUpRight className="w-5 h-5 mr-2 text-primary" />
            Pay Back Loans
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Active Loans Section */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-3 block">
              Your Active Loans
            </Label>

            {loadingLoans ? (
              <div className="text-center py-4">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">
                  Loading your loans...
                </p>
              </div>
            ) : activeLoans.length > 0 ? (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {activeLoans.map((loan) => (
                  <div
                    key={loan.token}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedLoan?.token === loan.token
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-primary/50 hover:bg-gray-50"
                    }`}
                    onClick={() => handleLoanSelect(loan)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className="text-lg mr-2">
                          {getTokenFlag(loan.symbol)}
                        </span>
                        <div>
                          <span className="font-medium text-gray-900">
                            {loan.symbol}
                          </span>
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="w-3 h-3 mr-1" />
                            Borrowed {formatTimeAgo(loan.borrowStartTime)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-red-600">
                          {formatAmount(loan.totalOwed, loan.decimals)}{" "}
                          {loan.symbol}
                        </div>
                        <div className="text-xs text-gray-500">Total Owed</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 rounded p-2">
                        <div className="text-gray-600">Principal</div>
                        <div className="font-medium">
                          {formatAmount(loan.principal, loan.decimals)}{" "}
                          {loan.symbol}
                        </div>
                      </div>
                      <div className="bg-yellow-50 rounded p-2">
                        <div className="text-gray-600">Interest</div>
                        <div className="font-medium text-yellow-700">
                          {formatAmount(loan.estimatedInterest, loan.decimals)}{" "}
                          {loan.symbol}
                        </div>
                      </div>
                    </div>

                    {selectedLoan?.token === loan.token && (
                      <div className="mt-2 p-2 bg-primary/10 rounded text-xs text-primary">
                        ✓ Selected for payment
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <DollarSign className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 font-medium">No Active Loans</p>
                <p className="text-sm text-gray-500">
                  You don't have any outstanding loans to pay back.
                </p>
              </div>
            )}
          </div>

          {/* Payment Form - Only show if there are active loans */}
          {activeLoans.length > 0 && (
            <>
              <div className="border-t pt-4">
                <Label className="text-sm font-medium text-gray-700 mb-3 block">
                  Payment Details
                </Label>

                <div className="space-y-3">
                  <div>
                    <Label
                      htmlFor="payback-token"
                      className="text-sm font-medium text-gray-700"
                    >
                      Loan to Pay Back
                    </Label>
                    <Select
                      value={form.token}
                      onValueChange={(value) => {
                        const loan = activeLoans.find((l) => l.token === value);
                        if (loan) {
                          handleLoanSelect(loan);
                        }
                      }}
                    >
                      <SelectTrigger className="mt-1 min-h-[48px]">
                        <SelectValue placeholder="Select loan to pay back" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeLoans.map((loan) => (
                          <SelectItem key={loan.token} value={loan.token}>
                            <div className="flex items-center">
                              <span className="mr-2">
                                {getTokenFlag(loan.symbol)}
                              </span>
                              {loan.symbol} -{" "}
                              {formatAmount(loan.totalOwed, loan.decimals)} owed
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label
                      htmlFor="payback-amount"
                      className="text-sm font-medium text-gray-700"
                    >
                      Payment Amount
                    </Label>
                    <Input
                      id="payback-amount"
                      type="number"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                      className="mt-1 min-h-[48px]"
                      min="0.01"
                      step="0.01"
                    />
                    {selectedLoan && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Total Owed:</span>
                          <span className="font-medium">
                            {formatAmount(
                              selectedLoan.totalOwed,
                              selectedLoan.decimals
                            )}{" "}
                            {selectedLoan.symbol}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full text-xs bg-transparent"
                          onClick={() =>
                            setForm({
                              ...form,
                              amount: formatAmount(
                                selectedLoan.totalOwed,
                                selectedLoan.decimals
                              ),
                            })
                          }
                        >
                          Pay Full Amount
                        </Button>
                      </div>
                    )}
                  </div>

                  {selectedLoan && Number(form.amount) > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start">
                        <AlertCircle className="w-4 h-4 text-blue-600 mr-2 mt-0.5" />
                        <div className="text-sm">
                          <div className="font-medium text-blue-800 mb-1">
                            Payment Breakdown
                          </div>
                          <div className="text-blue-700 space-y-1">
                            <div>
                              Amount: {form.amount} {selectedLoan.symbol}
                            </div>
                            <div className="text-xs">
                              This will reduce your outstanding debt. Any
                              overpayment will be refunded.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
                  onClick={handlePayBack}
                  disabled={
                    loading ||
                    !form.token ||
                    !form.amount ||
                    Number(form.amount) <= 0
                  }
                  className="flex-1 bg-primary hover:bg-secondary text-white min-h-[48px]"
                >
                  {loading ? "Processing..." : "Pay Back Now"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
