"use client";

import { FC } from "react";
import { ChevronRight, Smartphone, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { BottomSheet } from "@/components/ui";

interface WithdrawActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActionSelect: (actionId: "wallet" | "offramp") => void;
}

const WithdrawActionsModal: FC<WithdrawActionsModalProps> = ({
  isOpen,
  onClose,
  onActionSelect,
}) => {
  const handleClose = () => {
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} maxHeight="max-h-[70vh]">
      <div className="relative px-5 pt-1 pb-8 text-white bg-transparent overflow-hidden">
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -20, opacity: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col items-center text-center py-2">
            <div className="text-2xl mb-3 bg-white/5 w-12 h-12 flex items-center justify-center rounded-2xl border border-white/5 shadow-inner">
              <Wallet className="w-6 h-6 text-white/70" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest">
              Withdraw Funds
            </h3>
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-tight mt-1">
              Choose your destination
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => onActionSelect("wallet")}
              className="w-full group flex items-center p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mr-4 group-hover:scale-105 transition-transform">
                <Wallet className="w-5 h-5 text-white/60" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-xs font-black text-white uppercase tracking-tight">
                  Wallet Withdrawal
                </div>
                <div className="text-[9px] text-white/30 font-bold uppercase tracking-tighter">
                  Withdraw to your onchain address
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={() => onActionSelect("offramp")}
              className="w-full group flex items-center p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mr-4 group-hover:scale-105 transition-transform">
                <Smartphone className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-xs font-black text-white uppercase tracking-tight">
                  Mobile Money
                </div>
                <div className="text-[9px] text-emerald-400/60 font-bold uppercase tracking-tighter">
                  Withdraw then send to phone
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-500/30 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </motion.div>

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

export default WithdrawActionsModal;
