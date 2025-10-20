"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSendTransaction } from "thirdweb/react";
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
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useChain } from "@/components/ChainProvider";
import { VaultPosition } from "@/lib/services/vaultService";

interface FundsWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWithdraw: (tokenSymbol: string, depositIds: number[]) => Promise<void>;
  vaultPositions: VaultPosition[];
  tokenInfos: Record<
    string,
    { symbol: string; decimals: number; icon?: string }
  >;
  loading: boolean;
}

export function FundsWithdrawalModal({
  isOpen,
  onClose,
  onWithdraw,
  vaultPositions,
  tokenInfos,
  loading,
}: FundsWithdrawalModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [selectedDepositIds, setSelectedDepositIds] = useState<number[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSelectedToken("");
      setSelectedDepositIds([]);
      setError(null);
    }
  }, [isOpen]);

  const handleWithdraw = async () => {
    if (!selectedToken || selectedDepositIds.length === 0) return;

    setError(null);
    setIsWithdrawing(true);

    try {
      await onWithdraw(selectedToken, selectedDepositIds);
      setSelectedToken("");
      setSelectedDepositIds([]);
      onClose();
    } catch (err: any) {
      console.error("Withdrawal error:", err);
      setError(err.message || "Transaction failed. Please try again.");
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

  const availablePositions = useMemo(
    () => vaultPositions.filter((pos) => pos.deposits.length > 0),
    [vaultPositions]
  );

  const selectedPosition = useMemo(
    () => vaultPositions.find((pos) => pos.tokenSymbol === selectedToken),
    [vaultPositions, selectedToken]
  );

  const goToNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      setError(null);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const canProceedToStep2 =
    selectedToken &&
    selectedPosition &&
    selectedPosition.deposits.some((d) => d.canWithdraw);
  const canProceedToStep3 = canProceedToStep2 && selectedDepositIds.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-sm mx-auto bg-background border-0 shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            {currentStep > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousStep}
                className="text-muted-foreground hover:text-foreground hover:bg-card p-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="flex-1 text-center">
              <DialogTitle className="text-foreground text-xl font-semibold">
                Cash Out
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                {currentStep === 1 && "Choose what to withdraw"}
                {currentStep === 2 && "Enter withdrawal amount"}
                {currentStep === 3 && "Confirm your withdrawal"}
              </DialogDescription>
            </div>
            <div className="w-8" /> {/* Spacer for centering */}
          </div>

          <div className="flex justify-center space-x-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`w-2 h-2 rounded-full transition-colors ${
                  step <= currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/20 border border-destructive/50 text-destructive p-3 rounded-xl text-sm">
            <div className="flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Step 1: Select Token */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-foreground text-lg font-medium mb-2">
                  Select Asset
                </h3>
                <p className="text-muted-foreground text-sm">
                  Choose which asset you want to withdraw
                </p>
              </div>

              {availablePositions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground text-sm">
                    No funds available to withdraw
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {availablePositions.map((pos) => {
                    const withdrawableCount = pos.deposits.filter(
                      (d) => d.canWithdraw
                    ).length;
                    const totalValue =
                      Number(BigInt(pos.totalCurrentValue)) /
                      Number(BigInt(10 ** pos.decimals));
                    const tokenInfo = tokenInfos[pos.tokenAddress];
                    const iconUrl = tokenInfo?.icon;

                    return (
                      <button
                        key={pos.tokenSymbol}
                        onClick={() => {
                          setSelectedToken(pos.tokenSymbol);
                          if (withdrawableCount > 0) {
                            goToNextStep();
                          }
                        }}
                        className={`w-full p-4 rounded-xl border transition-all ${
                          selectedToken === pos.tokenSymbol
                            ? "border-primary bg-primary/10"
                            : withdrawableCount === 0
                              ? "border-border bg-card/50"
                              : "border-border bg-card hover:border-primary hover:bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {iconUrl ? (
                              <img
                                src={iconUrl}
                                alt={pos.tokenSymbol}
                                className="w-8 h-8 mr-3 rounded-full"
                              />
                            ) : (
                              <span className="text-2xl mr-3">💱</span>
                            )}
                            <div className="text-left">
                              <div className="text-foreground font-medium">
                                {pos.tokenSymbol}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                {withdrawableCount} available
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-foreground font-semibold">
                              {totalValue.toFixed(6)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {pos.deposits.length} deposits
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Deposits */}
          {currentStep === 2 && selectedPosition && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-foreground text-lg font-medium mb-2">
                  Select Deposits
                </h3>
                <p className="text-muted-foreground text-sm">
                  Choose which deposits to withdraw
                </p>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {selectedPosition.deposits.map((deposit, idx) => {
                  const value =
                    Number(BigInt(deposit.currentValue)) /
                    Number(BigInt(10 ** selectedPosition.decimals));
                  const isSelected = selectedDepositIds.includes(idx);

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (!deposit.canWithdraw) return;
                        setSelectedDepositIds((prev) =>
                          prev.includes(idx)
                            ? prev.filter((id) => id !== idx)
                            : [...prev, idx]
                        );
                      }}
                      disabled={!deposit.canWithdraw}
                      className={`w-full p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : !deposit.canWithdraw
                            ? "border-border bg-card/30 opacity-50"
                            : "border-border bg-card hover:border-primary"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <div className="text-foreground text-sm">
                            Deposit #{idx}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {deposit.canWithdraw
                              ? "Available"
                              : `Locked until ${formatDate(deposit.lockEnd)}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-foreground font-semibold">
                            {value.toFixed(6)}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {selectedPosition.tokenSymbol}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={goToPreviousStep}
                  variant="outline"
                  className="flex-1 bg-transparent border-border text-muted-foreground hover:bg-card hover:text-foreground h-12"
                >
                  Back
                </Button>
                <Button
                  onClick={goToNextStep}
                  disabled={!canProceedToStep3}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm Withdrawal */}
          {currentStep === 3 &&
            selectedPosition &&
            selectedDepositIds.length > 0 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-foreground text-lg font-medium mb-2">
                    Confirm Withdrawal
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Review your withdrawal details
                  </p>
                </div>

                <div className="bg-card rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Asset</span>
                    <span className="text-foreground font-medium">
                      {selectedPosition.tokenSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Deposits</span>
                    <span className="text-foreground font-semibold">
                      {selectedDepositIds.length}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        Total Amount
                      </span>
                      <span className="text-primary font-bold text-lg">
                        {selectedDepositIds
                          .reduce((sum, id) => {
                            const deposit = selectedPosition.deposits[id];
                            return (
                              sum +
                              Number(BigInt(deposit.currentValue)) /
                                Number(BigInt(10 ** selectedPosition.decimals))
                            );
                          }, 0)
                          .toFixed(6)}{" "}
                        {selectedPosition.tokenSymbol}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={goToPreviousStep}
                    variant="outline"
                    className="flex-1 bg-transparent border-border text-muted-foreground hover:bg-card hover:text-foreground h-12"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleWithdraw}
                    disabled={loading || isWithdrawing || isTransactionPending}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12"
                  >
                    {loading || isWithdrawing || isTransactionPending
                      ? "Processing..."
                      : "Confirm Withdrawal"}
                  </Button>
                </div>
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
