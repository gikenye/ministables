"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


import { formatAmount } from "@/lib/utils";
import { useActiveAccount } from "thirdweb/react";
import { useToast } from "@/hooks/use-toast";
import { oracleService } from "@/lib/services/oracleService";
import { getContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";


import { LoanItem } from "./LoanItem";

interface ActiveLoan {
  token: string;
  symbol: string;
  principal: string;
  totalOwed: string;
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
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [form, setForm] = useState({
    token: "",
    amount: "",
  });
  const { toast } = useToast();

  // Memoize contract instance to prevent re-creation
  const contract = useMemo(() => getContract({
    client,
    chain: celo,
    address: MINILEND_ADDRESS,
  }), []);

  const supportedStablecoins = useMemo(() => Object.keys(tokenInfos), [tokenInfos]);

  const handleLoanSelect = (loan: ActiveLoan) => {
    setSelectedLoan(loan);
    setForm(prev => ({
      ...prev,
      token: loan.token,
      amount: formatAmount(loan.totalOwed, loan.decimals),
    }));
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
    } catch (error: unknown) {
      console.error("Payment error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("ERC20: insufficient allowance") || errorMessage.includes("Approve contract first")) {
        toast({
          title: "Approval Required",
          description: "Please approve the contract to spend your tokens first. This should happen automatically.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Failed",
          description: errorMessage || "Failed to process payment. Please try again.",
          variant: "destructive",
        });
      }
    }
  };





  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-xs mx-auto bg-white border-0 shadow-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-base font-medium text-gray-900">
            Pay Back Loans
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Select a loan to pay back from your active loans below.
          </DialogDescription>
        </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">
                Your Active Loans
              </Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {address ? (
                  supportedStablecoins.map((tokenAddress) => {
                    const tokenInfo = tokenInfos[tokenAddress];
                    if (!tokenInfo) return null;
                    
                    return (
                      <LoanItem
                        key={tokenAddress}
                        contract={contract}
                        userAddress={address}
                        tokenAddress={tokenAddress}
                        tokenInfo={tokenInfo}
                        onSelect={handleLoanSelect}
                        isSelected={selectedLoan?.token === tokenAddress}
                      />
                    );
                  })
                ) : (
                  <div className="text-center text-gray-500 text-sm py-4">
                    Connect wallet to view loans
                  </div>
                )}
              </div>
            </div>

            {selectedLoan && (
              <div className="border-t pt-3">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-medium text-gray-600 mb-1 block">
                        Payment Amount
                      </Label>
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
                        Pay Full
                      </button>
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
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
