"use client";

import React, { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  Smartphone,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Info,
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
import { BottomSheet, ActionButton } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";

interface OnrampDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset: string;
  assetSymbol: string;
  targetGoalId?: string;
  onSuccess?: (transactionCode: string, amount: number) => void;
}

export function OnrampDepositModal({
  isOpen,
  onClose,
  selectedAsset,
  assetSymbol,
  targetGoalId,
  onSuccess,
}: OnrampDepositModalProps) {
  const account = useActiveAccount();
  const { chain } = useChain();
  const MIN_KES_AMOUNT = 100;

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
  const [shakeAmount, setShakeAmount] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "pending" | "completed" | "failed"
  >("idle");

  useEffect(() => {
    if (isOpen) {
      setForm({
        phoneNumber: "",
        amount: "",
        mobileNetwork: "",
        countryCode: "KES",
      });
      setValidation({ isValidating: false, isValid: false, error: "" });
      setTransaction({ isProcessing: false, transactionCode: "", error: "" });
      setPaymentStatus("idle");
      loadExchangeRate("KES");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!transaction.transactionCode || paymentStatus !== "pending") return;

    const maxAttempts = 20;
    const maxElapsedMs = 60_000;
    const startTime = Date.now();
    let attempts = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    let isActive = true;

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const pollStatus = async () => {
      try {
        attempts += 1;
        const elapsed = Date.now() - startTime;
        if (attempts > maxAttempts || elapsed > maxElapsedMs) {
          stopPolling();
          if (isActive) {
            setPaymentStatus("failed");
            setTransaction((prev) => ({
              ...prev,
              error: "Status check timed out. Please try again.",
            }));
          }
          return;
        }

        const status = await onrampService.getTransactionStatus(
          transaction.transactionCode,
          form.countryCode
        );

        const normalizedStatus = status.status?.toUpperCase?.() || "";

        if (
          normalizedStatus === "SUCCESS" ||
          normalizedStatus === "COMPLETED" ||
          normalizedStatus === "COMPLETE"
        ) {
          stopPolling();
          setPaymentStatus("completed");
          onSuccess?.(
            transaction.transactionCode,
            Number.parseFloat(form.amount)
          );
        } else if (
          normalizedStatus === "FAILED" ||
          normalizedStatus === "CANCELLED"
        ) {
          stopPolling();
          setPaymentStatus("failed");
          setTransaction((prev) => ({
            ...prev,
            error:
              status.message || status.failureReason || "Transaction failed",
          }));
        }
      } catch (error: any) {
        console.error("Status polling error:", error);
        stopPolling();
        if (isActive) {
          setPaymentStatus("failed");
          setTransaction((prev) => ({
            ...prev,
            error: error?.message || "Status check failed",
          }));
        }
      }
    };

    interval = setInterval(pollStatus, 3000);
    return () => {
      isActive = false;
      stopPolling();
    };
  }, [
    transaction.transactionCode,
    paymentStatus,
    form.countryCode,
    form.amount,
    onSuccess,
  ]);

  const loadExchangeRate = async (currencyCode: string) => {
    try {
      const result = await onrampService.getExchangeRate(currencyCode);
      if (result.success && result.rate) setExchangeRate(result.rate);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeposit = async () => {
    const amountNum = Number.parseFloat(form.amount);
    if (!amountNum || amountNum < MIN_KES_AMOUNT) {
      setValidation({
        isValidating: false,
        isValid: false,
        error: `Minimum deposit is ${MIN_KES_AMOUNT} KES`,
      });

      setShakeAmount(true);
      setTimeout(() => setShakeAmount(false), 500);
      return; // block api call to pretium
    }
    if (!account?.address) return;
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
        address: account.address,
        target_goal_id: targetGoalId,
      };
      const result = await onrampService.initiateOnramp(onrampRequest);
      if (result.success) {
        setTransaction((prev) => ({
          ...prev,
          isProcessing: false,
          transactionCode: result.transaction_code || "",
        }));
        setPaymentStatus("pending");
      } else {
        setTransaction((prev) => ({
          ...prev,
          isProcessing: false,
          error: result.error || "Failed",
        }));
        setPaymentStatus("failed");
      }
    } catch (e: any) {
      setTransaction((prev) => ({
        ...prev,
        isProcessing: false,
        error: e.message,
      }));
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[75vh]">
      <div className="px-5 pt-1 pb-6 space-y-4">
        {/* Compact Header */}
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-white/70">
            Deposit via Onramp
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 bg-white/5 rounded-full text-white/30"
          >
            <ChevronRight className="rotate-90 w-3.5 h-3.5" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {paymentStatus === "completed" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-6 text-center space-y-3"
            >
              <div className="w-12 h-12 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20 mx-auto">
                <CheckCircle2 className="w-6 h-6 text-teal-400" />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">
                Payment Successful
              </h3>
              <p className="text-[10px] text-white/50">
                Your deposit is being processed
              </p>
              <ActionButton
                onClick={onClose}
                className="w-full h-11 !bg-teal-600 !text-white"
              >
                Done
              </ActionButton>
            </motion.div>
          ) : paymentStatus === "failed" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-6 text-center space-y-3"
            >
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 mx-auto">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">
                Payment Failed
              </h3>
              <p className="text-[10px] text-red-400/80">
                {transaction.error || "Transaction was cancelled or failed"}
              </p>
              <ActionButton
                onClick={() => {
                  setPaymentStatus("idle");
                  setTransaction({
                    isProcessing: false,
                    transactionCode: "",
                    error: "",
                  });
                }}
                className="w-full h-11 !bg-white !text-black"
              >
                Try Again
              </ActionButton>
            </motion.div>
          ) : paymentStatus === "idle" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {/* Form Fields - Reusing Emerald Input Style */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={form.mobileNetwork}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, mobileNetwork: e.target.value }))
                    }
                    className="flex-1 h-10 bg-white/[0.03] border border-white/10 rounded-xl px-3 text-[10px] font-bold text-white outline-none focus:border-teal-500/40"
                  >
                    <option value="">Network</option>
                    {SUPPORTED_COUNTRIES[
                      form.countryCode as "KES"
                    ]?.networks.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Phone Number"
                    value={form.phoneNumber}
                    type="text"
                    inputMode="tel" // Optimized for mobile
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phoneNumber: e.target.value }))
                    }
                    className="flex-[2] h-10 bg-white/[0.03] border border-white/10 rounded-xl px-3 font-bold text-white outline-none no-zoom-input"
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <motion.div
                  animate={
                    shakeAmount ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }
                  }
                  transition={{
                    duration: 0.4,
                    ease: "easeOut",
                  }}
                  className="relative flex flex-col items-center justify-center py-4 bg-white/[0.01] rounded-2xl border border-white/5"
                >
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-full bg-transparent text-3xl font-black text-center text-white outline-none placeholder:text-white/5"
                  />
                  <span className="text-[8px] font-black text-teal-400 uppercase tracking-widest mt-1">
                    KES Amount
                  </span>
                </motion.div>
                <AnimatePresence>
                  {validation.error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-[9px] font-bold text-red-400 uppercase tracking-wide text-center"
                    >
                      {validation.error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {exchangeRate && form.amount && (
                  <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-teal-500/5 rounded-lg border border-teal-500/10">
                    <Info size={10} className="text-teal-400" />
                    <p className="text-[9px] font-bold text-teal-100/60 uppercase">
                      Receiving:{" "}
                      <span className="text-teal-400">
                        {(Number(form.amount) / exchangeRate).toFixed(4)}{" "}
                        {assetSymbol}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleDeposit}
                disabled={!form.amount || transaction.isProcessing}
                className="w-full py-4 rounded-2xl bg-teal-500 text-black font-black uppercase tracking-widest text-xs hover:bg-teal-400 transition-colors shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {transaction.isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Send Payment Request"
                )}
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-8 text-center space-y-4"
            >
              <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                Check your phone for the STK push
              </p>
              <p className="text-[9px] text-white/30">
                Waiting for payment confirmation...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BottomSheet>
  );
}
