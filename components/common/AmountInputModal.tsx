"use client";
import React, { useState, useEffect } from "react";
import { motion, PanInfo, useAnimation } from "framer-motion";
import { BottomSheet, ActionButton } from "@/components/ui";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"];

export const AmountInputModal = ({
  isOpen, onClose, onContinue, title = "HOW MUCH DO YOU WANT TO SAVE?", initialAmount = "100", currency = "KES"
}: any) => {
  const [amount, setAmount] = useState(initialAmount);
  const controls = useAnimation();

  useEffect(() => { 
    if (isOpen) {
      setAmount(initialAmount);
      // Ensure the motion div is reset to its base state when opening
      controls.set({ y: 0 });
    } 
  }, [isOpen, initialAmount, controls]);

  const handlePress = (num: string) => {
    if (num === "⌫") setAmount(prev => prev.length <= 1 ? "0" : prev.slice(0, -1));
    else if (amount.length < 9) setAmount(prev => prev === "0" ? num : prev + num);
  };

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
              {Number(amount).toLocaleString()}
            </motion.span>
          </div>
        </div>

        {/* Compact Keypad Grid */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {KEYS.map(key => (
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
            onClick={() => onContinue(amount)} 
            className="w-full h-10 bg-[#0d9488] rounded-xl text-white font-black text-sm tracking-[0.2em] shadow-lg active:scale-[0.5] transition-all"
          >
            CONTINUE
          </ActionButton>
        </div>
      </motion.div>
    </BottomSheet>
  );
};