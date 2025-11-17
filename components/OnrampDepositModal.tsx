"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveAccount } from "thirdweb/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Smartphone,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
  X,
} from "lucide-react";
import {
  onrampService,
  SUPPORTED_COUNTRIES,
  formatPhoneNumber,
  detectCountryFromPhone,
  type OnrampRequest,
} from "@/lib/services/onrampService";
import { useChain } from "@/components/ChainProvider";
import { mapPretiumError } from "@/lib/utils/errorMapping";

// BottomSheet Component (consistent with our new design)
const BottomSheet = ({
  isOpen,
  onClose,
  children,
  maxHeight = "max-h-[95vh]",
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string;
}) => {
  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      // Store the current scroll position
      const scrollY = window.scrollY;

      // Prevent scrolling on body
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      // Restore scroll position when modal closes
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className={`relative w-full ${maxHeight} bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-t-3xl shadow-2xl transform transition-transform duration-300 ease-out animate-in slide-in-from-bottom`}
      >
        {children}
      </div>
    </div>
  );
};

// Modal Header Component (consistent with our new design)
const ModalHeader = ({
  title,
  onClose,
  showBack = false,
  onBack,
}: {
  title: string;
  onClose: () => void;
  showBack?: boolean;
  onBack?: () => void;
}) => (
  <div className="flex items-center justify-between p-4 border-b border-gray-800">
    {showBack ? (
      <button
        onClick={onBack}
        className="p-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
    ) : (
      <div className="w-9" />
    )}

    <h2 className="text-lg font-semibold text-white text-center">{title}</h2>

    <button
      onClick={onClose}
      className="p-2 text-gray-400 hover:text-white transition-colors"
    >
      <X className="w-5 h-5" />
    </button>
  </div>
);

// Step Indicator Component (consistent with our new design)
const StepIndicator = ({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) => (
  <div className="flex justify-center gap-2 py-4">
    {Array.from({ length: totalSteps }, (_, i) => (
      <div
        key={i}
        className={`w-2 h-2 rounded-full transition-colors ${
          i + 1 <= currentStep ? "bg-cyan-400" : "bg-gray-600"
        }`}
      />
    ))}
  </div>
);

// Action Button Component (consistent with our new design)
const ActionButton = ({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  size = "default",
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  size?: "default" | "lg";
  className?: string;
}) => {
  const baseClasses =
    "rounded-xl font-semibold transition-colors flex items-center justify-center gap-2";
  const sizeClasses = {
    default: "px-4 py-3 text-sm",
    lg: "px-6 py-4 text-base",
  };
  const variantClasses = {
    primary:
      "bg-cyan-400 text-black hover:bg-cyan-300 disabled:bg-gray-600 disabled:text-gray-400",
    secondary:
      "bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 text-white hover:bg-gray-700/30 disabled:bg-gray-600/20 disabled:text-gray-400",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className} ${
        disabled ? "cursor-not-allowed" : ""
      }`}
    >
      {children}
    </button>
  );
};

// Info Card Component (consistent with our new design)
const InfoCard = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-xl p-4 ${className}`}
  >
    {children}
  </div>
);

interface OnrampDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset: string;
  assetSymbol: string;
  onSuccess?: (transactionCode: string, amount: number) => void;
}

export function OnrampDepositModal({
  isOpen,
  onClose,
  selectedAsset,
  assetSymbol,
  onSuccess,
}: OnrampDepositModalProps) {
  const account = useActiveAccount();
  const address = account?.address;
  const { chain } = useChain();

  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    phoneNumber: "",
    amount: "",
    mobileNetwork: "",
    countryCode: "KES",
  });

  const [validation, setValidation] = useState({
    isValidating: false,
    isValid: false,
    accountName: "",
    error: "",
  });

  const [transaction, setTransaction] = useState({
    isProcessing: false,
    isComplete: false,
    transactionCode: "",
    error: "",
  });

  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "pending" | "completed" | "failed"
  >("pending");
  const [completedTransaction, setCompletedTransaction] = useState<any>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setForm({
        phoneNumber: "",
        amount: "",
        mobileNetwork: "",
        countryCode: "KES",
      });
      setValidation({
        isValidating: false,
        isValid: false,
        accountName: "",
        error: "",
      });
      setTransaction({
        isProcessing: false,
        isComplete: false,
        transactionCode: "",
        error: "",
      });
      setPaymentStatus("pending");
      setFailureReason(null);
      loadExchangeRate("KES");
    }
  }, [isOpen]);

  // Poll transaction status
  useEffect(() => {
    if (
      currentStep === 4 &&
      transaction.transactionCode &&
      paymentStatus === "pending"
    ) {
      const pollInterval = setInterval(async () => {
        try {
          const status = await onrampService.getTransactionStatus(
            transaction.transactionCode,
            form.countryCode
          );

          if (status?.status === "COMPLETE" || status?.status === "SUCCESS") {
            setCompletedTransaction(status);
            setPaymentStatus("completed");
            clearInterval(pollInterval);
          } else if (
            status?.status === "FAILED" ||
            status?.status === "CANCELLED"
          ) {
            const friendlyMessage = mapPretiumError(
              status?.message || "Transaction was cancelled or failed"
            );
            setFailureReason(friendlyMessage);
            setPaymentStatus("failed");
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error("Failed to check transaction status:", error);
        }
      }, 5000);

      return () => clearInterval(pollInterval);
    }
  }, [
    currentStep,
    transaction.transactionCode,
    paymentStatus,
    form.countryCode,
  ]);

  // Auto-detect country when phone number changes
  useEffect(() => {
    if (form.phoneNumber) {
      const detectedCountry = detectCountryFromPhone(form.phoneNumber);
      if (detectedCountry !== form.countryCode) {
        setForm((prev) => ({ ...prev, countryCode: detectedCountry }));
        loadExchangeRate(detectedCountry);
      }
    }
  }, [form.phoneNumber]);

  // Load exchange rate for selected country
  const loadExchangeRate = async (currencyCode: string) => {
    setLoadingRate(true);
    try {
      const result = await onrampService.getExchangeRate(currencyCode);
      if (result.success && result.rate) {
        setExchangeRate(result.rate);
      }
    } catch (error) {
      console.error("Failed to load exchange rate:", error);
    } finally {
      setLoadingRate(false);
    }
  };

  // Validate phone number
  const validatePhoneNumber = async () => {
    if (!form.phoneNumber || !form.mobileNetwork) return;

    setValidation((prev) => ({ ...prev, isValidating: true, error: "" }));

    try {
      const formattedPhone = formatPhoneNumber(
        form.phoneNumber,
        form.countryCode
      );
      const result = await onrampService.validatePaymentMethod(
        {
          type: "MOBILE",
          shortcode: formattedPhone,
          mobile_network: form.mobileNetwork,
        },
        form.countryCode
      );

      if (result.success) {
        setValidation({
          isValidating: false,
          isValid: true,
          accountName: result.name || "",
          error: "",
        });
      } else {
        setValidation({
          isValidating: false,
          isValid: false,
          accountName: "",
          error: result.error || "Phone number validation failed",
        });
      }
    } catch (error: any) {
      setValidation({
        isValidating: false,
        isValid: false,
        accountName: "",
        error: error.message || "Validation failed",
      });
    }
  };

  // Trigger validation when phone number or network changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (form.phoneNumber && form.mobileNetwork) {
        validatePhoneNumber();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [form.phoneNumber, form.mobileNetwork, form.countryCode]);

  const handleOnrampDeposit = async () => {
    if (!address) {
      setTransaction((prev) => ({
        ...prev,
        error: "Please connect your wallet first.",
      }));
      return;
    }

    setTransaction((prev) => ({ ...prev, isProcessing: true, error: "" }));

    try {
      const formattedPhone = formatPhoneNumber(
        form.phoneNumber,
        form.countryCode
      );
      const onrampRequest: OnrampRequest = {
        shortcode: formattedPhone,
        amount: Number.parseFloat(form.amount),
        mobile_network: form.mobileNetwork,
        chain: chain?.name || "celo",
        asset: selectedAsset,
        address: address,
      };

      const result = await onrampService.initiateOnramp(onrampRequest);

      if (result.success && result.transaction_code) {
        setTransaction((prev) => ({
          ...prev,
          isProcessing: false,
          isComplete: true,
          transactionCode: result.transaction_code || "",
        }));
        setCurrentStep(4);
      } else {
        setTransaction((prev) => ({
          ...prev,
          isProcessing: false,
          error:
            result.error || "Failed to initiate deposit. Please try again.",
        }));
      }
    } catch (error: any) {
      setTransaction((prev) => ({
        ...prev,
        isProcessing: false,
        error:
          error.message || "An unexpected error occurred. Please try again.",
      }));
    }
  };

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    if (onSuccess && paymentStatus === "completed" && completedTransaction) {
      onSuccess(
        transaction.transactionCode,
        completedTransaction.amount_in_usd || 0
      );
    }
    onClose();
  };

  const selectedCountry =
    SUPPORTED_COUNTRIES[form.countryCode as keyof typeof SUPPORTED_COUNTRIES];
  const availableNetworks = selectedCountry?.networks || [];

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} maxHeight="max-h-[90vh]">
      <ModalHeader
        title={`Deposit ${assetSymbol} via Mobile Money`}
        onClose={handleClose}
        showBack={currentStep > 1 && !transaction.isComplete}
        onBack={prevStep}
      />

      <div className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-xl p-4 space-y-6">
        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} totalSteps={4} />

        {/* Error Display */}
        {transaction.error && (
          <div className="bg-red-900/20 border border-red-700 text-red-300 p-3 rounded-xl text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{transaction.error}</span>
          </div>
        )}

        <div className="min-h-[300px]">
          {/* Step 1: Country & Network Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-white text-lg font-medium mb-2">
                  Select country & network
                </h3>
                <p className="text-gray-400 text-sm">
                  Choose your mobile money provider
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-gray-400 text-sm font-medium mb-2 block">
                    Country
                  </Label>
                  <Select
                    value={form.countryCode}
                    onValueChange={(value) => {
                      setForm((prev) => ({
                        ...prev,
                        countryCode: value,
                        mobileNetwork: "",
                      }));
                      loadExchangeRate(value);
                    }}
                  >
                    <SelectTrigger className="h-12 bg-gray-800/20 backdrop-blur-sm border border-gray-600/30 text-white focus:border-cyan-400 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800/20 backdrop-blur-sm border border-gray-600/30">
                      {Object.entries(SUPPORTED_COUNTRIES).map(
                        ([code, country]) => (
                          <SelectItem
                            key={code}
                            value={code}
                            className="text-white hover:bg-gray-700/30"
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-lg">{country.flag}</span>
                              <span>{code}</span>
                            </span>
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-400 text-sm font-medium mb-2 block">
                    Mobile Network
                  </Label>
                  <Select
                    value={form.mobileNetwork}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, mobileNetwork: value }))
                    }
                  >
                    <SelectTrigger className="h-12 bg-gray-800/20 backdrop-blur-sm border border-gray-600/30 text-white focus:border-cyan-400 rounded-xl">
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800/20 backdrop-blur-sm border border-gray-600/30">
                      {availableNetworks.map((network) => (
                        <SelectItem
                          key={network}
                          value={network}
                          className="text-white hover:bg-gray-700/30"
                        >
                          {network}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ActionButton
                onClick={nextStep}
                disabled={!form.countryCode || !form.mobileNetwork}
                variant="primary"
                size="lg"
                className="w-full"
              >
                Continue
              </ActionButton>
            </div>
          )}

          {/* Step 2: Phone Number Entry */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-white text-lg font-medium mb-2">
                  Enter phone number
                </h3>
                <p className="text-gray-400 text-sm">
                  We'll verify your {form.mobileNetwork} account
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-gray-400 text-sm font-medium mb-2 block">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <Input
                      type="tel"
                      placeholder="0712345678"
                      value={form.phoneNumber}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          phoneNumber: e.target.value,
                        }))
                      }
                      className="h-12 bg-gray-800/20 backdrop-blur-sm border border-gray-600/30 text-white focus:border-cyan-400 pr-10 rounded-xl"
                    />
                    {validation.isValidating && (
                      <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                    )}
                  </div>

                  {validation.error && (
                    <p className="text-red-400 text-sm mt-1">
                      {validation.error}
                    </p>
                  )}

                  {validation.isValid && validation.accountName && (
                    <div className="mt-2 p-3 bg-green-900/20 backdrop-blur-sm border border-green-700/30 rounded-xl">
                      <p className="text-green-400 text-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {validation.accountName}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <ActionButton
                onClick={nextStep}
                disabled={!validation.isValid}
                variant="primary"
                size="lg"
                className="w-full"
              >
                Continue
              </ActionButton>
            </div>
          )}

          {/* Step 3: Amount Entry */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-white text-lg font-medium mb-2">
                  Enter amount
                </h3>
                <p className="text-gray-400 text-sm">
                  How much {assetSymbol} would you like to buy?
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-gray-400 text-sm font-medium mb-2 block">
                    Amount in {form.countryCode}
                  </Label>
                  <Input
                    type="number"
                    placeholder="1000"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    className="h-12 bg-gray-800/20 backdrop-blur-sm border border-gray-600/30 text-white focus:border-cyan-400 text-center text-xl rounded-xl"
                  />

                  {exchangeRate && form.amount && (
                    <div className="mt-2 p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-xl">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-400">You'll receive:</span>
                        <span className="text-cyan-400 font-medium">
                          ~
                          {(
                            Number.parseFloat(form.amount) / exchangeRate
                          ).toFixed(4)}{" "}
                          {assetSymbol}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                        <span>Exchange rate:</span>
                        <span>
                          1 {assetSymbol} = {exchangeRate} {form.countryCode}
                        </span>
                      </div>
                    </div>
                  )}

                  {loadingRate && (
                    <div className="mt-2 text-center">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto" />
                      <p className="text-gray-400 text-xs mt-1">
                        Loading exchange rate...
                      </p>
                    </div>
                  )}
                </div>

                {/* Limits Info */}
                <InfoCard>
                  <div className="text-center">
                    <Info className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">
                      Min:{" "}
                      {onrampService.getCountryLimits(form.countryCode).min}{" "}
                      {form.countryCode}
                      {" • "}
                      Max:{" "}
                      {
                        onrampService.getCountryLimits(form.countryCode).max
                      }{" "}
                      {form.countryCode}
                    </p>
                  </div>
                </InfoCard>
              </div>

              <ActionButton
                onClick={handleOnrampDeposit}
                disabled={
                  transaction.isProcessing ||
                  !validation.isValid ||
                  !form.amount ||
                  Number.parseFloat(form.amount) <= 0 ||
                  Number.parseFloat(form.amount) <
                    onrampService.getCountryLimits(form.countryCode).min
                }
                variant="primary"
                size="lg"
                className="w-full"
              >
                {transaction.isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    Send STK Push
                  </>
                )}
              </ActionButton>
            </div>
          )}

          {/* Step 4: Payment Status */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {paymentStatus === "pending" && (
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 bg-cyan-400/20 rounded-full flex items-center justify-center mx-auto">
                    <Smartphone className="w-8 h-8 text-cyan-400" />
                  </div>

                  <div>
                    <h3 className="text-white text-lg font-medium mb-2">
                      Check your phone
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Complete the M-Pesa payment on your phone to receive{" "}
                      {assetSymbol} in your wallet.
                    </p>

                    <InfoCard className="bg-yellow-900/20 border-yellow-700">
                      <div className="flex items-center justify-center gap-2 text-yellow-300">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="font-medium">
                          Waiting for payment...
                        </span>
                      </div>
                      <p className="text-yellow-200 text-xs text-center mt-2">
                        Once completed, your {assetSymbol} will be sent to your
                        wallet automatically.
                      </p>
                    </InfoCard>
                  </div>
                </div>
              )}

              {paymentStatus === "completed" && (
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>

                  <div>
                    <h3 className="text-white text-lg font-medium mb-2">
                      Payment Successful!
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Your {assetSymbol} has been sent to your wallet.
                    </p>

                    <InfoCard>
                      <div className="space-y-3">
                        {completedTransaction?.receipt_number && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">
                              M-Pesa Receipt:
                            </span>
                            <span className="font-mono text-sm font-medium text-white">
                              {completedTransaction.receipt_number}
                            </span>
                          </div>
                        )}
                        {completedTransaction?.amount && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">
                              Amount Paid:
                            </span>
                            <span className="font-medium text-white">
                              {completedTransaction.amount}{" "}
                              {completedTransaction.currency_code}
                            </span>
                          </div>
                        )}
                        {completedTransaction?.amount_in_usd && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">
                              Received:
                            </span>
                            <span className="font-medium text-cyan-400">
                              {completedTransaction.amount_in_usd} {assetSymbol}
                            </span>
                          </div>
                        )}
                      </div>
                    </InfoCard>

                    <InfoCard className="bg-green-900/20 border-green-700">
                      <p className="text-green-400 font-medium text-center">
                        ✓ Transaction Complete
                      </p>
                    </InfoCard>
                  </div>
                </div>
              )}

              {paymentStatus === "failed" && (
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>

                  <div>
                    <h3 className="text-white text-lg font-medium mb-2">
                      Payment Failed
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      {failureReason ||
                        "The payment was not completed. Please try again."}
                    </p>

                    <InfoCard className="bg-red-900/20 border-red-700">
                      <p className="text-red-400 font-medium text-center">
                        ✗ Transaction Failed
                      </p>
                    </InfoCard>
                  </div>
                </div>
              )}

              <ActionButton
                onClick={handleClose}
                variant="primary"
                size="lg"
                className="w-full"
              >
                {paymentStatus === "completed" ? "Done" : "Close"}
              </ActionButton>
            </div>
          )}
        </div>

        {/* Bottom spacing for mobile */}
        <div className="h-4"></div>
      </div>
    </BottomSheet>
  );
}
