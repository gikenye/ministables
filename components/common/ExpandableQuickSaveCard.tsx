"use client";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronUp,
  ChevronDown,
  EyeOff,
  Eye,
  MoveRight,
} from "lucide-react";
import {
  reportError,
  reportWarning,
  reportInfo,
} from "@/lib/services/errorReportingService";
import { getTokenInfo as getChainTokenInfo } from "@/config/chainConfig";
import { theme } from "@/lib/theme";

interface ExpandableQuickSaveCardProps {
  goal: any;
  goals: any[];
  userPositions?: any;
  account?: any;
  user?: any;
  isLoading?: boolean;
  showBalance?: boolean;
  onToggleBalance?: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  defaultToken?: any;
  chain?: any;
  tokenInfo?: any;
  exchangeRate?: number;
  onGoalsRefetch?: () => void;
  sendTransaction?: any;
}

const ExpandableQuickSaveCard = ({
  goal,
  goals,
  userPositions,
  account,
  user,
  isLoading = false,
  showBalance = true,
  onToggleBalance,
  onDeposit,
  onWithdraw,
  defaultToken,
  chain,
  tokenInfo,
  exchangeRate,
  onGoalsRefetch,
  sendTransaction,
}: ExpandableQuickSaveCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currencyMode, setCurrencyMode] = useState<"LOCAL" | "USD">("USD");
  const [selectedGoalForTransfer, setSelectedGoalForTransfer] = useState<
    string | null
  >(null);

  const totalSavingsNum = Number.parseFloat(
    userPositions?.totalValueUSD || "0"
  );
  const quickSaveAmountNum = Number.parseFloat(goal?.currentAmount || "0");
  const tokenSymbol = defaultToken?.symbol || "USDC";

  const hasValidExchangeRate = exchangeRate && exchangeRate > 0;
  const totalLocalAmount = hasValidExchangeRate
    ? totalSavingsNum * exchangeRate
    : 0;

  const primaryAmount =
    currencyMode === "LOCAL" && hasValidExchangeRate
      ? `Ksh${totalLocalAmount.toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })}`
      : `$${totalSavingsNum.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  const secondaryAmount =
    currencyMode === "LOCAL" && hasValidExchangeRate
      ? `≈ $${totalSavingsNum.toFixed(2)} ${tokenSymbol}`
      : hasValidExchangeRate
      ? `≈ Ksh${totalLocalAmount.toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })}`
      : `≈ $${totalSavingsNum.toFixed(2)} ${tokenSymbol}`;

  const handleCurrencyToggle = () => {
    if (currencyMode === "USD" && !hasValidExchangeRate) {
      return;
    }
    setCurrencyMode((curr) => (curr === "LOCAL" ? "USD" : "LOCAL"));
  };

  const handleTransferFunds = async (targetGoalId: string) => {
    if (!user?.address || !goal?.id) {
      reportError("Missing user ID or Quick Save goal ID", {
        component: "ExpandableQuickSaveCard",
        operation: "handleTransferFunds",
        userId: user?.address,
      });
      return;
    }

    const quickSaveAmount = Number.parseFloat(goal?.currentAmount || "0");
    if (quickSaveAmount <= 0) {
      reportWarning("No funds available in Quick Save to transfer", {
        component: "ExpandableQuickSaveCard",
        operation: "handleTransferFunds",
        userId: user?.address,
      });
      return;
    }

    try {
      const prepareResponse = await fetch(
        `/api/goals/transfer-production/prepare?userId=${user.address}&fromGoalId=${goal.id}`
      );

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || "Failed to prepare transfer");
      }

      const prepareData = await prepareResponse.json();

      if (
        !prepareData.availableDeposits ||
        prepareData.availableDeposits.length === 0
      ) {
        reportWarning(
          "No blockchain deposits available to transfer. Please ensure your deposits are properly synced.",
          {
            component: "ExpandableQuickSaveCard",
            operation: "handleTransferFunds",
            userId: user?.address,
          }
        );
        return;
      }

      const selectedDeposit = prepareData.availableDeposits[0];

      const transferResponse = await fetch("/api/goals/transfer-production", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.address,
          fromGoalId: goal.id,
          toGoalId: targetGoalId,
          depositId: selectedDeposit.depositId,
          sendTransaction: sendTransaction,
        }),
      });

      if (!transferResponse.ok) {
        const errorData = await transferResponse.json();
        throw new Error(errorData.error || "Blockchain transfer failed");
      }

      const transferResult = await transferResponse.json();

      if (onGoalsRefetch) {
        onGoalsRefetch();
      }

      reportInfo(
        `Successfully transferred deposit ${transferResult.transferredDepositId} to target goal`,
        {
          component: "ExpandableQuickSaveCard",
          operation: "handleTransferFunds",
          transactionHash: transferResult.blockchainTransactionHash,
        }
      );

      setSelectedGoalForTransfer(null);
    } catch (error) {
      reportError("Failed to transfer funds", {
        component: "ExpandableQuickSaveCard",
        operation: "handleTransferFunds",
        userId: user?.address,
        additional: { error },
      });
    }
  };

  const getTokenLogoUrl = () => {
    if (defaultToken?.logoUrl) return defaultToken.logoUrl;
    if (defaultToken?.image) return defaultToken.image;
    if (defaultToken?.icon) return defaultToken.icon;
    if (tokenInfo?.icon) return tokenInfo.icon;

    if (chain?.id && defaultToken?.address) {
      try {
        const chainTokenInfo = getChainTokenInfo(
          chain.id,
          defaultToken.address
        );
        if (chainTokenInfo?.icon) return chainTokenInfo.icon;
      } catch (error) {
        console.warn("Could not get token info from chainConfig:", error);
      }
    }

    return "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png";
  };

  const COLLAPSED_MAX = 280;
  const EXPANDED_MAX = 520;
  const PAGE_SIZE = 4;

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeGoal, setActiveGoal] = useState(null);
  const [draggedId, setDraggedId] = useState(null);

  return (
    <div className="relative w-full max-w-xl mx-auto px-3 sm:px-0">
      {/* Main Card */}
      <div
        className="rounded-2xl p-5 text-white shadow-lg"
        style={{
          backgroundImage: `linear-gradient(to bottom right, ${theme.colors.cardGradientFrom}, ${theme.colors.cardGradientTo})`,
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <p
              className="text-sm font-medium"
              style={{ color: theme.colors.cardTextSecondary }}
            >
              Total Savings
            </p>

            <div className="flex items-end gap-2 mt-1">
              <span className="text-3xl font-bold leading-none">
                {!account
                  ? "0"
                  : isLoading
                  ? "Loading..."
                  : showBalance
                  ? primaryAmount
                  : "••••"}
              </span>
            </div>

            {account && !isLoading && showBalance && (
              <div
                className="text-sm mt-1"
                style={{ color: theme.colors.cardTextSecondary }}
              >
                {secondaryAmount}
              </div>
            )}
          </div>

          {/* Currency Toggle */}
          <button
            onClick={handleCurrencyToggle}
            className="flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-sm min-h-[40px]"
            style={{ backgroundColor: theme.colors.cardButton }}
          >
            <span
              className={`text-xs font-medium ${
                currencyMode === "USD" ? "" : "opacity-60"
              }`}
              style={{ color: theme.colors.cardText }}
            >
              USD
            </span>

            <div className="relative w-10 h-5 rounded-full">
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  currencyMode === "LOCAL" ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </div>

            <span
              className={`text-xs font-medium ${
                currencyMode === "LOCAL" ? "" : "opacity-60"
              }`}
              style={{ color: theme.colors.cardText }}
            >
              KES
            </span>
          </button>
        </div>

        {/* Primary Actions */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={onDeposit}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold min-h-[44px]"
            style={{
              backgroundColor: theme.colors.cardButton,
              border: `1px solid ${theme.colors.cardButtonBorder}`,
            }}
          >
            <ArrowDown className="w-5 h-5" />
            Deposit
          </button>

          <button
            onClick={onWithdraw}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold min-h-[44px]"
            style={{
              backgroundColor: theme.colors.cardButton,
              border: `1px solid ${theme.colors.cardButtonBorder}`,
            }}
          >
            <ArrowUp className="w-5 h-5" />
            Withdraw
          </button>
        </div>

        {/* EXPANDED CONTENT (ONLY THIS IS CONSTRAINED) */}
        <div
          className={`
          transition-[max-height,opacity]
          duration-300
          ease-in-out
          overflow-hidden
          ${isExpanded ? "opacity-100" : "opacity-0"}
        `}
          style={{
            maxHeight: isExpanded ? EXPANDED_MAX : 0,
          }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-1 gap-y-1.5 auto-rows-fr">
            {/* Quick Save */}
            <div 
              draggable
              onDragStart={() => setDraggedId(goal.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedId && draggedId !== goal.id) {
                  reorderGoals(draggedId, goal.id);
                }
                setDraggedId(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setActiveGoal(goal);
              }}
              onTouchStart={() => setActiveGoal(goal)}
              className="rounded-xl aspect-square max-w-[120px] mx-auto p-4 flex flex-col items-center justify-center text-center backdrop-blur-sm transition active:scale-95 cursor-pointer" 
              style={{ backgroundColor: theme.colors.cardButton }}
            >
              <div className="font-bold" style={{ color: theme.colors.cardText }}>
                {quickSaveAmountNum < 0.01
                  ? "<0.01"
                  : `$${quickSaveAmountNum.toFixed(2)}`}
              </div>
              <div className="text-xs mt-1" style={{ color: theme.colors.cardTextSecondary }}>Quick Save</div>
            </div>

            {/* Goals */}
            {goals
              .filter((g) => g.category !== "quick")
              .slice(0, visibleCount)
              .map((goal) => {
                const amount = Number(goal.currentAmount || 0);

                return (
                  <div
                    key={goal.id}
                    draggable
                    onDragStart={() => setDraggedId(goal.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedId && draggedId !== goal.id) {
                        reorderGoals(draggedId, goal.id);
                      }
                      setDraggedId(null);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveGoal(goal);
                    }}
                    onTouchStart={() => setActiveGoal(goal)}
                    className="rounded-xl aspect-square max-w-[120px] mx-auto p-4 flex flex-col items-center justify-center text-center backdrop-blur-sm transition active:scale-95 cursor-pointer"
                    style={{ backgroundColor: theme.colors.cardButton }}
                  >
                    <div className="font-bold" style={{ color: theme.colors.cardText }}>
                      {amount < 0.01 ? "<0.01" : `$${amount.toFixed(0)}`}
                    </div>
                    <div className="text-xs mt-1 truncate w-full" style={{ color: theme.colors.cardTextSecondary }}>
                      {goal.title}
                    </div>
                  </div>
                );
              })}

            {goals.length < 6 && (
              <button className="aspect-square max-w-[120px] mx-auto rounded-xl border border-dashed backdrop-blur-sm flex flex-col items-center justify-center font-semibold text-sm" style={{ borderColor: theme.colors.cardButtonBorder, backgroundColor: 'rgba(255,255,255,0.1)', color: theme.colors.cardTextSecondary }}>
                <span className="text-xl">+</span>
                <span className="mt-1">Add</span>
              </button>
            )}
          </div>

          {/* Pagination */}
          {visibleCount <
            goals.filter((g) => g.category !== "quick").length && (
            <button
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="w-full py-1 mt-2 text-sm font-semibold text-white/80 hover:text-white"
            >
              Show more
            </button>
          )}
        </div>

        {/* Footer */}
        {account && (
          <div className="flex justify-end mt-3">
            <button
              onClick={onToggleBalance}
              className="p-1 min-w-[12px] min-h-[12px]"
            >
              {showBalance ? <EyeOff /> : <Eye />}
            </button>
          </div>
        )}
      </div>

      {/* Expand Toggle */}
      <div className="flex justify-center mt-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="rounded-full p-3 min-w-[12px] min-h-[12px] shadow-lg bg-muted transition active:scale-95"
        >
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </button>
      </div>
    </div>
  );
};

export default ExpandableQuickSaveCard;
