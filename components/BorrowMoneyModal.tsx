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
import { ArrowDownLeft, Shield, AlertCircle, CreditCard } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { parseUnits } from "viem";
import { OnrampDepositModal } from "./OnrampDepositModal";
import { onrampService } from "@/lib/services/onrampService";
import { oracleService } from "@/lib/services/oracleService";

interface BorrowMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBorrow: (
    token: string,
    amount: string,
    collateralToken: string
  ) => Promise<void>;
  onDepositCollateral: (token: string, amount: string) => Promise<void>;
  userBalances: Record<string, string>;
  userCollaterals: Record<string, string>;
  tokenInfos: Record<string, { symbol: string; decimals: number }>;
  loading: boolean;
}

// Constants
const LOAN_TO_VALUE_RATIO = 0.67; // 67% LTV
const COLLATERALIZATION_RATIO = 1.5; // 150% collateralization

// Error handling utility
const handleTransactionError = (error: any, toast: any, defaultMessage: string) => {
  console.error("Transaction error:", error);
  
  if (error.message?.includes("FILE_ERROR_NO_SPACE") ||
      error.message?.includes("QuotaExceededError") ||
      error.message?.includes("no space")) {
    toast({
      title: "Storage Error",
      description: "Your device is running out of disk space. Please free up some space and try again.",
      variant: "destructive",
    });
  } else if (error.message?.includes("User rejected") ||
             error.message?.includes("rejected the request")) {
    toast({
      title: "Transaction Cancelled",
      description: "You cancelled the transaction in your wallet.",
      variant: "default",
    });
  } else {
    toast({
      title: "Error",
      description: error.message || defaultMessage,
      variant: "destructive",
    });
  }
};

export function BorrowMoneyModal({
  isOpen,
  onClose,
  onBorrow,
  onDepositCollateral,
  userBalances,
  userCollaterals,
  tokenInfos,
  loading,
}: BorrowMoneyModalProps) {
  const { toast } = useToast();

  // Memoize supported tokens to prevent re-renders
  const SUPPORTED_STABLECOINS = useMemo(() => Object.keys(tokenInfos), [tokenInfos]);
  const SUPPORTED_COLLATERAL = useMemo(() => Object.keys(tokenInfos), [tokenInfos]);

  const [form, setForm] = useState({
    token: "",
    collateralToken: "",
    amount: "",
    collateralAmount: "",
  });

  const [requiredCollateral, setRequiredCollateral] = useState<string | null>(null);
  const [needsMoreCollateral, setNeedsMoreCollateral] = useState(false);
  const [maxBorrowAmount, setMaxBorrowAmount] = useState<string | null>(null);
  const [showAddCollateral, setShowAddCollateral] = useState(false);
  const [showOnrampModal, setShowOnrampModal] = useState(false);

  const hasCollateral = (token: string) => {
    const collateral = userCollaterals[token];
    return collateral && collateral !== "0";
  };

  const handleDepositCollateral = async () => {
    if (!form.collateralToken || !form.collateralAmount) {
      toast({
        title: "Missing Information",
        description: "Please select collateral type and enter amount.",
        variant: "destructive",
      });
      return;
    }

    try {
      await onDepositCollateral(form.collateralToken, form.collateralAmount);
      setForm((prev) => ({ ...prev, collateralAmount: "" }));
    } catch (error: any) {
      handleTransactionError(error, toast, "Failed to deposit collateral. Please try again.");
    }
  };

  const handleBorrow = async () => {
    if (!form.token || !form.collateralToken || !form.amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to borrow money.",
        variant: "destructive",
      });
      return;
    }

    if (!hasCollateral(form.collateralToken)) {
      toast({
        title: "No Collateral",
        description: "You need to deposit collateral first before borrowing.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate Oracle prices before borrowing
      const isOracleValid = await oracleService.validateMultipleTokens([form.token, form.collateralToken]);
      if (!isOracleValid) {
        toast({
          title: "Oracle Price Error",
          description: "Unable to get current market prices. Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }

      await onBorrow(form.token, form.amount, form.collateralToken);
      setForm({ token: "", collateralToken: "", amount: "", collateralAmount: "" });
      onClose();
    } catch (error: any) {
      handleTransactionError(error, toast, "Failed to borrow money. Please try again.");
    }
  };

  const calculateMaxBorrowAmount = () => {
    if (!form.collateralToken || !hasCollateral(form.collateralToken)) {
      setMaxBorrowAmount(null);
      return;
    }

    const collateralAmount = userCollaterals[form.collateralToken];
    const tokenInfo = tokenInfos[form.collateralToken];
    if (collateralAmount && tokenInfo) {
      const maxAmount = (parseFloat(formatAmount(collateralAmount, tokenInfo.decimals)) * LOAN_TO_VALUE_RATIO).toFixed(6);
      setMaxBorrowAmount(maxAmount);
    }
  };

  const handleSetMaxAmount = () => {
    if (maxBorrowAmount) {
      const maxAmountValue = maxBorrowAmount.replace(/,/g, '');
      setForm(prev => ({ ...prev, amount: maxAmountValue }));
    }
  };

  const calculateRequiredCollateral = () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setRequiredCollateral(null);
      setNeedsMoreCollateral(false);
      return;
    }

    const required = (parseFloat(form.amount) * COLLATERALIZATION_RATIO).toFixed(6);
    setRequiredCollateral(required);

    if (hasCollateral(form.collateralToken)) {
      const userCollateral = parseFloat(formatAmount(
        userCollaterals[form.collateralToken],
        tokenInfos[form.collateralToken]?.decimals || 18
      ));
      setNeedsMoreCollateral(userCollateral < parseFloat(required));
    } else {
      setNeedsMoreCollateral(true);
    }
  };

  // Recalculate when form changes
  useEffect(() => {
    calculateRequiredCollateral();
    calculateMaxBorrowAmount();
  }, [form.token, form.collateralToken, form.amount, userCollaterals]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto bg-white border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center text-gray-900 text-lg font-semibold">
            <ArrowDownLeft className="w-5 h-5 mr-2 text-primary" />
            Borrow Money
          </DialogTitle>
          <DialogDescription>
            Borrow money using your collateral as a guarantee
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label
              htmlFor="borrow-token"
              className="text-sm font-medium text-gray-700"
            >
              Borrow
            </Label>
            <Select
              value={form.token}
              onValueChange={(value) => setForm({ ...form, token: value })}
            >
              <SelectTrigger className="mt-1 min-h-[48px]">
                <SelectValue placeholder="Select money type" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_STABLECOINS.map((token) => {
                  const tokenInfo = tokenInfos[token];
                  return (
                    <SelectItem key={token} value={token}>
                      {tokenInfo?.symbol || token.slice(0, 6) + "..."}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label
              htmlFor="collateral-token"
              className="text-sm font-medium text-gray-700"
            >
              Use as Guarantee
            </Label>
            <Select
              value={form.collateralToken}
              onValueChange={(value) =>
                setForm({ ...form, collateralToken: value })
              }
            >
              <SelectTrigger className="mt-1 min-h-[48px]">
                <SelectValue placeholder="Select guarantee type" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_COLLATERAL.map((token) => {
                  const tokenInfo = tokenInfos[token];
                  return (
                    <SelectItem key={token} value={token}>
                      {tokenInfo?.symbol || token.slice(0, 6) + "..."}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {form.collateralToken && hasCollateral(form.collateralToken) && (
              <div className="mt-1">
                <div className="flex justify-between items-center">
                  <p className={`text-sm ${needsMoreCollateral ? "text-amber-600" : "text-green-600"}`}>
                    ✓ Deposited:{" "}
                    {formatAmount(
                      userCollaterals[form.collateralToken],
                      tokenInfos[form.collateralToken]?.decimals || 18
                    )}{" "}
                    {tokenInfos[form.collateralToken]?.symbol}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddCollateral(!showAddCollateral)}
                    className="h-6 text-xs text-blue-600 hover:text-blue-800 p-0"
                  >
                    {showAddCollateral ? "Hide" : "Add More"}
                  </Button>
                </div>
                {requiredCollateral && (
                  <p className="text-sm text-gray-600">
                    Required: {requiredCollateral} {tokenInfos[form.collateralToken]?.symbol}
                  </p>
                )}
                {maxBorrowAmount && (
                  <p className="text-sm text-blue-600 mt-1">
                    Max borrowable: {maxBorrowAmount} {tokenInfos[form.token]?.symbol}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Collateral Deposit Section */}
          {form.collateralToken && (!hasCollateral(form.collateralToken) || needsMoreCollateral || showAddCollateral) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center mb-2">
                <Shield className="w-4 h-4 text-yellow-600 mr-2" />
                <span className="text-sm font-medium text-yellow-800">
                  {!hasCollateral(form.collateralToken)
                    ? "Deposit Collateral First"
                    : needsMoreCollateral
                      ? "Additional Collateral Needed"
                      : "Add More Collateral"}
                </span>
              </div>
              {requiredCollateral && (
                <div className="flex items-start mb-2 text-xs text-yellow-700">
                  <AlertCircle className="w-3 h-3 text-yellow-600 mr-1 mt-0.5" />
                  <span>
                    You need at least {requiredCollateral} {tokenInfos[form.collateralToken]?.symbol} as collateral for this loan amount
                  </span>
                </div>
              )}
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="Collateral amount"
                  value={form.collateralAmount}
                  onChange={(e) =>
                    setForm({ ...form, collateralAmount: e.target.value })
                  }
                  className="min-h-[40px]"
                  min="0.01"
                  step="0.01"
                />
                {form.collateralToken && userBalances[form.collateralToken] && (
                  <p className="text-xs text-gray-600">
                    Available:{" "}
                    {formatAmount(
                      userBalances[form.collateralToken],
                      tokenInfos[form.collateralToken]?.decimals || 18
                    )}{" "}
                    {tokenInfos[form.collateralToken]?.symbol}
                  </p>
                )}
                <div className="space-y-2">
                  <Button
                    onClick={handleDepositCollateral}
                    disabled={loading || !form.collateralAmount}
                    variant="outline"
                    className="w-full border-yellow-400 text-yellow-700 hover:bg-yellow-100 min-h-[40px] bg-transparent"
                  >
                    {loading ? "Depositing..." : "Deposit from Wallet"}
                  </Button>

                  {/* Show onramp option only for supported assets */}
                  {form.collateralToken &&
                    onrampService.isAssetSupportedForOnramp(
                      tokenInfos[form.collateralToken]?.symbol || ""
                    ) && (
                      <Button
                        onClick={() => setShowOnrampModal(true)}
                        disabled={loading}
                        variant="outline"
                        className="w-full border-blue-400 text-blue-700 hover:bg-blue-100 min-h-[40px] bg-transparent"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Deposit via Mobile Money
                      </Button>
                    )}
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center">
              <Label
                htmlFor="borrow-amount"
                className="text-sm font-medium text-gray-700"
              >
                Amount
              </Label>
              {maxBorrowAmount && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSetMaxAmount}
                  className="h-6 text-xs text-blue-600 hover:text-blue-800 p-0"
                >
                  Max
                </Button>
              )}
            </div>
            <Input
              id="borrow-amount"
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="mt-1 min-h-[48px]"
              min="0.01"
              step="0.01"
            />
            {form.amount && maxBorrowAmount && parseFloat(form.amount) > parseFloat(maxBorrowAmount.replace(/,/g, '')) && (
              <p className="text-xs text-red-600 mt-1">
                Amount exceeds your maximum borrowable amount
              </p>
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
              onClick={handleBorrow}
              disabled={
                loading ||
                !form.token ||
                !form.collateralToken ||
                !form.amount ||
                !hasCollateral(form.collateralToken) ||
                needsMoreCollateral
              }
              className="flex-1 bg-primary hover:bg-secondary text-white min-h-[48px]"
            >
              {loading ? "Borrowing..." : "Borrow Now"}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Onramp Deposit Modal */}
      <OnrampDepositModal
        isOpen={showOnrampModal}
        onClose={() => setShowOnrampModal(false)}
        selectedAsset={tokenInfos[form.collateralToken]?.symbol || ""}
        assetSymbol={tokenInfos[form.collateralToken]?.symbol || ""}
        onSuccess={(transactionCode, amount) => {
          toast({
            title: "Mobile Money Deposit Initiated",
            description: `Your ${tokenInfos[form.collateralToken]?.symbol} deposit will be processed once payment is confirmed.`,
          });
          setShowOnrampModal(false);
        }}
      />
    </Dialog>
  );
}
