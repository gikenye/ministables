"use client";

import { FC, useEffect, useMemo, useState } from "react";
import {
  Smartphone,
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BottomSheet,
  ModalHeader,
  ActionButton,
} from "@/components/ui";
import { toast } from "sonner";
import {
  offrampService,
  formatCurrencyAmount,
  type OfframpQuoteResponse,
} from "@/lib/services/offrampService";
import { OFFRAMP_SETTLEMENT_WALLETS } from "@/config/offrampConfig";
import type { TokenBalance } from "@/lib/services/balanceService";

interface OfframpModalProps {
  isOpen: boolean;
  onClose: () => void;

  tokenSymbol: string; // cryptoCurrency
  tokenAddress: string;
  network: string; // used as `network` for quote + `chain` for initiate
  availableAmount: string;
  decimals: number;
  tokenBalances?: TokenBalance[];
  selectedToken?: TokenBalance | null;
  onTokenSelect?: (token: TokenBalance) => void;

  userDeposits?: string;
  userBorrows?: string;

  onWithdrawSuccess?: (orderID: string, amount: string) => void;
  onVaultWithdraw: (tokenSymbol: string, amount: string) => Promise<void>;
  onSettlementTransfer: (
    tokenAddress: string,
    amount: string,
    toAddress: string
  ) => Promise<string>; // returns tx hash
}
type Step = 1 | 2 | 3 | 4;

const normalizePretiumChain = (network: string) => {
  const n = network.trim().toUpperCase();
  if (n.includes("CELO")) return "CELO";
  if (n.includes("BASE")) return "BASE";
  throw new Error(`Unsupported network: ${network}`);
};


export const EnhancedOfframpModal: FC<OfframpModalProps> = ({
  isOpen,
  onClose,
  tokenSymbol,
  tokenAddress,
  network,
  availableAmount,
  decimals,
  userDeposits = "0",
  userBorrows = "0",
  tokenBalances = [],
  selectedToken = null,
  onTokenSelect,
  onWithdrawSuccess,
  onVaultWithdraw,
  onSettlementTransfer,
}) => {
  const [step, setStep] = useState<Step>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [processingStage, setProcessingStage] = useState<
    "WITHDRAWAL" | "TRANSFER" | "OFFRAMP"
  >("WITHDRAWAL");
  const [shakeAmount, setShakeAmount] = useState(false);

  // UI form (align to service naming)
  const [form, setForm] = useState({
    partyB: "", // phone (raw input)
    amount: "", // crypto amount (string)
    fiatCurrency: "KES",
  });

  const [quote, setQuote] = useState<OfframpQuoteResponse["data"] | null>(null);
  const [constraint, setConstraint] = useState<{ ok: boolean; error?: string }>(
    { ok: true }
  );
  const activeToken = selectedToken || {
    symbol: tokenSymbol,
    address: tokenAddress,
    balance: Number.parseFloat(availableAmount || "0"),
    formattedBalance: availableAmount || "0",
    decimals,
  };
  const activeTokenSymbol = activeToken.symbol;
  const activeTokenAddress = activeToken.address;
  const activeAvailableAmount =
    selectedToken?.balance !== undefined
      ? selectedToken.balance.toString()
      : availableAmount;
  const effectiveDeposits =
    selectedToken?.balance !== undefined
      ? selectedToken.balance.toString()
      : userDeposits;

  // Reset when opened
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setIsProcessing(false);
    setIsLoadingQuote(false);
    setProcessingStage("WITHDRAWAL");
    setQuote(null);
    setConstraint({ ok: true });
    setForm((f) => ({ ...f, amount: "" }));
  }, [isOpen]);

  // Quote + constraint validation (debounced)
  useEffect(() => {
    const amountNum = Number(form.amount);
    if (!isOpen || !amountNum || amountNum <= 0) {
      setQuote(null);
      setConstraint({ ok: true });
      return;
    }

    const t = setTimeout(async () => {
      setIsLoadingQuote(true);

      // 1) Quote (service contract)
      const quoteRes = await offrampService.getOfframpQuote({
        amount: form.amount,
        fiatCurrency: form.fiatCurrency,
        cryptoCurrency: activeTokenSymbol,
        network, // quote uses network field
      });

      const validation = offrampService.validateWithdrawalConstraints(
        activeTokenAddress,
        form.amount,
        effectiveDeposits,
        userBorrows,
        false
      );

      if (quoteRes.success && quoteRes.data) {
        setQuote(quoteRes.data);

        if (validation.ok && quoteRes.data?.limits?.min) {
          const minFiat = Number(quoteRes.data.limits.min);
          const fiatOut = Number(quoteRes.data.outputAmount || 0);

          if (fiatOut > 0 && fiatOut < minFiat) {
            setConstraint({
              ok: false,
              error: `Minimum withdrawal is ${formatCurrencyAmount(
                minFiat,
                form.fiatCurrency
              )}`,
            });
          } else {
            setConstraint(validation);
          }
        } else {
          setConstraint(validation);
        }
      } else {
        setQuote(null);
        setConstraint(validation);
      }

      setIsLoadingQuote(false);
    }, 600);

    return () => clearTimeout(t);
  }, [
    isOpen,
    form.amount,
    form.fiatCurrency,
    activeTokenSymbol,
    network,
    activeTokenAddress,
    effectiveDeposits,
    userBorrows,
  ]);

  const maxBalance = useMemo(
    () => Number(activeAvailableAmount || "0"),
    [activeAvailableAmount]
  );
  const isReviewDisabled = useMemo(() => {
    return !form.amount || !form.partyB || !constraint.ok;
  }, [form.amount, form.partyB, constraint.ok]);
  const processingCopy = useMemo(() => {
    switch (processingStage) {
      case "WITHDRAWAL":
        return {
          title: "Withdrawing",
          subtitle: "Moving funds from the vault to your wallet…",
        };
      case "TRANSFER":
        return {
          title: "Sending to settlement",
          subtitle: "Confirm the transfer from your wallet to continue…",
        };
      default:
        return {
          title: "Initiating payout",
          subtitle: "Submitting mobile money payout details…",
        };
    }
  }, [processingStage]);
  const minFiatLimit = useMemo(() => {
    if (!quote?.limits?.min) return null;
    return Number(quote.limits.min);
  }, [quote?.limits?.min]);
  const isBelowMinimum = useMemo(() => {
    if (!minFiatLimit) return false;
    const fiatOut = Number(quote?.outputAmount || 0);
    return fiatOut > 0 && fiatOut < minFiatLimit;
  }, [minFiatLimit, quote?.outputAmount]);

  const triggerAmountShake = () => {
    setShakeAmount(true);
    setTimeout(() => setShakeAmount(false), 450);
  };

  const handleClose = () => {
    setStep(1);
    setIsProcessing(false);
    setProcessingStage("WITHDRAWAL");
    setQuote(null);
    setConstraint({ ok: true });
    onClose();
  };
  const handleTokenSelect = (token: TokenBalance) => {
    if (token.address === activeTokenAddress) return;
    onTokenSelect?.(token);
    setQuote(null);
    setConstraint({ ok: true });
    setForm((f) => ({ ...f, amount: "" }));
  };
  const handleConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setStep(3);

    try {
      if (!constraint.ok) {
        triggerAmountShake();
        throw new Error(constraint.error || "Invalid withdrawal amount");
      }
      if (isBelowMinimum && minFiatLimit) {
        triggerAmountShake();
        throw new Error(
          `Minimum withdrawal is ${formatCurrencyAmount(
            minFiatLimit,
            form.fiatCurrency
          )}`
        );
      }
      const chain = normalizePretiumChain(network); // "CELO" | "BASE" | ...

      const settlement = OFFRAMP_SETTLEMENT_WALLETS[chain];
      if (!settlement) {
        throw new Error(`No settlement wallet configured for ${chain}`);
      }

      setProcessingStage("WITHDRAWAL");
      await onVaultWithdraw(activeTokenSymbol, form.amount);

      setProcessingStage("TRANSFER");
      const transactionHash = await onSettlementTransfer(
        activeTokenAddress,
        form.amount,
        settlement
      );

      setProcessingStage("OFFRAMP");
      const shortcode = offrampService.formatPhoneNumber(
        form.partyB,
        form.fiatCurrency
      );

      const fiatAmount = quote?.outputAmount;
      if (!fiatAmount) {
        throw new Error("Quote missing. Please wait for quote to load.");
      }

      const initRes = await offrampService.initiateOfframp({
        chain,
        transactionHash,
        shortcode,
        amount: String(fiatAmount),
        type: "MOBILE",
      });

      if (!initRes.success || !initRes.data?.orderID) {
        throw new Error(initRes.error || "Offramp initiation failed");
      }

      setStep(4);
      onWithdrawSuccess?.(initRes.data.orderID, form.amount);
    } catch (e: any) {
      toast.error(e?.message || "Withdrawal failed");
      setStep(2);
    } finally {
      setIsProcessing(false);
      setProcessingStage("WITHDRAWAL");
    }
  };

  const handleReview = () => {
    if (isReviewDisabled) {
      const amountNum = Number(form.amount);
      if (!amountNum || amountNum <= 0 || !constraint.ok || isBelowMinimum) {
        triggerAmountShake();
      }
      return;
    }
    setStep(2);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} maxHeight="max-h-[75vh]">
      <div className="flex flex-col h-full text-white bg-transparent overflow-hidden">
        <ModalHeader
          title={step === 4 ? "Success" : "Send to Phone"}
          onClose={handleClose}
        />

        {/* Step Indicator */}
        <div className="flex px-6 gap-1 mb-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                step >= i ? "bg-emerald-500" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-12">
          <AnimatePresence mode="wait">
            {/* STEP 1: Input */}
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <motion.div
                  animate={
                    shakeAmount ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }
                  }
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="bg-white/5 border border-white/10 rounded-[28px] p-4 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                      Amount ({activeTokenSymbol})
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400">
                      Bal: {Number(maxBalance).toFixed(2)}
                    </span>
                  </div>
                  {tokenBalances.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2">
                      {tokenBalances.map((token) => {
                        const isSelected = token.address === activeTokenAddress;
                        return (
                          <button
                            key={token.address}
                            type="button"
                            onClick={() => handleTokenSelect(token)}
                            className={`px-3 py-2 rounded-xl border text-left transition-colors ${
                              isSelected
                                ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                                : "bg-white/[0.03] border-white/10 text-white/70 hover:border-white/20"
                            }`}
                          >
                            <div className="text-[10px] font-black uppercase tracking-wide">
                              {token.symbol}
                            </div>
                            <div className="text-[9px] font-bold text-white/50">
                              ${Number(token.balance || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 6,
                              })}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-full bg-transparent text-4xl font-black focus:outline-none placeholder:text-white/10"
                  />

                  <div className="flex gap-2">
                    {[0.25, 0.5, 1].map((p) => (
                      <button
                        key={p}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            amount: (Number(maxBalance) * p).toString(),
                          }))
                        }
                        className="flex-1 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black hover:bg-white/10 transition-colors"
                      >
                        {p === 1 ? "MAX" : `${p * 100}%`}
                      </button>
                    ))}
                  </div>

                  {!!constraint.error && (
                    <div className="flex gap-2 items-start bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
                      <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                      <p className="text-[10px] font-bold text-red-200/80 uppercase leading-relaxed">
                        {constraint.error}
                      </p>
                    </div>
                  )}
                </motion.div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 px-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input
                      type="tel"
                      value={form.partyB}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, partyB: e.target.value }))
                      }
                      placeholder="0712 345 678"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 font-bold focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                </div>

                {!!quote && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex justify-between items-center"
                  >
                    <span className="text-xs font-bold text-white/60">
                      Estimated Received
                    </span>
                    <span className="text-lg font-black text-emerald-400">
                      {formatCurrencyAmount(
                        Number(quote.outputAmount || 0),
                        form.fiatCurrency
                      )}
                    </span>
                  </motion.div>
                )}

                <ActionButton
                  disabled={isReviewDisabled}
                  onClick={handleReview}
                  size="lg"
                  className="w-full py-4 rounded-2xl bg-teal-500 text-black font-black uppercase tracking-widest text-xs hover:bg-teal-400 transition-colors shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed"

                >
                  Review Transaction
                </ActionButton>

                {isLoadingQuote && (
                  <p className="text-[10px] text-white/25 font-bold uppercase tracking-widest text-center">
                    Updating quote…
                  </p>
                )}
              </motion.div>
            )}

            {/* STEP 2: Review */}
            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="relative overflow-hidden rounded-[26px] border border-emerald-500/15 bg-gradient-to-br from-emerald-500/10 via-white/[0.02] to-transparent p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
                  <div className="space-y-4">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-xs text-white/40">From Wallet</span>
                      <span className="text-xs font-mono font-bold text-white/80">
                        {activeTokenSymbol}
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-xs text-white/40">To Phone</span>
                      <span className="text-xs font-bold text-white/80">
                        {form.partyB}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200/70">
                        You Receive
                      </span>
                      <span className="text-sm font-black text-emerald-300">
                        {formatCurrencyAmount(
                          Number(quote?.outputAmount || 0),
                          form.fiatCurrency
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-xs text-white/40">You Send</span>
                      <span className="text-xs font-black text-white/80">
                        {form.amount} {activeTokenSymbol}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                  <Shield size={18} className="text-blue-400 shrink-0" />
                  <p className="text-[10px] font-bold text-blue-200/60 uppercase leading-relaxed">
                    Funds are withdrawn on-chain first, then paid out to your
                    phone via verified mobile money rails.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 rounded-[20px] bg-white/5 font-black text-[10px] uppercase tracking-widest"
                  >
                    Back
                  </button>
                  <ActionButton
                    onClick={handleConfirm}
                    variant="primary"
                    className="flex-[2]"
                    disabled={isProcessing}
                  >
                    Confirm & Send
                  </ActionButton>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Processing */}
            {step === 3 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 space-y-6"
              >
                <div className="relative">
                  <Loader2 className="w-16 h-16 text-emerald-500 animate-spin" />
                  <Smartphone className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-white/40" />
                </div>

                <div className="text-center">
                  <h3 className="text-xl font-black uppercase tracking-widest">
                    {processingCopy.title}
                  </h3>
                  <p className="text-xs text-white/30 font-bold mt-2">
                    {processingCopy.subtitle}
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Success */}
            {step === 4 && (
              <motion.div
                key="s4"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center py-8"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6 border border-emerald-500/50">
                  <CheckCircle className="w-10 h-10 text-emerald-400" />
                </div>

                <h3 className="text-2xl font-black uppercase tracking-widest mb-2">
                  Funds Sent!
                </h3>

                <p className="text-sm text-white/40 font-bold text-center mb-8 px-6">
                  {formatCurrencyAmount(
                    Number(quote?.outputAmount || 0),
                    form.fiatCurrency
                  )}{" "}
                  is on its way to {form.partyB}.
                </p>

                <ActionButton onClick={handleClose} variant="primary">
                  Done
                </ActionButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </BottomSheet>
  );
};

export default EnhancedOfframpModal;
