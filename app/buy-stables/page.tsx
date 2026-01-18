"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Wallet,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Info,
  CreditCard,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// Assuming these are your utility paths
import {
  onrampService,
  SUPPORTED_COUNTRIES,
  formatPhoneNumber,
  ONRAMP_SUPPORTED_ASSETS,
  type OnrampRequest,
} from "@/lib/services/onrampService";
import { estimateOfframpFee } from "@/lib/services/offrampService";
import { theme } from "@/lib/theme";

type Step = "config" | "destination" | "payment" | "status";
type PaymentStatus = "idle" | "pending" | "completed" | "failed";

export default function ProductionBuyStables() {
  const router = useRouter();
  
  // --- UI State ---
  const [currentStep, setCurrentStep] = useState<Step>("config");
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [transactionMeta, setTransactionMeta] = useState({
    transactionCode: "",
    txHash: "",
  });

  // --- Form State ---
  const [form, setForm] = useState({
    walletAddress: "",
    phoneNumber: "",
    amount: "",
    mobileNetwork: "",
    countryCode: "KES",
    chain: Object.keys(ONRAMP_SUPPORTED_ASSETS)[0] || "CELO",
    asset: "cUSD",
  });

  // --- Logic & Derived Values ---
  const assetOptions = useMemo(() => {
    return ONRAMP_SUPPORTED_ASSETS[form.chain as keyof typeof ONRAMP_SUPPORTED_ASSETS] || [];
  }, [form.chain]);

  const countryLimits = onrampService.getCountryLimits(form.countryCode);
  const amountNum = parseFloat(form.amount || "0");
  const feeAmount =
    amountNum > 0 ? estimateOfframpFee(amountNum, form.countryCode) : 0;
  const netAmount = Math.max(amountNum - feeAmount, 0);
  const receiveAmount =
    exchangeRate && netAmount > 0 ? netAmount / exchangeRate : 0;

  // --- Effects ---
  useEffect(() => {
    const loadRate = async () => {
      const result = await onrampService.getExchangeRate(form.countryCode);
      if (result.success) setExchangeRate(result.rate);
    };
    loadRate();
  }, [form.countryCode]);

  useEffect(() => {
    if (paymentStatus !== "pending" || !transactionMeta.transactionCode) return;

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
            setError("Status check timed out. Please try again.");
          }
          return;
        }

        const status = await onrampService.getTransactionStatus(
          transactionMeta.transactionCode,
          form.countryCode
        );

        const normalizedStatus = status.status?.toUpperCase?.() || "";
        const txHash = status.transaction_hash || status.tx_hash || "";

        if (
          txHash &&
          (normalizedStatus === "SUCCESS" ||
            normalizedStatus === "COMPLETED" ||
            normalizedStatus === "COMPLETE")
        ) {
          stopPolling();
          setTransactionMeta((prev) => ({ ...prev, txHash }));
          setPaymentStatus("completed");
          return;
        }

        if (
          normalizedStatus === "FAILED" ||
          normalizedStatus === "CANCELLED"
        ) {
          stopPolling();
          setPaymentStatus("failed");
          setError(
            status.message || status.failureReason || "Transaction failed"
          );
        }
      } catch (err: any) {
        stopPolling();
        if (isActive) {
          setPaymentStatus("failed");
          setError(err?.message || "Status check failed");
        }
      }
    };

    interval = setInterval(pollStatus, 4000);
    return () => {
      isActive = false;
      stopPolling();
    };
  }, [paymentStatus, transactionMeta.transactionCode, form.countryCode]);

  // --- Actions ---
  const handleInitiatePayment = async () => {
    setIsProcessing(true);
    setError("");
    try {
      const formattedPhone = formatPhoneNumber(form.phoneNumber, form.countryCode);
      const request: OnrampRequest = {
        shortcode: formattedPhone,
        amount: amountNum,
        mobile_network: form.mobileNetwork,
        chain: form.chain,
        asset: form.asset,
        address: form.walletAddress.trim(),
      };

      const result = await onrampService.initiateOnramp(
        request,
        form.countryCode,
        form.walletAddress.trim()
      );
      if (result.success) {
        setTransactionMeta({
          transactionCode: result.transaction_code || "",
          txHash: "",
        });
        setPaymentStatus("pending");
        setCurrentStep("status");
      } else {
        setError(result.error || "Payment failed to initialize");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Sub-Components ---
  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-8 px-2">
      {["config", "destination", "payment"].map((s, i) => (
        <React.Fragment key={s}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full border text-xs font-bold transition-all ${
            currentStep === s ? "border-teal-500 bg-teal-500 text-black shadow-[0_0_15px_rgba(20,184,166,0.4)]" : 
            (i < ["config", "destination", "payment"].indexOf(currentStep) ? "bg-teal-500/20 border-teal-500/50 text-teal-500" : "border-white/10 text-white/30")
          }`}>
            {i + 1}
          </div>
          {i < 2 && <div className={`flex-1 h-[2px] mx-2 ${i < ["config", "destination", "payment"].indexOf(currentStep) ? "bg-teal-500/50" : "bg-white/5"}`} />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Top Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => currentStep === "config" ? router.push("/") : setCurrentStep("config")}
            className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors text-white/50"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Live Rates</span>
          </div>
        </div>

        <StepIndicator />

        <div className="relative bg-[#0A0A0A] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden p-6">
          {/* Decorative Gradient Glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-500/5 blur-[100px] pointer-events-none" />
          
          <AnimatePresence mode="wait">
            {/* STEP 1: CONFIGURATION */}
            {currentStep === "config" && (
              <motion.div 
                key="config"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <header>
                  <h2 className="text-2xl font-bold">How much?</h2>
                  <p className="text-white/50 text-base">Enter the amount you want to buy.</p>
                </header>

                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-focus-within focus-within:border-teal-500/50">
                    <label className="text-[10px] font-bold text-teal-500 uppercase tracking-widest">You Pay</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input 
                        type="number"
                        value={form.amount}
                        onChange={(e) => setForm({...form, amount: e.target.value})}
                        className="bg-transparent text-4xl font-bold outline-none w-full placeholder:text-white/10"
                        placeholder="0.00"
                      />
                      <span className="text-xl font-medium text-white/30">{form.countryCode}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 relative">
                      <span className="text-[9px] font-bold text-white/40 uppercase">Chain</span>
                      <select 
                        value={form.chain} 
                        onChange={(e) => setForm({...form, chain: e.target.value})}
                        className="w-full bg-transparent outline-none font-bold text-base mt-1 appearance-none cursor-pointer"
                      >
                        {Object.keys(ONRAMP_SUPPORTED_ASSETS).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 bottom-4 text-white/20" />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 relative">
                      <span className="text-[9px] font-bold text-white/40 uppercase">Asset</span>
                      <select 
                        value={form.asset} 
                        onChange={(e) => setForm({...form, asset: e.target.value})}
                        className="w-full bg-transparent outline-none font-bold text-base mt-1 appearance-none cursor-pointer"
                      >
                        {assetOptions.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 bottom-4 text-white/20" />
                    </div>
                  </div>
                </div>

                <div className="bg-teal-500/5 border border-teal-500/10 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    
                    <div>
                      <p className="text-[10px] text-white/40 uppercase font-bold">Estimated Receive</p>
                      <p className="font-bold text-teal-400">{receiveAmount.toFixed(4)} {form.asset}</p>
                    </div>
                  </div>
                  <Info size={16} className="text-white/20" />
                </div>

                <button 
                  disabled={!amountNum || amountNum < countryLimits.min}
                  onClick={() => setCurrentStep("destination")}
                  className="w-full py-5 bg-teal-500 text-black font-black rounded-2xl uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30"
                >
                  Continue
                </button>
              </motion.div>
            )}

            {/* STEP 2: DESTINATION */}
            {currentStep === "destination" && (
              <motion.div 
                key="dest"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <header>
                  <h2 className="text-2xl font-bold">Where to?</h2>
                  <p className="text-white/50 text-base">Paste your receiving wallet address.</p>
                </header>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 focus-within:border-teal-500/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet size={16} className="text-teal-500" />
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Wallet Address</label>
                  </div>
                  <textarea 
                    value={form.walletAddress}
                    onChange={(e) => setForm({...form, walletAddress: e.target.value})}
                    placeholder="0x..."
                    className="w-full bg-transparent text-base font-mono outline-none h-20 resize-none text-white/80"
                  />
                </div>

                <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl">
                  <AlertCircle size={18} className="text-yellow-500 shrink-0" />
                  <p className="text-[11px] text-yellow-500/80 leading-relaxed">
                    Ensure the address is on the <strong>{form.chain}</strong> network. Funds sent to the wrong network may be lost forever.
                  </p>
                </div>

                <button 
                  disabled={form.walletAddress.length < 10}
                  onClick={() => setCurrentStep("payment")}
                  className="w-full py-5 bg-teal-500 text-black font-black rounded-2xl uppercase tracking-widest text-xs"
                >
                  Next: Payment Details
                </button>
              </motion.div>
            )}

            {/* STEP 3: PAYMENT DETAILS */}
            {currentStep === "payment" && (
              <motion.div 
                key="pay"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <header>
                  <h2 className="text-2xl font-bold">Payment</h2>
                  <p className="text-white/50 text-base">How will you be paying?</p>
                </header>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 relative">
                      <span className="text-[9px] font-bold text-white/40 uppercase">Mobile Network</span>
                      <select 
                        value={form.mobileNetwork} 
                        onChange={(e) => setForm({...form, mobileNetwork: e.target.value})}
                        className="w-full bg-transparent outline-none font-bold text-base mt-1 appearance-none cursor-pointer"
                      >
                        <option value="">Select</option>
                        {SUPPORTED_COUNTRIES[form.countryCode as "KES"]?.networks.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 bottom-4 text-white/20" />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                      <span className="text-[9px] font-bold text-white/40 uppercase">Phone Number</span>
                      <input 
                        value={form.phoneNumber}
                        onChange={(e) => setForm({...form, phoneNumber: e.target.value})}
                        className="w-full bg-transparent outline-none font-bold text-base mt-1"
                        placeholder="07..."
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 space-y-2">
                  <div className="flex justify-between text-[11px] text-white/40 font-medium">
                    <span>Subtotal</span>
                    <span>{amountNum} {form.countryCode}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-white/40 font-medium">
                    <span>Fee (included)</span>
                    <span>{feeAmount.toFixed(2)} {form.countryCode}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-2">
                    <span>Total Charged</span>
                    <span className="text-teal-400">{amountNum} {form.countryCode}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-white/40">
                    <Info size={12} className="text-teal-400" />
                    Fee is deducted from the converted amount, not added to your payment.
                  </div>
                </div>

                {error && <p className="text-[10px] text-red-400 font-bold text-center uppercase tracking-wide">{error}</p>}

                <button 
                  onClick={handleInitiatePayment}
                  disabled={isProcessing || !form.mobileNetwork || !form.phoneNumber}
                  className="w-full py-5 bg-teal-500 text-black font-black rounded-2xl uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send request </>}
                </button>
              </motion.div>
            )}

            {/* STATUS VIEW */}
            {currentStep === "status" && (
               <motion.div key="status" className="text-center py-8 space-y-6">
                  {paymentStatus === "pending" ? (
                    <>
                      <div className="relative w-20 h-20 mx-auto">
                        <div className="absolute inset-0 bg-teal-500/20 rounded-full animate-ping" />
                        <div className="relative flex items-center justify-center w-20 h-20 bg-teal-500/10 rounded-full border border-teal-500/30">
                          <Smartphone className="text-teal-500 animate-bounce" size={32} />
                        </div>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Check your phone</h2>
                        <p className="text-white/50 text-base mt-2">We've sent an STK push to <br/><strong>{form.phoneNumber}</strong></p>
                      </div>
                    </>
                  ) : paymentStatus === "completed" ? (
                    <>
                      <CheckCircle2 size={64} className="text-teal-500 mx-auto" />
                      <h2 className="text-2xl font-bold">Success!</h2>
                      {transactionMeta.txHash && (
                        <p className="text-[10px] text-white/50 break-all">
                          Tx hash: {transactionMeta.txHash}
                        </p>
                      )}
                      <button onClick={() => router.push("/")} className="w-full py-4 bg-white text-black font-bold rounded-2xl">Done</button>
                    </>
                  ) : paymentStatus === "failed" ? (
                    <>
                      <AlertCircle size={64} className="text-red-400 mx-auto" />
                      <h2 className="text-2xl font-bold">Payment Failed</h2>
                      <p className="text-[11px] text-red-400/80">{error || "Transaction failed"}</p>
                      <button
                        onClick={() => {
                          setPaymentStatus("idle");
                          setCurrentStep("payment");
                        }}
                        className="w-full py-4 bg-white text-black font-bold rounded-2xl"
                      >
                        Try Again
                      </button>
                    </>
                  ) : null}
               </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Trust Section */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6 opacity-30 grayscale contrast-125">
             <span className="text-[10px] font-black tracking-widest uppercase">M-PESA</span>
             <span className="text-[10px] font-black tracking-widest uppercase">AIRTEL</span>
          </div>

        </div>

      </div>
    </div>
  );
}
