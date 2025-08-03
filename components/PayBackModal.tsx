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
import { ArrowUpRight, AlertCircle, Clock, DollarSign, CreditCard, Smartphone } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { useActiveAccount } from "thirdweb/react";
import { OnrampDepositModal } from "./OnrampDepositModal";
import { MobileMoneyWithdrawModal } from "./EnhancedMobileMoneyWithdrawModal";
import { onrampService } from "@/lib/services/onrampService";
import { offrampService } from "@/lib/services/offrampService";
import { useToast } from "@/hooks/use-toast";

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
  const account = useActiveAccount();
  const address = account?.address;
  const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [showOnrampModal, setShowOnrampModal] = useState(false);
  const [showMobileMoneyModal, setShowMobileMoneyModal] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    token: "",
    amount: "",
  });

  // Mock supported tokens
  const supportedStablecoins = [
    "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
    "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
    "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
  ];

  // Load active loans when modal opens
  useEffect(() => {
    if (isOpen && address) {
      loadActiveLoans();
    }
  }, [isOpen, address]);

  const loadActiveLoans = async () => {
    if (!address) return;

    setLoadingLoans(true);
    try {
      const loans: ActiveLoan[] = [];

      // Mock loan data - replace with actual contract calls
      for (const tokenAddress of supportedStablecoins) {
        const tokenInfo = tokenInfos[tokenAddress];
        if (tokenInfo) {
          // Mock some loan data for demonstration
          const mockBorrowAmount = "1000000000000000000"; // 1 token
          const principal = parseFloat(formatAmount(mockBorrowAmount, tokenInfo.decimals));
          const estimatedInterest = principal * 0.05;
          const totalOwed = principal + estimatedInterest;

          loans.push({
            token: tokenAddress,
            symbol: tokenInfo.symbol,
            principal: mockBorrowAmount,
            estimatedInterest: (estimatedInterest * Math.pow(10, tokenInfo.decimals)).toString(),
            totalOwed: (totalOwed * Math.pow(10, tokenInfo.decimals)).toString(),
            borrowStartTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
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

    try {
      await onPayBack(form.token, form.amount);
      setForm({ token: "", amount: "" });
      setSelectedLoan(null);
      onClose();
      toast({
        title: "Payment Successful",
        description: "Your loan payment has been processed successfully.",
      });
    } catch (error: any) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    }
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
    <>
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
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${selectedLoan?.token === loan.token
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

                    {/* Deposit Options */}
                    {selectedLoan && onrampService.isAssetSupportedForOnramp(selectedLoan.symbol) && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="text-sm font-medium text-green-800 mb-2">
                          Need to deposit {selectedLoan.symbol} for payment?
                        </div>
                        <Button
                          onClick={() => setShowOnrampModal(true)}
                          variant="outline"
                          className="w-full border-green-400 text-green-700 hover:bg-green-100 min-h-[40px] bg-transparent"
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Deposit via Mobile Money
                        </Button>
                      </div>
                    )}

                    {/* Mobile Money Withdrawal Option */}
                    {selectedLoan && offrampService.isCryptoSupportedForOfframp(selectedLoan.symbol) && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="text-sm font-medium text-blue-800 mb-2">
                          💰 Convert Excess to Mobile Money
                        </div>
                        <div className="text-xs text-blue-700 mb-3">
                          Pay back loan and withdraw any remaining {selectedLoan.symbol} to mobile money
                        </div>
                        <Button
                          onClick={() => setShowMobileMoneyModal(true)}
                          variant="outline"
                          className="w-full border-blue-400 text-blue-700 hover:bg-blue-100 min-h-[40px] bg-transparent"
                        >
                          <Smartphone className="w-4 h-4 mr-2" />
                          Pay & Withdraw to Mobile Money
                        </Button>
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

      {/* Optimized Onramp Deposit Modal */}
      <OnrampDepositModal
        isOpen={showOnrampModal}
        onClose={() => setShowOnrampModal(false)}
        selectedAsset={selectedLoan?.symbol || ""}
        assetSymbol={selectedLoan?.symbol || ""}
        onSuccess={(transactionCode, amount) => {
          toast({
            title: "Mobile Money Deposit Initiated",
            description: `Your ${selectedLoan?.symbol} deposit will be processed once payment is confirmed.`,
          });
          setShowOnrampModal(false);
        }}
      />

      {/* Mobile Money Withdrawal Modal */}
      {selectedLoan && (
        <MobileMoneyWithdrawModal
          isOpen={showMobileMoneyModal}
          onClose={() => setShowMobileMoneyModal(false)}
          tokenSymbol={selectedLoan.symbol}
          tokenAddress={selectedLoan.token}
          network={offrampService.detectNetworkFromTokenAddress(selectedLoan.token) || "celo"}
          availableAmount="0" // This would need to be calculated based on user's balance after loan payment
          decimals={selectedLoan.decimals}
          onWithdrawSuccess={(orderID, amount) => {
            setShowMobileMoneyModal(false);
            setForm({ token: "", amount: "" });
            setSelectedLoan(null);
            onClose();
          }}
          onBlockchainWithdraw={async (tokenAddress: string, amount: string) => {
            // This would handle the withdrawal after loan payment
            // In a real implementation, this would be integrated with the loan payment flow
            return "0x" + Math.random().toString(16).substr(2, 64);
          }}
        />
      )}
    </>
  );
}
