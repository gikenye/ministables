"use client";
import React, { useMemo, useState, useEffect } from "react";
import { motion, PanInfo, useAnimation } from "framer-motion";
import { BottomSheet, ActionButton } from "@/components/ui";

const KES_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"];
const DECIMAL_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

export const AmountInputModal = ({
  isOpen,
  onClose,
  onContinue,
  title = "HOW MUCH DO YOU WANT TO SAVE?",
  initialAmount = "100",
  currency = "KES",
  allowDecimal = false,
  tokenBalances = [],
  selectedToken = null,
  onTokenSelect,
  balancesLoading = false,
}: any) => {
  const [amount, setAmount] = useState(initialAmount);
  const controls = useAnimation();
  const keys = allowDecimal ? DECIMAL_KEYS : KES_KEYS;
  const displayAmount = useMemo(() => {
    if (!allowDecimal) {
      return Number(amount).toLocaleString();
    }

    if (!amount) return "0";
    const hasTrailingDot = amount.endsWith(".");
    const [whole, decimals = ""] = amount.split(".");
    const formattedWhole = Number(whole || "0").toLocaleString();

    if (hasTrailingDot) {
      return `${formattedWhole}.`;
    }

    if (amount.includes(".")) {
      return `${formattedWhole}.${decimals}`;
    }

    return formattedWhole;
  }, [amount, allowDecimal]);
  const numericAmount = Number.parseFloat(amount);
  const isValidAmount = Number.isFinite(numericAmount) && numericAmount > 0;

  useEffect(() => { 
    if (isOpen) {
      setAmount(initialAmount);
      // Ensure the motion div is reset to its base state when opening
      controls.set({ y: 0 });
    } 
  }, [isOpen, initialAmount, controls]);

  const handlePress = (key: string) => {
    setAmount((prev) => {
      if (key === "⌫") {
        return prev.length <= 1 ? "0" : prev.slice(0, -1);
      }

      if (key === ".") {
        if (!allowDecimal || prev.includes(".")) return prev;
        return `${prev}.`;
      }

      const next = prev === "0" ? key : `${prev}${key}`;

      if (!allowDecimal && next.length > 9) {
        return prev;
      }

      if (allowDecimal) {
        const [whole, decimals = ""] = next.split(".");
        if (whole.length > 9 || decimals.length > 6) {
          return prev;
        }
      }

      return next;
    });
  };

  const formatBalance = (balance: number) =>
    balance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });

  const onDragEnd = (_: any, info: PanInfo) => {
    // If user swipes down fast or far enough, close the modal
    if (info.offset.y > 150 || info.velocity.y > 600) {
      onClose();
    } else {
      // Recoil effect: Snaps back to position if drag wasn't enough to close
      controls.start({ y: 0, transition: { type: "spring", damping: 25, stiffness: 500 } });
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[80vh]">
      <motion.div 
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.15}
        onDragEnd={onDragEnd}
        animate={controls}
        // STABILIZATION: Lock these properties to prevent mirroring/flipping
        style={{ x: 0, scaleX: 1, touchAction: "none" }}
        className="flex flex-col bg-transparent px-5 pb-8 space-y-4"
      >
        {/* Compressed Header Display */}
        <div className="text-center py-2">
          <p className="font-black text-[#0d9488] uppercase tracking-[0.2em] text-[9px] mb-1">
            {title}
          </p>
          <div className="flex items-baseline justify-center tracking-tighter">
            <span className="text-base font-black text-[#0d9488] mr-1.5 uppercase">
              {currency}
            </span>
            <motion.span 
              key={amount}
              initial={{ scale: 1.05, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.1 }}
              className="text-3xl font-black text-white truncate"
            >
              {displayAmount}
            </motion.span>
          </div>
        </div>

        {(balancesLoading || tokenBalances.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                Wallet balance
              </p>
              {balancesLoading && (
                <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                  Loading...
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {tokenBalances.map((token: any) => {
                const isSelected = selectedToken?.address === token.address;
                return (
                  <button
                    key={token.address}
                    type="button"
                    onClick={() => onTokenSelect?.(token)}
                    className={`px-3 py-2 rounded-xl border text-left transition-colors ${
                      isSelected
                        ? "bg-teal-500/20 border-teal-400/40 text-teal-200"
                        : "bg-white/[0.03] border-white/10 text-white/70 hover:border-white/20"
                    }`}
                  >
                    <div className="text-[10px] font-black uppercase tracking-wide">
                      {token.symbol}
                    </div>
                    <div className="text-[9px] font-bold text-white/50">
                      ${formatBalance(Number(token.balance || 0))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Compact Keypad Grid */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {keys.map((key) => (
            <motion.button
              key={key}
              // Motion: High-response "Haptic" tap effect
              whileTap={{ 
                scale: 0.92, 
                backgroundColor: "rgba(13, 148, 136, 0.15)",
                transition: { duration: 0.05 } 
              }}
              onClick={() => handlePress(key)}
              // Prevents the tap from being interpreted as a drag start
              onPointerDown={(e) => e.stopPropagation()}
              className="py-3 rounded-xl bg-white/[0.03] border border-white/5 text-s font-bold text-white flex items-center justify-center transition-colors active:border-[#0d9488]/40 shadow-sm"
            >
              {key}
            </motion.button>
          ))}
        </div>

        {/* Compact Action Button */}
        <div className="pt-2">
          <ActionButton
            onClick={() => {
              if (!isValidAmount) return;
              onContinue(amount);
            }}
            disabled={!isValidAmount}
            className="w-full h-10 bg-[#0d9488] rounded-xl text-white font-black text-sm tracking-[0.2em] shadow-lg active:scale-[0.5] transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            CONTINUE
          </ActionButton>
        </div>
      </motion.div>
    </BottomSheet>
  );
};
