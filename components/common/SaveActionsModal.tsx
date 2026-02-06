"use client";
import { FC, useMemo, useState } from "react";
import {
  ChevronRight,
  Smartphone,
  Copy,
  Check,
  Info,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BottomSheet } from "@/components/ui";
import { CHAINS, TOKENS } from "@/config/chainConfig";
import { useChain } from "@/components/ChainProvider";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";

interface SaveActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActionSelect: (actionId: string) => void;
}

const SaveActionsModal: FC<SaveActionsModalProps> = ({
  isOpen,
  onClose,
  onActionSelect,
}) => {
  const { chain, setChain } = useChain();
  const account = useActiveAccount();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const availableChains = useMemo(
    () => CHAINS.filter((candidate) => TOKENS[candidate.id as keyof typeof TOKENS]),
    []
  );

  const currentChainData = useMemo(() => {
    if (!chain?.id) return { tokens: [], name: "Unknown Network" };
    const tokens = TOKENS[chain.id as keyof typeof TOKENS] || [];
    const name = chain.name.charAt(0).toUpperCase() + chain.name.slice(1);
    return { tokens, name };
  }, [chain]);

  const usdcInfo = useMemo(
    () => currentChainData.tokens.find((t) => t.symbol === "USDC"),
    [currentChainData]
  );

  const handleCopyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address);
      setCopied(true);
      toast.success("Address copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Reset state when closing
  const handleClose = () => {
    setShowGuide(false);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} maxHeight="max-h-[70vh]">
      <div className="relative px-5 pt-1 pb-8 text-white bg-transparent overflow-hidden">
        <AnimatePresence mode="wait">
          {!showGuide ? (
            /* MAIN SELECTION VIEW */
            <motion.div
              key="selection"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center text-center py-2">
                <div className="text-2xl mb-3 bg-white/5 w-12 h-12 flex items-center justify-center rounded-2xl border border-white/5 shadow-inner">
                  <img
                    src={usdcInfo?.icon}
                    className="w-8 h-8 object-contain"
                    alt="USDC"
                  />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">
                  Add Funds
                </h3>
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-tight mt-1">
                  Select your preferred method
                </p>
              </div>

              {availableChains.length > 1 && (
                <div className="flex justify-center">
                  <div className="flex items-center gap-1 rounded-full bg-white/5 p-1">
                    {availableChains.map((candidate) => {
                      const isActive = candidate.id === chain.id;
                      return (
                        <button
                          key={candidate.id}
                          onClick={() => setChain(candidate)}
                          className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition ${
                            isActive
                              ? "bg-teal-500 text-black"
                              : "text-white/40 hover:text-white/70"
                          }`}
                        >
                          {candidate.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => onActionSelect("onramp")}
                  className="w-full group flex items-center p-4 rounded-2xl bg-teal-500/5 border border-teal-500/10 hover:bg-teal-500/10 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center mr-4 group-hover:scale-105 transition-transform">
                    <Smartphone className="w-5 h-5 text-teal-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-xs font-black text-white uppercase tracking-tight">
                      Mobile Money
                    </div>
                    <div className="text-[9px] text-teal-400/60 font-bold uppercase tracking-tighter">
                      Instant M-Pesa / Airtel Money
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-teal-500/30 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
                </button>

                <button
                  onClick={() => setShowGuide(true)}
                  className="w-full group flex items-center p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mr-4 group-hover:scale-105 transition-transform">
                    <img
                      src={usdcInfo?.icon}
                      className="w-6 h-6 object-contain opacity-50 group-hover:opacity-100 transition-opacity"
                      alt="USDC"
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-xs font-black text-white uppercase tracking-tight">
                      Crypto Transfer
                    </div>
                    <div className="text-[9px] text-white/30 font-bold uppercase tracking-tighter">
                      Deposit from an external wallet
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            </motion.div>
          ) : (
            /* MANUAL GUIDE VIEW */
            <motion.div
              key="guide"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="space-y-5"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowGuide(false)}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                {availableChains.length > 1 ? (
                  <div className="flex items-center gap-1 rounded-full bg-white/5 p-1">
                    {availableChains.map((candidate) => {
                      const isActive = candidate.id === chain.id;
                      return (
                        <button
                          key={candidate.id}
                          onClick={() => setChain(candidate)}
                          className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition ${
                            isActive
                              ? "bg-teal-500 text-black"
                              : "text-white/40 hover:text-white/70"
                          }`}
                        >
                          {candidate.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                    <span className="text-[9px] font-black text-teal-400 uppercase">
                      {currentChainData.name}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 space-y-6">
                <div className="space-y-3">
                  <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest px-1">
                    1. Supported Assets
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {currentChainData.tokens.map((token) => (
                      <div
                        key={token.address}
                        className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl"
                      >
                        <img
                          src={token.icon}
                          className="w-3.5 h-3.5 rounded-full"
                          alt={token.symbol}
                        />
                        <span className="text-[10px] font-black text-white/80">
                          {token.symbol}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest px-1">
                    2. Receiving Address
                  </p>
                  <button
                    onClick={handleCopyAddress}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-teal-500/5 border border-teal-500/10 hover:border-teal-400/40 transition-all group active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="w-9 h-9 shrink-0 rounded-xl bg-teal-400/10 flex items-center justify-center group-hover:bg-teal-400/20 transition-colors">
                        <Copy className="w-4 h-4 text-teal-400" />
                      </div>
                      <div className="text-left overflow-hidden">
                        <p className="text-[8px] font-black text-teal-400/60 uppercase tracking-widest mb-0.5">
                          Tap to copy
                        </p>
                        <p className="text-[11px] text-white font-bold font-mono truncate">
                          {account?.address}
                        </p>
                      </div>
                    </div>
                    <AnimatePresence mode="wait">
                      {copied ? (
                        <motion.div
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0.5 }}
                        >
                          <Check className="w-5 h-5 text-teal-400" />
                        </motion.div>
                      ) : (
                        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4 text-white/20" />
                        </div>
                      )}
                    </AnimatePresence>
                  </button>
                </div>

                <div className="flex gap-3 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10">
                  <Info size={16} className="text-orange-400 shrink-0 mt-0.5" />
                  <p className="text-[9px] leading-relaxed text-orange-200/50 font-bold uppercase tracking-tight">
                    Ensure you send funds via the{" "}
                    <span className="text-orange-400">
                      {currentChainData.name} Network
                    </span>{" "}
                    only. Other networks will result in permanent loss.
                  </p>
                </div>
              </div>
              <div className="pt-4 space-y-3">
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest text-center">
                  Funds arrived?
                </p>

                <button
                  onClick={() => {
                    // 1. Trigger the amount input view
                    onActionSelect("onchain");
                    // 2. Provide feedback
                    toast.info("Opening deposit keypad");
                  }}
                  className="w-full py-4 rounded-2xl bg-teal-500 text-black font-black uppercase tracking-widest text-xs hover:bg-teal-400 transition-colors shadow-lg shadow-teal-500/20"
                >
                  Proceed to Deposit
                </button>

                <p className="text-[9px] text-white/20 font-medium text-center px-4 leading-tight">
                  After your transfer is confirmed on-chain, click above to
                  choose how much to move into your savings.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleClose}
          className="w-full mt-6 py-2 text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white/40 transition-colors"
        >
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
};

export default SaveActionsModal;
