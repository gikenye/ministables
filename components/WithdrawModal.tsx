"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, AlertCircle, CheckCircle2, Info, ChevronRight } from "lucide-react";
import { BottomSheet, ModalHeader, ActionButton } from "@/components/ui";
import { theme } from "@/lib/theme";
import { motion, AnimatePresence } from "framer-motion";

interface WithdrawableDeposit {
  depositId: number;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  withdrawableAmount: string;
  lockTier: number;
  depositTime: number;
  unlockTime: number;
}

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWithdraw: (tokenSymbol: string, depositIds: number[], sponsorGas?: boolean) => Promise<void>;
  vaultPositions: WithdrawableDeposit[];
  loading: boolean;
  userAddress?: string;
}

type ModalStage = "INPUT" | "CONFIRMING" | "SUCCESS" | "ERROR";

export const WithdrawModal = ({
  isOpen,
  onClose,
  onWithdraw,
  vaultPositions,
  loading,
}: WithdrawModalProps) => {
  const [stage, setStage] = useState<ModalStage>("INPUT");
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      setStage("INPUT");
      setWithdrawAmount("");
      setError(null);
    }
  }, [isOpen]);

  const tokenBalances = useMemo(() => {
    const balancesBySymbol: Record<string, { symbol: string; total: number; positions: WithdrawableDeposit[] }> = {};
    vaultPositions
      .filter((p) => parseFloat(p.withdrawableAmount || "0") > 0)
      .forEach((position) => {
        const symbol = position.tokenSymbol;
        if (!balancesBySymbol[symbol]) {
          balancesBySymbol[symbol] = { symbol, total: 0, positions: [] };
        }
        balancesBySymbol[symbol].total += parseFloat(position.withdrawableAmount);
        balancesBySymbol[symbol].positions.push(position);
      });
    
    const result = Object.values(balancesBySymbol);
    if (result.length > 0 && !selectedToken) setSelectedToken(result[0].symbol);
    return result;
  }, [vaultPositions, selectedToken]);

  const currentTokenData = tokenBalances.find((t) => t.symbol === selectedToken);

  const handleWithdraw = async () => {
    if (stage === "INPUT") {
      const amount = parseFloat(withdrawAmount);
      if (!amount || amount <= 0) return setError("Enter a valid amount");
      if (amount > (currentTokenData?.total || 0)) return setError("Insufficient balance");
      setStage("CONFIRMING");
      return;
    }

    setIsWithdrawing(true);
    setError(null);
    
    try {
      const depositIds = selectPositionsForAmount(parseFloat(withdrawAmount), selectedToken);
      await onWithdraw(selectedToken, depositIds, true);
      if (typeof window !== "undefined" && window.navigator.vibrate) window.navigator.vibrate([50, 30, 50]);
      setStage("SUCCESS");
    } catch (err: any) {
      setError(err.message || "Transaction failed");
      setStage("ERROR");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const selectPositionsForAmount = (amount: number, tokenSymbol: string): number[] => {
    if (!currentTokenData) return [];
    const sorted = [...currentTokenData.positions].sort((a, b) => parseFloat(b.withdrawableAmount) - parseFloat(a.withdrawableAmount));
    const selectedIds: number[] = [];
    let remaining = amount;
    for (const pos of sorted) {
      if (remaining <= 0) break;
      selectedIds.push(pos.depositId);
      remaining -= parseFloat(pos.withdrawableAmount);
    }
    return selectedIds;
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[65vh]">
      <div className="px-5 pt-1 pb-6 space-y-3">
        {/* 30% Smaller Header */}
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-white/70">
            {stage === "INPUT" ? "Withdraw" : stage.toLowerCase()}
          </h2>
          <button onClick={onClose} className="p-1.5 bg-white/5 rounded-full text-white/30 hover:text-white/60 transition">
            <ChevronRight className="rotate-90 w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-8 space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Syncing Vault</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {stage === "SUCCESS" ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-4 text-center space-y-3">
                <div className="w-12 h-12 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20">
                  <CheckCircle2 className="w-6 h-6 text-teal-400" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">Success 🎉 </h3>
                  <p className="text-[10px] text-white/40 leading-relaxed"> {withdrawAmount} {selectedToken} sent to your wallet .</p>
                </div>
                <ActionButton onClick={onClose} variant="primary" className="w-full h-10 !bg-teal-600 !text-white text-[10px]">Close</ActionButton>
              </motion.div>
            ) : stage === "ERROR" ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-4 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-red-500/40" />
                <p className="text-[10px] text-red-200/50 px-4">{error}</p>
                <ActionButton onClick={() => setStage("INPUT")} variant="primary" className="w-full h-10 text-[10px]">Try Again</ActionButton>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {/* Compact Asset Selector */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Asset</span>
                    <span className="text-[9px] font-bold text-teal-400/80">{currentTokenData?.total.toFixed(2) || "0.00"} {selectedToken}</span>
                  </div>
                  <div className="flex gap-1.5 p-1 bg-black/20 rounded-xl border border-white/5">
                    {tokenBalances.map((token) => (
                      <button
                        key={token.symbol}
                        onClick={() => { setSelectedToken(token.symbol); setError(null); }}
                        className={`flex-1 py-1.5 rounded-lg transition-all text-[10px] font-black tracking-widest uppercase ${
                          selectedToken === token.symbol 
                            ? "bg-teal-500/20 text-teal-100 border border-teal-500/30" 
                            : "text-white/20 hover:text-white/40"
                        }`}
                      >
                        {token.symbol}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reduced Numeric Input */}
                <div className="space-y-2.5">
                  <div className="relative flex flex-col items-center justify-center py-2 px-2 bg-white/[0.01] rounded-2xl border border-white/5 focus-within:border-teal-500/20 transition-all">
                    <input
                      type="number"
                      value={withdrawAmount}
                      disabled={stage === "CONFIRMING"}
                      onChange={(e) => { setWithdrawAmount(e.target.value); setError(null); }}
                      placeholder="0.00"
                      className="w-full bg-transparent text-2xl font-black text-center text-white outline-none placeholder:text-white/5"
                    />
                    <span className="mt-1 text-[8px] font-black text-white/10 uppercase tracking-[0.3em]">{selectedToken}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[25, 50, 75, 100].map((perc) => (
                      <button
                        key={perc}
                        onClick={() => {
                          const amt = ((currentTokenData?.total || 0) * (perc / 100)).toFixed(4);
                          setWithdrawAmount(amt);
                        }}
                        className="py-1.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black text-white/30 hover:text-teal-400 transition-all"
                      >
                        {perc === 100 ? "MAX" : `${perc}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compact Confirming View */}
                {stage === "CONFIRMING" && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/10 flex items-start gap-2">
                    <Info size={12} className="text-teal-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-teal-100/40 leading-snug font-medium">
                      Zero gas fees. This withdrawal is <span className="text-teal-400">fully sponsored</span>.
                    </p>
                  </motion.div>
                )}

                {/* Error Bubble */}
                {error && stage === "INPUT" && (
                  <div className="flex items-center gap-2 text-red-400 text-[9px] font-black uppercase bg-red-400/5 p-3 rounded-xl border border-red-400/10">
                    <AlertCircle size={12} /> {error}
                  </div>
                )}

                {/* Main Action - Compressed height */}
                <div className="pt-1">
                  <ActionButton
                    onClick={handleWithdraw}
                    variant="primary"
                    className={`w-full h-11 text-[11px] font-black uppercase tracking-[0.15em] rounded-xl ${
                        stage === "CONFIRMING" ? "!bg-teal-600 !text-white" : "!bg-white !text-black"
                    }`}
                    disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || isWithdrawing}
                  >
                    {isWithdrawing ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : stage === "CONFIRMING" ? (
                      "Confirm"
                    ) : (
                      "Review"
                    )}
                  </ActionButton>
                  
                  {stage === "CONFIRMING" && !isWithdrawing && (
                    <button 
                      onClick={() => setStage("INPUT")}
                      className="w-full text-center mt-3 text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white/40 transition"
                    >
                      Edit Amount
                    </button>
                  )}
                </div>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </BottomSheet>
  );
};