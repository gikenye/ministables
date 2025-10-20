"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ArrowLeft, Plus } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import {
  useActiveAccount,
  TransactionButton,
  useWalletBalance,
} from "thirdweb/react";
import { OnrampDepositModal } from "./OnrampDepositModal";
import { onrampService } from "@/lib/services/onrampService";
import {
  generateDivviReferralTag,
  reportTransactionToDivvi,
} from "@/lib/services/divviService";

import { oracleService } from "@/lib/services/oracleService";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  waitForReceipt,
} from "thirdweb";
import { parseUnits } from "viem";
import { client } from "@/lib/thirdweb/client";
import { useChain } from "@/components/ChainProvider";
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
  loading: boolean;
  userBalances?: Record<string, string>;
  requiresAuth?: boolean;
}

export function PayBackModal({
  isOpen,
  onClose,
  onPayBack,
  loading,
  userBalances = {},
  requiresAuth = false,
}: PayBackModalProps) {
  const account = useActiveAccount();
  const address = account?.address;
  const { chain, contract, contractAddress, tokens, tokenInfos } = useChain();
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [showOnrampModal, setShowOnrampModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [remainingBalance, setRemainingBalance] = useState<string | null>(null);

  const [form, setForm] = useState({
    token: "",
    amount: "",
  });

  // Get supported tokens from props - filtered to only cKES
  const supportedStablecoins = useMemo(() => {
    return Object.keys(tokenInfos).filter((tokenAddress) => {
      const tokenInfo = tokenInfos[tokenAddress];
      return tokenInfo?.symbol === "cKES";
    });
  }, [tokenInfos]);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setForm({ token: "", amount: "" });
      setSelectedLoan(null);
      setPaymentSuccess(false);
      setRemainingBalance(null);
    }
  }, [isOpen]);

  // Reset modal state when the chain changes so tokens/loans from the old
  // chain are not shown or used accidentally.
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setForm({ token: "", amount: "" });
      setSelectedLoan(null);
      setPaymentSuccess(false);
      setRemainingBalance(null);
      setShowOnrampModal(false);
    }
  }, [chain?.id]);

  // Auto-close after 5 seconds on success
  useEffect(() => {
    if (paymentSuccess) {
      const timer = setTimeout(() => {
        onClose();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [paymentSuccess, onClose]);

  const handleLoanSelect = (loan: ActiveLoan) => {
    setSelectedLoan(loan);
    setForm({
      token: loan.token,
      amount: formatAmount(loan.totalOwed, loan.decimals),
    });
    setCurrentStep(2);
  };

  // Balances for auto-wrap support when paying back with CELO
  const { data: repayTokenBalance } = useWalletBalance({
    client,
    chain,
    address,
    tokenAddress: form.token || undefined,
  });
  const { data: nativeBalanceData } = useWalletBalance({
    client,
    chain,
    address,
  });

  const handleRepayment = async () => {
    if (!form.token || !form.amount) {
      throw new Error("Missing required parameters");
    }

    if (requiresAuth) {
      alert("Please sign in to complete this transaction");
      return;
    }

    if (!account) {
      throw new Error("Missing required parameters");
    }

    try {
      // Auto-wrap CELO if needed before repay
      const CELO_ERC20 = tokens.find(
        (t) => t.symbol.toUpperCase() === "CELO"
      )?.address;
      const erc20Balance = Number.parseFloat(
        repayTokenBalance?.displayValue || "0"
      );
      const nativeBalance = Number.parseFloat(
        nativeBalanceData?.displayValue || "0"
      );
      const inputAmount = Number.parseFloat(form.amount);

      if (
        CELO_ERC20 &&
        form.token === CELO_ERC20 &&
        erc20Balance < inputAmount &&
        nativeBalance >= inputAmount - erc20Balance
      ) {
        const amountToWrap = inputAmount - erc20Balance;
        const celoContract = getContract({
          client,
          chain,
          address: CELO_ERC20,
        });
        const wrapTx = prepareContractCall({
          contract: celoContract,
          method: "function deposit()",
          params: [],
          value: parseUnits(amountToWrap.toString(), 18),
        });

        const wrapResult = await sendTransaction({
          transaction: wrapTx,
          account,
        });
        if (wrapResult?.transactionHash) {
          await waitForReceipt({
            client,
            chain,
            transactionHash: wrapResult.transactionHash,
          });
        }
      }

      // Prepare and execute the repayment transaction
      const decimals = tokenInfos[form.token]?.decimals || 18;
      const amountWei = parseUnits(form.amount, decimals);

      // First approve the Minilend contract to spend tokens
      const erc20Contract = getContract({ client, chain, address: form.token });

      const approveTx = prepareContractCall({
        contract: erc20Contract,
        method: "function approve(address spender, uint256 amount)",
        params: [contractAddress, amountWei],
      });

      const approveResult = await sendTransaction({
        account,
        transaction: approveTx,
      });
      if (approveResult?.transactionHash) {
        await waitForReceipt({
          client,
          chain,
          transactionHash: approveResult.transactionHash,
        });
      }

      // Now execute the repay transaction
      const repayTx = prepareContractCall({
        contract,
        method: "function repay(address token, uint256 amount)",
        params: [form.token, amountWei],
      });

      // We'll report to Divvi after transaction is complete
      // The tag will be added by Divvi's backend when processing the transaction

      const result = await sendTransaction({ account, transaction: repayTx });

      if (result?.transactionHash) {
        await waitForReceipt({
          client,
          chain,
          transactionHash: result.transactionHash,
        });
        handleTransactionSuccess(result);
      }
    } catch (error) {
      handleTransactionError(error);
      throw error;
    }
  };

  const handleTransactionSuccess = async (receipt: any) => {
    // Calculate remaining balance
    if (selectedLoan) {
      const remaining =
        Number(formatAmount(selectedLoan.totalOwed, selectedLoan.decimals)) -
        Number(form.amount);
      setRemainingBalance(remaining.toFixed(4));
    }
    setPaymentSuccess(true);
    setCurrentStep(4);

    // Report transaction to Divvi for referral tracking
    if (receipt.transactionHash) {
      await reportTransactionToDivvi(receipt.transactionHash, chain?.id);
      console.log(
        "[PayBackModal] Reported transaction to Divvi:",
        receipt.transactionHash
      );
    }
  };

  const handleTransactionError = (error: any) => {
    console.error("Payment error:", error);
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const hasZeroBalance = () => {
    if (!form.token) return false;
    const balance = Number.parseFloat(repayTokenBalance?.displayValue || "0");
    return balance === 0;
  };

  const isAssetSupportedForOnramp = (tokenAddress: string) => {
    try {
      const tokenSymbol = tokenInfos[tokenAddress]?.symbol;
      if (!tokenSymbol) return false;

      const chainName = chain.name;
      return onrampService.isAssetSupportedForOnramp(tokenSymbol, chainName);
    } catch (error) {
      console.error("Error checking onramp support:", error);
      return false;
    }
  };

  const handleOnrampSuccess = (transactionCode: string, amount: number) => {
    setShowOnrampModal(false);
    setCurrentStep(2);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-md mx-auto bg-background border-0 shadow-lg p-0 overflow-hidden [&>button]:text-foreground [&>button]:hover:text-muted-foreground">
          <div className="flex h-5 w-full items-center justify-center bg-background">
            <div className="h-1 w-9 rounded-full bg-muted"></div>
          </div>

          <div className="px-4 pb-5">
            <div className="flex items-center justify-between pt-5 pb-3">
              {currentStep > 1 && (
                <button
                  onClick={prevStep}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="flex-1 text-center">
                <h1 className="text-foreground text-[22px] font-bold leading-tight tracking-[-0.015em]">
                  Pay Back Loan
                </h1>
                <div className="flex justify-center gap-1 mt-2">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        step <= currentStep ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
              {currentStep > 1 && <div className="w-7" />}
            </div>

            {!account && (
              <div className="bg-warning/20 border border-warning text-foreground p-3 rounded-xl text-sm mb-4">
                Connect wallet to continue
              </div>
            )}

            <div className="min-h-[300px]">
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-foreground text-lg font-medium mb-2">
                      Select loan to pay
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Choose which loan you'd like to pay back
                    </p>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto">
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
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-foreground text-lg font-medium mb-2">
                      How much to pay?
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Balance:{" "}
                      {Number.parseFloat(
                        repayTokenBalance?.displayValue || "0"
                      ).toFixed(4)}{" "}
                      {tokenInfos[form.token]?.symbol}
                    </p>
                  </div>

                  {hasZeroBalance() &&
                    isAssetSupportedForOnramp(form.token) && (
                      <div className="bg-card/80 border border-border rounded-xl p-3 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-muted-foreground text-sm">
                            No {tokenInfos[form.token]?.symbol} balance
                          </div>
                          <div className="text-primary text-xs">
                            Get tokens first
                          </div>
                        </div>
                        <button
                          onClick={() => setShowOnrampModal(true)}
                          className="w-full h-10 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          Get {tokenInfos[form.token]?.symbol}
                        </button>
                      </div>
                    )}

                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^\d*\.?\d*$/.test(value)) {
                          setForm({ ...form, amount: value });
                        }
                      }}
                      className="w-full h-16 rounded-xl text-foreground bg-card border-2 border-border focus:border-primary focus:outline-0 focus:ring-0 pl-4 pr-20 text-2xl font-medium text-center"
                      autoFocus
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      {tokenInfos[form.token]?.symbol}
                    </div>
                  </div>

                  {selectedLoan && (
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            amount: (
                              Number(
                                formatAmount(
                                  selectedLoan.totalOwed,
                                  selectedLoan.decimals
                                )
                              ) * 0.1
                            ).toFixed(6),
                          })
                        }
                        className="h-10 bg-card text-foreground text-sm rounded-lg hover:bg-card/90 transition-colors"
                      >
                        10%
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            amount: (
                              Number(
                                formatAmount(
                                  selectedLoan.totalOwed,
                                  selectedLoan.decimals
                                )
                              ) * 0.5
                            ).toFixed(6),
                          })
                        }
                        className="h-10 bg-card text-foreground text-sm rounded-lg hover:bg-card/90 transition-colors"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            amount: (
                              Number(
                                formatAmount(
                                  selectedLoan.totalOwed,
                                  selectedLoan.decimals
                                )
                              ) * 0.75
                            ).toFixed(6),
                          })
                        }
                        className="h-10 bg-card text-foreground text-sm rounded-lg hover:bg-card/90 transition-colors"
                      >
                        75%
                      </button>
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
                        className="h-10 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        Full
                      </button>
                    </div>
                  )}

                  <button
                    onClick={nextStep}
                    disabled={!form.amount || Number(form.amount) <= 0}
                    className="w-full h-12 bg-primary text-primary-foreground text-base font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Continue
                  </button>
                </div>
              )}

              {currentStep === 3 && !paymentSuccess && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-foreground text-lg font-medium mb-2">
                      Confirm payment
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Review your loan payment
                    </p>
                  </div>

                  <div className="bg-card rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Paying</span>
                      <div className="text-right">
                        <div className="text-foreground font-medium">
                          {form.amount}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {tokenInfos[form.token]?.symbol}
                        </div>
                      </div>
                    </div>

                    {selectedLoan && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total owed</span>
                        <div className="text-foreground font-medium">
                          {formatAmount(
                            selectedLoan.totalOwed,
                            selectedLoan.decimals
                          )}{" "}
                          {selectedLoan.symbol}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground">After payment</span>
                      <div className="text-right">
                        <div className="text-primary font-bold">
                          {selectedLoan
                            ? (
                                Number(
                                  formatAmount(
                                    selectedLoan.totalOwed,
                                    selectedLoan.decimals
                                  )
                                ) - Number(form.amount)
                              ).toFixed(4)
                            : "0.0000"}{" "}
                          {tokenInfos[form.token]?.symbol}
                        </div>
                        <div className="text-muted-foreground text-sm">remaining</div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleRepayment}
                    disabled={
                      !account ||
                      !form.token ||
                      !form.amount ||
                      Number(form.amount) <= 0
                    }
                    className="w-full h-12 bg-primary text-primary-foreground text-base font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Pay Back Loan
                  </button>
                </div>
              )}

              {currentStep === 4 && paymentSuccess && (
                <div className="space-y-6 text-center">
                  <div className="bg-card rounded-xl p-6 space-y-4">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto">
                      <svg
                        className="w-8 h-8 text-primary-foreground"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <h3 className="text-foreground text-xl font-bold">
                      Payment Successful!
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Thanks for repaying {form.amount}{" "}
                      {tokenInfos[form.token]?.symbol}.
                      {remainingBalance && Number(remainingBalance) > 0
                        ? ` Your outstanding balance is ${remainingBalance} ${tokenInfos[form.token]?.symbol}.`
                        : " Your loan is now fully paid off!"}
                    </p>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    This modal will close automatically in 5 seconds
                  </p>
                  <button
                    onClick={onClose}
                    className="w-full h-12 bg-primary text-primary-foreground text-base font-bold rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showOnrampModal && (
        <OnrampDepositModal
          isOpen={showOnrampModal}
          onClose={() => setShowOnrampModal(false)}
          selectedAsset={selectedLoan?.symbol || ""}
          assetSymbol={selectedLoan?.symbol || ""}
          onSuccess={handleOnrampSuccess}
        />
      )}
    </>
  );
}
