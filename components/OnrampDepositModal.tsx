"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useActiveAccount } from "thirdweb/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Smartphone,
  AlertCircle,
  CheckCircle,
  Loader2,
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
import { theme } from "@/lib/theme";

const BottomSheet = ({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  React.useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-h-[90vh] rounded-t-3xl shadow-2xl transform transition-transform duration-300 ease-out animate-in slide-in-from-bottom"
        style={{
          backgroundImage: `linear-gradient(to bottom right, ${theme.colors.cardGradientFrom}, ${theme.colors.cardGradientTo})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

const ActionButton = ({
  children,
  onClick,
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`rounded-xl font-semibold transition-all flex items-center justify-center gap-2 px-6 py-4 ${className} ${
      disabled ? "cursor-not-allowed opacity-50" : ""
    }`}
    style={{
      backgroundColor: theme.colors.cardButton,
      border: `1px solid ${theme.colors.cardButtonBorder}`,
      color: theme.colors.cardText,
    }}
  >
    {children}
  </button>
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

  const [form, setForm] = useState({
    phoneNumber: "",
    amount: "",
    mobileNetwork: "",
    countryCode: "KES",
  });

  const [validation, setValidation] = useState({
    isValidating: false,
    isValid: false,
    error: "",
  });

  const [transaction, setTransaction] = useState({
    isProcessing: false,
    transactionCode: "",
    error: "",
  });

  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "completed" | "failed">("pending");
  const [completedTransaction, setCompletedTransaction] = useState<any>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm({ phoneNumber: "", amount: "", mobileNetwork: "", countryCode: "KES" });
      setValidation({ isValidating: false, isValid: false, error: "" });
      setTransaction({ isProcessing: false, transactionCode: "", error: "" });
      setPaymentStatus("pending");
      setFailureReason(null);
      loadExchangeRate("KES");
    }
  }, [isOpen]);

  useEffect(() => {
    if (transaction.transactionCode && paymentStatus === "pending") {
      const pollInterval = setInterval(async () => {
        try {
          const status = await onrampService.getTransactionStatus(transaction.transactionCode, form.countryCode);
          if (status?.status === "COMPLETE" || status?.status === "SUCCESS") {
            setCompletedTransaction(status);
            setPaymentStatus("completed");
            clearInterval(pollInterval);
          } else if (status?.status === "FAILED" || status?.status === "CANCELLED") {
            setFailureReason(mapPretiumError(status?.message || "Transaction failed"));
            setPaymentStatus("failed");
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error("Failed to check transaction status:", error);
        }
      }, 5000);
      return () => clearInterval(pollInterval);
    }
  }, [transaction.transactionCode, paymentStatus, form.countryCode]);

  useEffect(() => {
    if (form.phoneNumber) {
      const detectedCountry = detectCountryFromPhone(form.phoneNumber);
      if (detectedCountry !== form.countryCode) {
        setForm((prev) => ({ ...prev, countryCode: detectedCountry }));
        loadExchangeRate(detectedCountry);
      }
    }
  }, [form.phoneNumber]);

  const loadExchangeRate = async (currencyCode: string) => {
    try {
      const result = await onrampService.getExchangeRate(currencyCode);
      if (result.success && result.rate) {
        setExchangeRate(result.rate);
      }
    } catch (error) {
      console.error("Failed to load exchange rate:", error);
    }
  };

  const validatePhoneNumber = async () => {
    if (!form.phoneNumber || !form.mobileNetwork) return;
    setValidation((prev) => ({ ...prev, isValidating: true, error: "" }));
    try {
      const formattedPhone = formatPhoneNumber(form.phoneNumber, form.countryCode);
      const result = await onrampService.validatePaymentMethod(
        { type: "MOBILE", shortcode: formattedPhone, mobile_network: form.mobileNetwork },
        form.countryCode
      );
      setValidation({
        isValidating: false,
        isValid: result.success,
        error: result.success ? "" : result.error || "Invalid phone number",
      });
    } catch (error: any) {
      setValidation({ isValidating: false, isValid: false, error: error.message || "Validation failed" });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (form.phoneNumber && form.mobileNetwork) {
        validatePhoneNumber();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [form.phoneNumber, form.mobileNetwork, form.countryCode]);

  const handleDeposit = async () => {
    if (!address) {
      setTransaction((prev) => ({ ...prev, error: "Please connect your wallet first." }));
      return;
    }
    setTransaction((prev) => ({ ...prev, isProcessing: true, error: "" }));
    try {
      const formattedPhone = formatPhoneNumber(form.phoneNumber, form.countryCode);
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
        setTransaction({ isProcessing: false, transactionCode: result.transaction_code || "", error: "" });
      } else {
        setTransaction((prev) => ({ ...prev, isProcessing: false, error: result.error || "Failed to initiate deposit." }));
      }
    } catch (error: any) {
      setTransaction((prev) => ({ ...prev, isProcessing: false, error: error.message || "An error occurred." }));
    }
  };

  const handleClose = () => {
    if (onSuccess && paymentStatus === "completed" && completedTransaction) {
      onSuccess(transaction.transactionCode, completedTransaction.amount_in_usd || 0);
    }
    onClose();
  };

  const selectedCountry = SUPPORTED_COUNTRIES[form.countryCode as keyof typeof SUPPORTED_COUNTRIES];
  const availableNetworks = selectedCountry?.networks || [];
  const isFormValid = validation.isValid && form.amount && Number.parseFloat(form.amount) > 0;

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose}>
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: theme.colors.cardButtonBorder }}>
        <h2 className="text-lg font-semibold flex-1 text-center" style={{ color: theme.colors.cardText }}>
          Deposit {assetSymbol}
        </h2>
        <button onClick={handleClose} className="p-2" style={{ color: theme.colors.cardTextSecondary }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 60px)' }}>
        {transaction.error && (
          <div className="backdrop-blur-sm p-3 rounded-xl text-sm flex items-start gap-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)', color: theme.colors.cardText }}>
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{transaction.error}</span>
          </div>
        )}

        {!transaction.transactionCode ? (
          <div className="space-y-4">
            <Select value={form.mobileNetwork} onValueChange={(value) => setForm((prev) => ({ ...prev, mobileNetwork: value }))}>
              <SelectTrigger className="h-12 backdrop-blur-sm rounded-xl" style={{ backgroundColor: theme.colors.cardButton, border: `1px solid ${theme.colors.cardButtonBorder}`, color: theme.colors.cardText }}>
                <SelectValue placeholder="Select Network" />
              </SelectTrigger>
              <SelectContent>
                {availableNetworks.map((network) => (
                  <SelectItem key={network} value={network}>{network}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Input
                type="tel"
                placeholder="Phone Number"
                value={form.phoneNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                className="h-12 backdrop-blur-sm rounded-xl"
                style={{ backgroundColor: theme.colors.cardButton, border: `1px solid ${theme.colors.cardButtonBorder}`, color: theme.colors.cardText }}
              />
              {validation.isValidating && <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin" style={{ color: theme.colors.cardTextSecondary }} />}
            </div>
            {validation.error && <p className="text-sm" style={{ color: theme.colors.cardText }}>{validation.error}</p>}

            <Input
              type="number"
              placeholder="Amount (KES)"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              className="h-12 backdrop-blur-sm rounded-xl text-center text-xl"
              style={{ backgroundColor: theme.colors.cardButton, border: `1px solid ${theme.colors.cardButtonBorder}`, color: theme.colors.cardText }}
            />

            {exchangeRate && form.amount && (
              <div className="text-center" style={{ color: theme.colors.cardTextSecondary }}>
                ≈ {(Number.parseFloat(form.amount) / exchangeRate).toFixed(4)} {assetSymbol}
              </div>
            )}

            <ActionButton onClick={handleDeposit} disabled={!isFormValid || transaction.isProcessing} className="w-full">
              {transaction.isProcessing ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
              ) : (
                <><Smartphone className="w-4 h-4" />Send Payment Request</>
              )}
            </ActionButton>
          </div>
        ) : (
          <div className="text-center space-y-4 py-8">
            {paymentStatus === "pending" && (
              <>
                <Loader2 className="w-12 h-12 animate-spin mx-auto" style={{ color: theme.colors.cardText }} />
                <h3 className="text-lg font-medium" style={{ color: theme.colors.cardText }}>Waiting for payment</h3>
                <p className="text-sm" style={{ color: theme.colors.cardTextSecondary }}>Complete the payment on your phone</p>
              </>
            )}
            {paymentStatus === "completed" && (
              <>
                <CheckCircle className="w-12 h-12 mx-auto" style={{ color: theme.colors.cardText }} />
                <h3 className="text-lg font-medium" style={{ color: theme.colors.cardText }}>Payment Successful!</h3>
                <p className="text-sm" style={{ color: theme.colors.cardTextSecondary }}>
                  {completedTransaction?.amount_in_usd} {assetSymbol} sent to your wallet
                </p>
                <ActionButton onClick={handleClose} className="w-full">Done</ActionButton>
              </>
            )}
            {paymentStatus === "failed" && (
              <>
                <AlertCircle className="w-12 h-12 mx-auto" style={{ color: theme.colors.cardText }} />
                <h3 className="text-lg font-medium" style={{ color: theme.colors.cardText }}>Payment Failed</h3>
                <p className="text-sm" style={{ color: theme.colors.cardTextSecondary }}>{failureReason || "Please try again"}</p>
                <ActionButton onClick={handleClose} className="w-full">Close</ActionButton>
              </>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
