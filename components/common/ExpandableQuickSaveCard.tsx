"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronUp,
  ChevronDown,
  EyeOff,
  Eye,
  Lock,
  Unlock,
} from "lucide-react";
import { theme } from "@/lib/theme";
import { CardActionButton } from "@/components/ui";

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
  onQuickSaveClick?: () => void;
  vaultPositions?: Array<{
    withdrawableAmount?: string;
    unlockTime?: number;
  }>;
  vaultPositionsLoading?: boolean;
  onRequestVaultPositions?: () => void;
}

const ExpandableQuickSaveCard = ({
  goal,
  goals,
  userPositions,
  isLoading = false,
  showBalance = true,
  onToggleBalance,
  onDeposit,
  onWithdraw,
  exchangeRate,
  onGoalsRefetch,
  onCreateGoal,
  onGoalClick,
  onQuickSaveClick,
  vaultPositions,
  vaultPositionsLoading = false,
  onRequestVaultPositions,
}: ExpandableQuickSaveCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currencyMode, setCurrencyMode] = useState<"LOCAL" | "USD">("USD");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const totalSavingsNum = Number.parseFloat(userPositions?.totalValueUSD || "0");
  const quickSaveAmountRaw = Number.parseFloat(goal?.currentAmount || "0");
  const quickSaveAmountNum =
    Number.isFinite(quickSaveAmountRaw) && quickSaveAmountRaw > 0
      ? quickSaveAmountRaw
      : totalSavingsNum;

  const getGoalAmountUsd = (goalItem: any) => {
    const directAmount = Number(goalItem?.currentAmount);
    if (Number.isFinite(directAmount) && directAmount > 0) return directAmount;

    const targetAmount = Number(goalItem?.targetAmount ?? goalItem?.targetAmountToken);
    const progressPercent = Number(goalItem?.progress ?? goalItem?.progressPercent);
    if (
      Number.isFinite(targetAmount) &&
      Number.isFinite(progressPercent) &&
      targetAmount > 0 &&
      progressPercent > 0
    ) {
      return (targetAmount * progressPercent) / 100;
    }

    return 0;
  };
  
  const hasValidExchangeRate = exchangeRate && exchangeRate > 0;
  const totalLocalAmount = hasValidExchangeRate ? totalSavingsNum * exchangeRate : 0;

  const formatCardAmount = (amountUsd: number) => {
    if (!showBalance) return "••••";
    if (currencyMode === "LOCAL" && hasValidExchangeRate) {
      return `Ksh${(amountUsd * exchangeRate!).toLocaleString("en-US", {
        maximumFractionDigits: 0,
      })}`;
    }
    return `$${amountUsd.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const primaryAmount = currencyMode === "LOCAL" && hasValidExchangeRate
      ? `Ksh${totalLocalAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : `$${totalSavingsNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const lockSummary = useMemo(() => {
    if (!vaultPositions || vaultPositions.length === 0) return null;
    let available = 0;
    let locked = 0;
    let nextUnlock: number | null = null;

    vaultPositions.forEach((position) => {
      const withdrawableRaw = Number(position.withdrawableAmount || 0);
      const amountRaw = Number(position.amount || 0);
      const unlockTimeRaw = Number(position.unlockTime || 0);
      const withdrawable = Number.isFinite(withdrawableRaw) ? withdrawableRaw : 0;
      const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
      const unlockTime = Number.isFinite(unlockTimeRaw) ? unlockTimeRaw : 0;

      if (withdrawable > 0) {
        available += withdrawable;
      } else {
        locked += amount;
        if (unlockTime > 0 && unlockTime > now) {
          nextUnlock = nextUnlock ? Math.min(nextUnlock, unlockTime) : unlockTime;
        }
      }
    });

    return {
      available,
      locked,
      nextUnlock,
      status: locked > 0 ? "locked" as const : "unlocked" as const,
    };
  }, [vaultPositions, now]);

  const countdownLabel = useMemo(() => {
    if (!lockSummary?.nextUnlock) return null;
    const diffMs = Math.max(0, lockSummary.nextUnlock - now);
    const totalMinutes = Math.ceil(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, [lockSummary?.nextUnlock, now]);

  useEffect(() => {
    if (totalSavingsNum <= 0) return;
    if (!onRequestVaultPositions) return;
    if (vaultPositionsLoading) return;
    if (vaultPositions && vaultPositions.length > 0) return;
    onRequestVaultPositions();
  }, [
    totalSavingsNum,
    onRequestVaultPositions,
    vaultPositions,
    vaultPositionsLoading,
  ]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

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

        {/* Main Action Buttons */}
        <div className="flex gap-3">
          <CardActionButton onClick={onDeposit} className="flex-1">
            <ArrowDown size={18} /> Deposit
          </CardActionButton>
          <CardActionButton variant="secondary" onClick={onWithdraw} className="flex-1">
            <ArrowUp size={18} /> Withdraw
          </CardActionButton>
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
                role="button"
                tabIndex={0}
                aria-label="Open Quick Save details"
                onClick={() => {
                  if (draggedId) return;
                  if (onQuickSaveClick) return onQuickSaveClick();
                  onGoalClick?.(goal);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (draggedId) return;
                    if (onQuickSaveClick) return onQuickSaveClick();
                    onGoalClick?.(goal);
                  }
                }}
                className={`p-3 rounded-2xl flex flex-col items-center text-center cursor-pointer transition-all border ${
                  draggedId && draggedId !== goal?.id ? "border-green-400/50 bg-green-400/10 scale-105" : "bg-white/5 border-white/5 active:scale-95"
                }`}
              >
                 <span className="text-xs font-bold text-white">{formatCardAmount(quickSaveAmountNum)}</span>
                 <span className="text-[10px] opacity-50 mt-1 uppercase font-bold tracking-tighter truncate w-full">
                   Quick Save
                 </span>
              </div>
              
              {/* Other Goals (Draggable & Drop Zone) */}
              {goals.filter(g => g.category !== "quick").map((g) => {
                const goalAmountUsd = getGoalAmountUsd(g);
                return (
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
                   <span className="text-xs font-bold text-white">
                    {formatCardAmount(goalAmountUsd)}
                   </span>
                   <span className="text-[10px] opacity-50 mt-1 uppercase font-bold tracking-tighter truncate w-full">{g.title}</span>
                </div>
              )})}
              
              <button onClick={onCreateGoal} className="border border-dashed border-white/20 p-3 rounded-2xl flex flex-col items-center justify-center opacity-40 hover:opacity-100 transition">
                <span className="text-sm font-bold">+</span>
              </button>
            </div>
        </div>

        {totalSavingsNum > 0 && (
          <div className="mt-3 flex items-start gap-2 text-[11px] text-white/60">
            {lockSummary?.status === "locked" || vaultPositionsLoading ? (
              <Lock size={12} className="mt-0.5" />
            ) : (
              <Unlock size={12} className="mt-0.5" />
            )}
            <div className="space-y-1">
              {vaultPositionsLoading || !lockSummary ? (
                <span>Checking lock status...</span>
              ) : (
                <>
                  <span>
                    Available {formatCardAmount(lockSummary.available)} • Locked{" "}
                    {formatCardAmount(lockSummary.locked)}
                  </span>
                  {lockSummary.locked > 0 && countdownLabel && (
                    <span className="text-white/40">
                      Unlocks in {countdownLabel}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

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
