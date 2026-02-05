"use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, ArrowRightLeft, ArrowUpRight, MessageCircle,Share2, Users } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ActionButton, BottomSheet } from "@/components/ui";
import { GroupSavingsGoal } from "@/lib/services/backendApiService";
import { formatUsdFromKes } from "@/lib/utils";

interface JoinGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: GroupSavingsGoal | null;
  onJoin: (amount: string) => void;
  isLoading?: boolean;
  error?: string | null;
  exchangeRate?: number;
}

export const JoinGoalModal: React.FC<JoinGoalModalProps> = ({
  isOpen, onClose, goal, onJoin, isLoading, exchangeRate,
}) => {
  const [amount, setAmount] = useState("1000");
  const depositUsd = useMemo(
    () => (exchangeRate ? parseFloat(amount) / exchangeRate : 0),
    [amount, exchangeRate]
  );

  if (!goal) return null;

  const current = goal.totalProgressUSD ?? 0;
  const target = goal.targetAmountToken ?? 1;
  const progress = (current / target) * 100;
  
  const newProgress = Math.min(((current + (isNaN(depositUsd) ? 0 : depositUsd)) / target) * 100, 100);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[92vh]">
      <div className="px-6 pb-12 pt-2 text-white">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-xl font-black shadow-lg shadow-emerald-900/20">
            {goal.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tighter leading-tight">{goal.name}</h2>
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-[9px] font-black uppercase text-white/40 tracking-widest border border-white/5">
              {goal.isPublic ? "Public Goal" : "Private Clan"}
            </span>
          </div>
        </div>

        {/* Prediction Progress Bar */}
        <div className="bg-black/20 rounded-[28px] p-5 mb-8 border border-white/5">
          <div className="flex justify-between items-end mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">New Progress Prediction</p>
            <p className="text-xl font-black text-emerald-400">{newProgress.toFixed(0)}%</p>
          </div>
          <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden relative">
            <div className="absolute inset-0 bg-white/10" style={{ width: `${progress}%` }} />
            <motion.div 
              initial={{ width: `${progress}%` }}
              animate={{ width: `${newProgress}%` }}
              className="h-full bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)]" 
            />
          </div>
        </div>

        <div className="space-y-6 text-center">
          <div>
            <input
              type="number"
              className="w-full bg-transparent text-center text-6xl font-black placeholder:text-white/5 focus:outline-none"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
            />
            <p className="mt-2 text-sm font-black text-white/20 uppercase tracking-[0.3em]">KES Amount</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {["1k", "5k", "10k"].map((v, i) => {
               const vals = ["1000", "5000", "10000"];
               return (
                <button key={v} onClick={() => setAmount(vals[i])} className="py-3 bg-white/5 rounded-xl font-black text-white/40 active:bg-white active:text-black transition-all">
                  {v}
                </button>
               );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-10">
          <button 
            onClick={() => onJoin(amount)}
            disabled={isLoading || !amount || parseFloat(amount) <= 0}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-[28px] bg-white text-black font-black active:scale-95 transition-all disabled:opacity-20 shadow-xl"
          >
            <ArrowUpRight strokeWidth={3} size={24} />
            Deposit
          </button>
          
          <div className="relative flex flex-col items-center justify-center gap-2 p-6 rounded-[28px] bg-white/5 text-white/10 font-black border border-white/5 cursor-not-allowed">
            <ArrowRightLeft size={24} />
            Transfer
            <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase">Soon</span>
          </div>
        </div>

        <div className="flex justify-center gap-6 mt-6">
          <button className="flex items-center gap-2 text-[10px] font-black uppercase text-white/30 tracking-widest active:text-white transition-colors">
            <Share2 size={14} /> Invite
          </button>
          <button className="flex items-center gap-2 text-[10px] font-black uppercase text-white/30 tracking-widest active:text-white transition-colors">
            <MessageCircle size={14} /> Chat
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};

export default JoinGoalModal;
