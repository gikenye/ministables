"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronUp,
  ChevronDown,
  EyeOff,
  Eye,
} from "lucide-react";
import { theme } from "@/lib/theme";

interface ExpandableQuickSaveCardProps {
  goal: any;
  goals: any[];
  userPositions?: any;
  account?: any;
  isLoading?: boolean;
  showBalance?: boolean;
  onToggleBalance?: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  defaultToken?: any;
  exchangeRate?: number;
  onGoalsRefetch?: () => void;
  onCreateGoal?: () => void;
  onGoalClick?: (goal: any) => void;
}

const ExpandableQuickSaveCard = ({
  goal,
  goals,
  userPositions,
  account,
  isLoading = false,
  showBalance = true,
  onToggleBalance,
  onDeposit,
  onWithdraw,
  exchangeRate,
  onGoalsRefetch,
  onCreateGoal,
  onGoalClick,
}: ExpandableQuickSaveCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currencyMode, setCurrencyMode] = useState<"LOCAL" | "USD">("USD");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const totalSavingsNum = Number.parseFloat(userPositions?.totalValueUSD || "0");
  const quickSaveAmountNum = Number.parseFloat(goal?.currentAmount || "0");
  
  const hasValidExchangeRate = exchangeRate && exchangeRate > 0;
  const totalLocalAmount = hasValidExchangeRate ? totalSavingsNum * exchangeRate : 0;

  const primaryAmount = currencyMode === "LOCAL" && hasValidExchangeRate
      ? `Ksh${totalLocalAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : `$${totalSavingsNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleGoalDrop = async (draggedGoalId: string, targetGoalId: string) => {
    if (draggedGoalId === targetGoalId) return;
    
    setIsTransferring(true);
    try {
      /**
       * TODO: Implement actual API call to combine/transfer goals
       * 1. Call your backend to move funds from source to target.
       * 2. Wait for blockchain confirmation if necessary.
       */
      console.log(`Combining goal ${draggedGoalId} into ${targetGoalId}`);
      
      // Simulated delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (onGoalsRefetch) onGoalsRefetch();
    } catch (error) {
      console.error("Failed to combine goals:", error);
    } finally {
      setIsTransferring(false);
      setDraggedId(null);
    }
  };

  return (
    <div className="relative w-full max-w-xl mx-auto px-1">
      <div
        className="rounded-[2.5rem] p-6 text-white shadow-2xl border border-white/5 overflow-hidden transition-all duration-500"
        style={{
          backgroundImage: `linear-gradient(to bottom right, ${theme.colors.cardGradientFrom}, ${theme.colors.cardGradientTo})`,
        }}
      >
        {/* Balance Display */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-60">Total Savings</p>
            <h2 className="text-3xl font-bold mt-1 tracking-tight">
              {showBalance ? primaryAmount : "••••••"}
            </h2>
          </div>
          <button 
            onClick={() => setCurrencyMode(prev => prev === "USD" ? "LOCAL" : "USD")}
            className="px-2.5 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10"
          >
            {currencyMode}
          </button>
        </div>

        {/* Main Action Buttons - Reduced height/size */}
        <div className="flex gap-3">
          <button 
            onClick={onDeposit} 
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-black rounded-xl text-sm font-bold transition active:scale-95 shadow-lg"
          >
            <ArrowDown size={18} /> Deposit
          </button>
          <button 
            onClick={onWithdraw} 
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition active:scale-95"
          >
            <ArrowUp size={18} /> Withdraw
          </button>
        </div>

        {/* Collapsible Goals Grid */}
        <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? "max-h-[500px] mt-6 opacity-100" : "max-h-0 opacity-0"}`}>
            {isTransferring && (
              <div className="flex items-center justify-center mb-4 gap-2 animate-pulse">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" />
                <span className="text-[10px] font-bold uppercase text-green-400">Merging Goals...</span>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-3 mb-2">
              {/* Quick Save Card (Drop Zone) */}
              <div 
                draggable
                onDragStart={() => setDraggedId(goal?.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedId && draggedId !== goal?.id) handleGoalDrop(draggedId, goal?.id);
                }}
                className={`p-3 rounded-2xl flex flex-col items-center text-center transition-all border ${
                  draggedId && draggedId !== goal?.id ? "border-green-400/50 bg-green-400/10 scale-105" : "bg-white/5 border-white/5"
                }`}
              >
                 <span className="text-xs font-bold text-[#4ade80]">${quickSaveAmountNum.toFixed(2)}</span>
                 <span className="text-[10px] opacity-50 mt-1 uppercase font-bold tracking-tighter">Quick Save</span>
              </div>
              
              {/* Other Goals (Draggable & Drop Zone) */}
              {goals.filter(g => g.category !== "quick").map((g) => (
                <div 
                  key={g.id} 
                  draggable
                  onDragStart={() => setDraggedId(g.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedId && draggedId !== g.id) handleGoalDrop(draggedId, g.id);
                  }}
                  onClick={() => !draggedId && onGoalClick?.(g)} 
                  className={`p-3 rounded-2xl flex flex-col items-center text-center cursor-pointer transition-all border ${
                    draggedId && draggedId !== g.id ? "border-green-400/50 bg-green-400/10 scale-105" : "bg-white/5 border-white/5 active:scale-95"
                  }`}
                >
                   <span className="text-xs font-bold text-white">${Number(g.currentAmount).toFixed(0)}</span>
                   <span className="text-[10px] opacity-50 mt-1 uppercase font-bold tracking-tighter truncate w-full">{g.title}</span>
                </div>
              ))}
              
              <button onClick={onCreateGoal} className="border border-dashed border-white/20 p-3 rounded-2xl flex flex-col items-center justify-center opacity-40 hover:opacity-100 transition">
                <span className="text-sm font-bold">+</span>
              </button>
            </div>
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/5">
          <button onClick={onToggleBalance} className="p-1 opacity-40 hover:opacity-100 transition">
            {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            {isExpanded ? "Close" : "My Goals"}
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpandableQuickSaveCard;