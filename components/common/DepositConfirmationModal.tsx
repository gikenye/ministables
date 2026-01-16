"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ModalHeader } from "@/components/ui/ModalHeader";
import {
  AlertCircle,
  Loader2,
  CheckCircle,
  Wallet,
  Smartphone,
  RefreshCcw,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

type DepositMethod = "ONCHAIN" | "MPESA";
interface DepositConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  onDeposit: () => void;
  isLoading?: boolean;
  error?: string | null;
  transactionStatus?: string | null;
  depositSuccess?: any | null;
  goalTitle?: string;
  depositMethod?: DepositMethod;
  setShowOnrampModal?: (val: boolean) => void;
  
  
}

export const DepositConfirmationModal = ({
  isOpen,
  onClose,
  amount,
  onDeposit,
  isLoading,
  error,
  transactionStatus,
  depositSuccess,
  depositMethod,
}: DepositConfirmationModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resolvedError =
    error ||
    (depositMethod === "ONCHAIN"
      ? "On-chain transaction failed or was rejected in your wallet."
      : "Mobile money payment failed or was cancelled.");
  const phase = useMemo(() => {
    if (isSubmitting || isLoading) return "PROCESSING";
    if (depositSuccess) return "SUCCESS";
    if (error) return "ERROR";
    return "CONFIRM";
  }, [isSubmitting, isLoading, depositSuccess, error]);

  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (depositSuccess || error) {
      setIsSubmitting(false);
    }
  }, [depositSuccess, error]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="px-6 pt-8 pb-12 space-y-8">
        <AnimatePresence mode="wait">
          {/* PHASE: CONFIRM */}
          {phase === "CONFIRM" && (
            <motion.div
              key="conf"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <p className="text-[12px] font-black uppercase tracking-[0.2em] text-white">
                  Total to Deposit
                </p>
                <div className="text-2xl font-black tracking-tighter flex items-center justify-center gap-3 text-white">
                  <span className="text-teal-500">KES</span>
                  {Number(amount).toLocaleString()}
                </div>
              </div>

              <button
                onClick={() => {
                  if (isSubmitting || isLoading) return;
                  setIsSubmitting(true);
                  onDeposit();
                }}
                disabled={isSubmitting || isLoading}
                className="w-full py-2 rounded-2xl bg-teal-500 text-black font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-teal-500/20
    disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 transition-transform"
              >
                Initiate Payment
              </button>
            </motion.div>
          )}

          {phase === "ERROR" && (
            <motion.div
              key="err"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-2 flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                </div>
                <p className="text-sm font-bold text-red-200/90 leading-relaxed  tracking-tight">
                  {resolvedError}
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full text-red-500 text-[10px] font-black uppercase tracking-[0.4em] hover:text-red-400 transition-colors"
              >
                Cancel Transaction
              </button>
            </motion.div>
          )}

          {/* PHASE: PROCESSING */}
          {phase === "PROCESSING" && (
            <motion.div
              key="proc"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-10 flex flex-col items-center gap-6"
            >
              <Loader2 className="w-12 h-12 text-teal-500 animate-spin" />

              <div className="text-center space-y-2">
                <h3 className="text-lg font-black uppercase tracking-tight text-white">
                  {depositMethod === "ONCHAIN"
                    ? "Confirm in Wallet"
                    : "Requesting Payment"}
                </h3>

                <p className="text-[9px] text-teal-400/60 uppercase tracking-[0.25em]">
                  {depositMethod === "ONCHAIN"
                    ? "Waiting for wallet confirmation…"
                    : "Sending request…"}
                </p>

                <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                  {depositMethod === "ONCHAIN"
                    ? "Approve the transaction in your wallet"
                    : "Check your phone for the M-Pesa prompt"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BottomSheet>
  );
};
