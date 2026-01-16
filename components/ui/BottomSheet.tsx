"use client";
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { theme } from "@/lib/theme";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string;
}

export const BottomSheet = ({
  isOpen,
  onClose,
  children,
  maxHeight = "max-h-[90vh]",
}: BottomSheetProps) => {
  
  // Improved Scroll Lock: Prevents layout shift (the jump)
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      document.body.style.overflow = 'hidden';
      // Add padding to replace scrollbar width so content doesn't "jump"
      document.body.style.paddingRight = `${scrollBarWidth}px`;
      
      return () => {
        document.body.style.overflow = originalStyle;
        document.body.style.paddingRight = '0px';
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop: Use simple opacity for stability */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60" 
            onClick={onClose} 
          />
          
          <motion.div
            // Use 'y: "100%"' and a specific spring to avoid fighting with internal layout animations
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            // Damping 40/Stiffness 400 is the "Rainbow Wallet" signature feel: snappy but heavy
            transition={{ type: "spring", damping: 40, stiffness: 400, mass: 0.8 }}
            className={`relative w-full max-w-lg rounded-t-[32px] border-t border-white/10 shadow-2xl flex flex-col will-change-transform ${maxHeight}`}
            style={{ 
              backgroundColor: '#22302bff',
              backgroundImage: `linear-gradient(to bottom right, ${theme.colors.cardGradientFrom}40, ${theme.colors.cardGradientTo}10)`,
              // This prevents the "halo" or flickering during the slide animation
              backfaceVisibility: "hidden",
              transformStyle: "preserve-3d"
            }}
          >
            {/* Elegant Grab Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1.5 rounded-full bg-white/10" />
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};