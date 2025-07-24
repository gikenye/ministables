"use client";

import { useState, useEffect } from "react";
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
import { ArrowDownLeft, Shield, AlertCircle } from "lucide-react";
import { useContract } from "@/lib/contract";
import { formatAmount } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { parseUnits } from "viem";

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
  const { supportedStablecoins, supportedCollateral } = useContract();

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
      console.error("Deposit collateral error:", error);
      
      // Check for specific errors
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
          description: error.message || "Failed to deposit collateral. Please try again.",
          variant: "destructive",
        });
      }
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
      await onBorrow(form.token, form.amount, form.collateralToken);
      setForm({
        token: "",
        collateralToken: "",
        amount: "",
        collateralAmount: "",
      });
      onClose();
    } catch (error: any) {
      console.error("Borrow error:", error);
      
      // Check for specific errors
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
          description: error.message || "Failed to borrow money. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Calculate maximum borrowable amount based on current collateral
  const calculateMaxBorrowAmount = async () => {
    if (!form.token || !form.collateralToken || !hasCollateral(form.collateralToken)) {
      setMaxBorrowAmount(null);
      return;
    }

    try {
      // Get token prices from oracle
      const [tokenRateData, collateralRateData] = await Promise.all([
        useContract().getOracleRate(form.token),
        useContract().getOracleRate(form.collateralToken),
      ]);

      const tokenInfo = await useContract().getTokenInfo(form.token);
      const collateralInfo = await useContract().getTokenInfo(form.collateralToken);
      
      // Get user's current collateral amount
      const userCollateralAmount = BigInt(userCollaterals[form.collateralToken]);
      
      // Calculate collateral value (collateralAmount * collateralPrice / 1e6)
      const collateralRate = BigInt(collateralRateData.rate);
      const collateralValue = (userCollateralAmount * collateralRate) / BigInt(10 ** 6);
      
      // Calculate maximum loan value (collateralValue * 100 / 150)
      const LIQUIDATION_THRESHOLD = 150;
      const maxLoanValue = (collateralValue * BigInt(100)) / BigInt(LIQUIDATION_THRESHOLD);
      
      // Convert to token amount (maxLoanValue / tokenPrice * 1e18)
      const tokenRate = BigInt(tokenRateData.rate);
      const maxTokenAmount = (maxLoanValue * BigInt(10 ** 18)) / tokenRate;
      
      // Format the maximum borrowable amount
      const formattedMaxAmount = formatAmount(
        maxTokenAmount.toString(),
        tokenInfo.decimals
      );
      
      setMaxBorrowAmount(formattedMaxAmount);
    } catch (error) {
      console.error("Error calculating max borrow amount:", error);
      setMaxBorrowAmount(null);
    }
  };

  // Set borrow amount to maximum
  const handleSetMaxAmount = () => {
    if (maxBorrowAmount) {
      // Remove commas and convert to number for the input field
      const maxAmountValue = maxBorrowAmount.replace(/,/g, '');
      setForm(prev => ({ ...prev, amount: maxAmountValue }));
    }
  };

  // Calculate required collateral based on loan amount
  const calculateRequiredCollateral = async () => {
    if (!form.token || !form.collateralToken || !form.amount || parseFloat(form.amount) <= 0) {
      setRequiredCollateral(null);
      setNeedsMoreCollateral(false);
      return;
    }

    try {
      // Get token prices from oracle
      const [tokenRateData, collateralRateData] = await Promise.all([
        useContract().getOracleRate(form.token),
        useContract().getOracleRate(form.collateralToken),
      ]);

      const tokenInfo = await useContract().getTokenInfo(form.token);
      const collateralInfo = await useContract().getTokenInfo(form.collateralToken);
      
      // Convert amount to BigInt with proper decimals
      const amountWei = parseUnits(form.amount, tokenInfo.decimals);
      
      // Calculate loan value (amount * tokenPrice / 1e18)
      const tokenRate = BigInt(tokenRateData.rate);
      const loanValue = (amountWei * tokenRate) / BigInt(10 ** 18);
      
      // Calculate required collateral value (loanValue * 150 / 100)
      const LIQUIDATION_THRESHOLD = 150;
      const requiredCollateralValue = (loanValue * BigInt(LIQUIDATION_THRESHOLD)) / BigInt(100);
      
      // Convert to collateral amount (requiredCollateralValue / collateralPrice * 1e6)
      const collateralRate = BigInt(collateralRateData.rate);
      const requiredCollateralAmount = (requiredCollateralValue * BigInt(10 ** 6)) / collateralRate;
      
      // Format the required collateral amount
      const formattedRequiredCollateral = formatAmount(
        requiredCollateralAmount.toString(),
        collateralInfo.decimals
      );
      
      setRequiredCollateral(formattedRequiredCollateral);
      
      // Check if user has enough collateral
      if (hasCollateral(form.collateralToken)) {
        const userCollateralAmount = userCollaterals[form.collateralToken];
        const userCollateralBigInt = BigInt(userCollateralAmount);
        
        // If user's collateral is less than required, they need to deposit more
        setNeedsMoreCollateral(userCollateralBigInt < requiredCollateralAmount);
      } else {
        setNeedsMoreCollateral(true);
      }
    } catch (error) {
      console.error("Error calculating required collateral:", error);
      setRequiredCollateral(null);
    }
  };

  // Recalculate required collateral and max borrow amount when relevant form fields change
  useEffect(() => {
    calculateRequiredCollateral();
    calculateMaxBorrowAmount();
  }, [form.token, form.collateralToken, form.amount, userCollaterals[form.collateralToken]]);

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
                {supportedStablecoins.map((token) => (
                  <SelectItem key={token} value={token}>
                    {tokenInfos[token]?.symbol || token.slice(0, 6) + "..."}
                  </SelectItem>
                ))}
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
                {supportedCollateral.map((token) => (
                  <SelectItem key={token} value={token}>
                    {tokenInfos[token]?.symbol || token.slice(0, 6) + "..."}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.collateralToken && hasCollateral(form.collateralToken) && (
              <div className="mt-1">
                <div className="flex justify-between items-center">
                  <p className={`text-sm ${needsMoreCollateral ? "text-amber-600" : "text-green-600"}`}>
                    ✓ Deposited:{" "}
                    {formatAmount(
                      userCollaterals[form.collateralToken],
                      tokenInfos[form.collateralToken]?.decimals || 6
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
                      tokenInfos[form.collateralToken]?.decimals || 6
                    )}{" "}
                    {tokenInfos[form.collateralToken]?.symbol}
                  </p>
                )}
                <Button
                  onClick={handleDepositCollateral}
                  disabled={loading || !form.collateralAmount}
                  variant="outline"
                  className="w-full border-yellow-400 text-yellow-700 hover:bg-yellow-100 min-h-[40px] bg-transparent"
                >
                  {loading ? "Depositing..." : "Deposit Collateral"}
                </Button>
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
    </Dialog>
  );
}
