"use client";

import { useState, useEffect, useMemo } from "react";
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
import { ArrowUpRight, DollarSign, CreditCard } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { useActiveAccount } from "thirdweb/react";
import { OnrampDepositModal } from "./OnrampDepositModal";
import { onrampService } from "@/lib/services/onrampService";
import { useToast } from "@/hooks/use-toast";
import { oracleService } from "@/lib/services/oracleService";
import { getContract, readContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";
import { getTokenIcon } from "@/lib/utils/tokenIcons";

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
  const { toast } = useToast();

  const [form, setForm] = useState({
    token: "",
    amount: "",
  });

  // Memoize contract instance to prevent re-creation
  const contract = useMemo(() => getContract({
    client,
    chain: celo,
    address: MINILEND_ADDRESS,
  }), []);

  // Get supported tokens from props
  const supportedStablecoins = useMemo(() => Object.keys(tokenInfos), [tokenInfos]);

  // Load active loans when modal opens
  useEffect(() => {
    if (isOpen && address && Object.keys(tokenInfos).length > 0) {
      loadActiveLoans();
    }
  }, [isOpen, address, tokenInfos]);

  const loadActiveLoans = async () => {
    if (!address) return;

    setLoadingLoans(true);
    try {
      const loans: ActiveLoan[] = [];

      const borrowPromises = supportedStablecoins.map(async (tokenAddress) => {
        const tokenInfo = tokenInfos[tokenAddress];
        if (!tokenInfo) return null;

        try {
          const borrowAmount = await readContract({
            contract,
            method: "function userBorrows(address, address) view returns (uint256)",
            params: [address, tokenAddress],
          });

          if (borrowAmount && borrowAmount.toString() !== "0") {
            const principal = parseFloat(formatAmount(borrowAmount.toString(), tokenInfo.decimals));
            const estimatedInterest = principal * 0.05;
            const totalOwed = principal + estimatedInterest;

            return {
              token: tokenAddress,
              symbol: tokenInfo.symbol,
              principal: borrowAmount.toString(),
              estimatedInterest: (estimatedInterest * Math.pow(10, tokenInfo.decimals)).toString(),
              totalOwed: (totalOwed * Math.pow(10, tokenInfo.decimals)).toString(),
              borrowStartTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
              decimals: tokenInfo.decimals,
            };
          }
        } catch (error) {
          console.error(`Error loading borrow data:`, error);
        }
        return null;
      });

      const loanResults = await Promise.allSettled(borrowPromises);
      const validLoans = loanResults
        .filter((result): result is PromiseFulfilledResult<ActiveLoan> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);
      
      loans.push(...validLoans);
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
      // Validate Oracle price before repayment
      const isOracleValid = await oracleService.validatePriceData(form.token);
      if (!isOracleValid) {
        toast({
          title: "Oracle Price Error",
          description: "Unable to get current market prices. Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }

      // Note: The parent component's onPayBack function should handle token approval
      // before attempting to repay the loan with user tokens
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
      if (error.message?.includes("ERC20: insufficient allowance") || error.message?.includes("Approve contract first")) {
        toast({
          title: "Approval Required",
          description: "Please approve the contract to spend your tokens first. This should happen automatically.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Failed",
          description: error.message || "Failed to process payment. Please try again.",
          variant: "destructive",
        });
      }
    }
  };





  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[90vw] max-w-xs mx-auto bg-white border-0 shadow-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-base font-medium text-gray-900">
              Pay Back Loans
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {loadingLoans ? (
              <div className="text-center py-4">
                <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-xs text-gray-600 mt-2">Loading...</p>
              </div>
            ) : activeLoans.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {activeLoans.map((loan) => (
                  <div
                    key={loan.token}
                    className={`border rounded p-2 cursor-pointer transition-all ${selectedLoan?.token === loan.token
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-primary/50"
                      }`}
                    onClick={() => handleLoanSelect(loan)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{loan.symbol}</span>
                      <span className="text-sm text-red-600 font-medium">
                        {formatAmount(loan.totalOwed, loan.decimals)}
                      </span>
                    </div>
                    {selectedLoan?.token === loan.token && (
                      <div className="text-xs text-primary mt-1">✓ Selected</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">No Active Loans</p>
              </div>
            )}

            {activeLoans.length > 0 && (
              <>
                <div className="border-t pt-3">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-medium text-gray-600 mb-1 block">
                        Select Loan
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
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select loan" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeLoans.map((loan) => (
                            <SelectItem key={loan.token} value={loan.token}>
                              <div className="flex items-center gap-2">
                                {getTokenIcon(loan.symbol).startsWith('http') ? (
                                  <img src={getTokenIcon(loan.symbol)} alt={loan.symbol} className="w-4 h-4 rounded-full" />
                                ) : (
                                  <span className="text-sm">{getTokenIcon(loan.symbol)}</span>
                                )}
                                <span className="font-medium">
                                  {loan.symbol} - {formatAmount(loan.totalOwed, loan.decimals)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-medium text-gray-600 mb-1 block">
                          Amount
                        </Label>
                        {selectedLoan && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                amount: formatAmount(
                                  selectedLoan.totalOwed,
                                  selectedLoan.decimals
                                ),
                              })
                            }
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Full
                          </button>
                        )}
                      </div>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={form.amount}
                        onChange={(e) =>
                          setForm({ ...form, amount: e.target.value })
                        }
                        className="h-10"
                        min="0.01"
                        step="0.01"
                      />
                    </div>
                  </div>
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
                    onClick={handlePayBack}
                    disabled={
                      loading ||
                      !form.token ||
                      !form.amount ||
                      Number(form.amount) <= 0
                    }
                    className="flex-1 h-9 text-sm bg-primary hover:bg-secondary text-white"
                  >
                    {loading ? "Processing..." : "Pay Back"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <OnrampDepositModal
        isOpen={showOnrampModal}
        onClose={() => setShowOnrampModal(false)}
        selectedAsset={selectedLoan?.symbol || ""}
        assetSymbol={selectedLoan?.symbol || ""}
        onSuccess={(transactionCode, amount) => {
          toast({
            title: "Deposit Initiated",
            description: `${selectedLoan?.symbol} deposit processing`,
          });
          setShowOnrampModal(false);
        }}
      />
    </>
  );
}
