"use client";
import React, { useState } from "react";
import { BottomSheet, CardActionButton } from "@/components/ui";
import { Plus, Minus, Share2, Trash2, ArrowRightLeft, Loader2 } from "lucide-react";

export const GoalDetailsModal = ({
  isOpen, onClose, onSaveNow, goal, showBalance, exchangeRate, onDeleteGoal, isDeleteLoading
}: any) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const current = Number(goal?.currentAmount) || 0;
  const target = Number(goal?.targetAmount) || 0;
  const progress = target > 0 ? (current / target) * 100 : 0;

  React.useEffect(() => {
    if (!isOpen) setIsDeleting(false);
  }, [isOpen]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Saving for ${goal.title}`,
          text: `I've reached ${progress.toFixed(0)}% of my goal!`,
          url: window.location.href,
        });
      } catch (err) { console.error(err); }
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[650px]">
      <div className="p-6 flex flex-col h-full bg-transparent">
        <header className="mb-8 flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4ade80] mb-1">Goal Management</p>
            <h2 className="text-2xl font-bold text-white tracking-tight">{goal?.title}</h2>
          </div>
          <div className="text-right">
             <p className="text-2xl font-black text-white">{progress.toFixed(0)}%</p>
             <p className="text-[10px] font-bold text-white/30 uppercase">Progress</p>
          </div>
        </header>

        {/* Deposit/Withdraw Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <CardActionButton
            onClick={() => onSaveNow("deposit")}
            disabled={isDeleteLoading}
            className="flex-1"
          >
            <Plus size={18} /> Deposit
          </CardActionButton>
          <CardActionButton
            variant="secondary"
            onClick={() => onSaveNow("withdraw")}
            disabled={isDeleteLoading}
            className="flex-1"
          >
            <Minus size={18} /> Withdraw
          </CardActionButton>
        </div>

        {/* Management Grid */}
        <div className="grid grid-cols-2 gap-3 mb-10">
          <button 
            onClick={handleShare}
            disabled={isDeleteLoading}
            className="flex items-center justify-center gap-2 p-4 bg-white/[0.03] border border-white/5 rounded-2xl text-white/60 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Share2 size={16} /> Share
          </button>
          
          <div className="relative group">
            <button disabled className="w-full flex items-center justify-center gap-2 p-4 bg-white/[0.01] border border-white/5 rounded-2xl text-white/20 text-[10px] font-bold uppercase tracking-widest cursor-not-allowed">
              <ArrowRightLeft size={16} /> Transfer
            </button>
            <div className="absolute -top-2 right-2 bg-[#4ade80] text-[8px] text-black px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter shadow-lg">Soon</div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-auto pt-6 border-t border-white/5">
          {!isDeleting ? (
            <button 
              onClick={() => setIsDeleting(true)}
              disabled={isDeleteLoading}
              className="w-full py-3 bg-red-500/20 border border-red-500/10 text-red-500/60 hover:text-red-500 hover:bg-red-500/20 text-[10px] font-bold uppercase tracking-[0.2em] transition rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} /> Delete Savings Goal
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[10px] text-red-500 font-bold text-center uppercase">Confirm permanent deletion?</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => !isDeleteLoading && setIsDeleting(false)} 
                  disabled={isDeleteLoading} 
                  className="flex-1 py-3 text-white/40 text-xs font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => onDeleteGoal(goal.metaGoalId)} 
                  disabled={isDeleteLoading}
                  className="flex-1 py-3 bg-red-500/20 text-red-500 rounded-xl text-xs font-bold uppercase disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleteLoading ? <><Loader2 size={14} className="animate-spin" /> Deleting...</> : "Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
