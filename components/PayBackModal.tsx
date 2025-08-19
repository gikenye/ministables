"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpRight, DollarSign, CreditCard } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { OnrampDepositModal } from "./OnrampDepositModal";
import { onrampService } from "@/lib/services/onrampService";
import { useToast } from "@/hooks/use-toast";
import { oracleService } from "@/lib/services/oracleService";
import { getContract, prepareContractCall } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";
import { getTokenIcon } from "@/lib/utils/tokenIcons";
import { useUserBorrows } from "@/hooks/useContractData";
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
  userBalances?: Record<string, string>;
}

export function PayBackModal({
  isOpen,
  onClose,
  onPayBack,
  tokenInfos,
  loading,
  userBalances = {},
}: PayBackModalProps) {
  const account = useActiveAccount();
  const address = account?.address;
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

  // Get supported tokens from props - filtered to only cKES
  const supportedStablecoins = useMemo(() => {
    return Object.keys(tokenInfos).filter(tokenAddress => {
      const tokenInfo = tokenInfos[tokenAddress];
      return tokenInfo?.symbol === 'cKES';
    });
  }, [tokenInfos]);



  const handleLoanSelect = (loan: ActiveLoan) => {
    setSelectedLoan(loan);
    setForm({
      token: loan.token,
      amount: formatAmount(loan.totalOwed, loan.decimals),
    });
  };

  const { mutateAsync: sendTransaction, isPending: isTransactionPending } = useSendTransaction();

  const handlePayBack = async () => {
    if (!form.token || !form.amount) return;

    try {
      const isOracleValid = await oracleService.validatePriceData(form.token);
      if (!isOracleValid) {
        toast({
          title: "Oracle Price Error",
          description: "Unable to get current market prices. Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }

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
            <DialogDescription className="text-xs text-gray-600">
              Select a loan and amount to repay. Your wallet will handle approvals and the transaction.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {supportedStablecoins.map((tokenAddress) => {
                const tokenInfo = tokenInfos[tokenAddress];
                if (!tokenInfo || !address) return null;
                
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
              })}
            </div>

            {address && (
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
                          const tokenInfo = tokenInfos[value];
                          if (tokenInfo) {
                            // Create a minimal loan object for selection
                            const loan = {
                              token: value,
                              symbol: tokenInfo.symbol,
                              principal: "0",
                              totalOwed: "0",
                              decimals: tokenInfo.decimals,
                            };
                            handleLoanSelect(loan);
                          }
                        }}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select loan" />
                        </SelectTrigger>
                        <SelectContent>
                          {supportedStablecoins.map((tokenAddress) => {
                            const tokenInfo = tokenInfos[tokenAddress];
                            if (!tokenInfo) return null;
                            
                            return (
                              <SelectItem key={tokenAddress} value={tokenAddress}>
                                <div className="flex items-center gap-2">
                                  {getTokenIcon(tokenInfo.symbol).startsWith('http') ? (
                                    <img src={getTokenIcon(tokenInfo.symbol)} alt={tokenInfo.symbol} className="w-4 h-4 rounded-full" />
                                  ) : (
                                    <span className="text-sm">{getTokenIcon(tokenInfo.symbol)}</span>
                                  )}
                                  <span className="font-medium">
                                    {tokenInfo.symbol}
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
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
                      {form.token && (
                        <div className="mt-2 text-xs text-gray-600">
                          Wallet balance: {formatAmount(
                            userBalances[form.token] || '0',
                            tokenInfos[form.token]?.decimals || 18
                          )} {tokenInfos[form.token]?.symbol}
                        </div>
                      )}
                      {selectedLoan && (
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setForm({ ...form, amount: (Number(formatAmount(selectedLoan.totalOwed, selectedLoan.decimals)) * 0.1).toFixed(6) })}
                          >
                            10%
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setForm({ ...form, amount: (Number(formatAmount(selectedLoan.totalOwed, selectedLoan.decimals)) * 0.2).toFixed(6) })}
                          >
                            20%
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setForm({ ...form, amount: (Number(formatAmount(selectedLoan.totalOwed, selectedLoan.decimals)) * 0.5).toFixed(6) })}
                          >
                            50%
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setForm({ ...form, amount: (Number(formatAmount(selectedLoan.totalOwed, selectedLoan.decimals))).toFixed(6) })}
                          >
                            Max
                          </Button>
                        </div>
                      )}
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
                      isTransactionPending ||
                      !form.token ||
                      !form.amount ||
                      Number(form.amount) <= 0
                    }
                    className="flex-1 h-9 text-sm bg-primary hover:bg-secondary text-white"
                  >
                    {loading || isTransactionPending ? "Processing..." : "Pay Back"}
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
