"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { useMiniApp } from "@/hooks/useMiniApp";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  WifiOff,
  Shield,
  BarChart3,
  Bell,
  Eye,
  EyeOff,
  User,
  Users,
  HelpCircle,
  X,
  ArrowLeft,
  ChevronRight,
  Share2,
  Calendar,
  Hash,
  Trash2,
  Edit3,
  Download,
  Settings,
  LogOut,
  ExternalLink,
  Loader2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
// import FooterNavigation from "@/components/Footer"
import {
  useActiveAccount,
  useSendTransaction,
  useWalletBalance,
  AutoConnect,
} from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { client } from "@/lib/thirdweb/client";
import { ConnectWallet } from "@/components/ConnectWallet";
import { OnrampDepositModal } from "@/components/OnrampDepositModal";

import { getContract, prepareContractCall, waitForReceipt } from "thirdweb";
import { getApprovalForTransaction } from "thirdweb/extensions/erc20";
import { getWalletBalance } from "thirdweb/wallets";
import { parseUnits } from "viem";
import { isDataSaverEnabled, enableDataSaver } from "@/lib/serviceWorker";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataAwareRender } from "@/components/ui/loading-indicator";
import { Logo } from "@/components/Logo";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// thirdweb handles transaction modals; no custom tx modal
import { SaveMoneyModal } from "@/components/SaveMoneyModal";

// Import chain configuration utilities
import { getVaultAddress, hasVaultContracts } from "@/config/chainConfig";
import { reportTransactionToDivvi } from "@/lib/services/divviService";
import { getReferralTag } from "@divvi/referral-sdk";

// Define the vault contract ABI for deposit function
const vaultABI = [
  {
    inputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "lockTierId", type: "uint256" },
    ],
    name: "deposit",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

import { useChain } from "@/components/ChainProvider";
import { BorrowMoneyModal } from "@/components/BorrowMoneyModal";
import { PayBackModal } from "@/components/PayBackModal";
import { FundsWithdrawalModal } from "@/components/FundsWithdrawalModal";
import { ChainDebug } from "@/components/ChainDebug";
import {
  getTransactionUrl,
  getTokens,
  getTokenInfo as getChainTokenInfo,
} from "@/config/chainConfig";

// Types
interface Goal {
  id: string;
  title: string;
  description?: string;
  amount: string;
  targetAmount: string;
  progress: number;
  icon?: string;
  category: "personal" | "retirement" | "quick";
}

interface SaveOption {
  id: string;
  title: string;
  icon: LucideIcon;
  description?: string;
}

interface TokenInfo {
  symbol: string;
  decimals: number;
}

// Design System Components
interface ModalHeaderProps {
  title: string;
  onClose: () => void;
  rightAction?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  };
  showBackButton?: boolean;
  onBack?: () => void;
  backgroundColor?: string;
}

const ModalHeader = ({
  title,
  onClose,
  rightAction,
  showBackButton = false,
  onBack,
  backgroundColor = "bg-gradient-to-r from-teal-500 to-cyan-500",
}: ModalHeaderProps) => {
  return (
    <div
      className={`${backgroundColor} p-3 sm:p-4 flex items-center justify-between min-h-[56px]`}
    >
      {/* Left side - Close or Back button */}
      <Button
        onClick={showBackButton ? onBack : onClose}
        variant="ghost"
        size="sm"
        className="text-white hover:bg-white/10 rounded-full p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
      >
        {showBackButton ? (
          <ArrowLeft className="w-5 h-5" />
        ) : (
          <X className="w-5 h-5" />
        )}
      </Button>

      {/* Center - Title */}
      <h2 className="text-lg sm:text-xl font-semibold text-white text-center flex-1 px-2">
        {title}
      </h2>

      {/* Right side - Action button or spacer */}
      {rightAction ? (
        <Button
          onClick={rightAction.onClick}
          className={`
            ${
              rightAction.variant === "primary"
                ? "bg-white/20 text-white border border-white/30 hover:bg-white hover:text-black"
                : "bg-transparent text-white border border-white/40 hover:bg-white/10"
            } 
            px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 min-w-[44px] min-h-[44px]
          `}
        >
          {rightAction.label}
        </Button>
      ) : (
        <div className="min-w-[44px]" />
      )}
    </div>
  );
};

interface InfoCardProps {
  children: React.ReactNode;
  variant?: "default" | "stats" | "action";
  className?: string;
}

const InfoCard = ({
  children,
  variant = "default",
  className = "",
}: InfoCardProps) => {
  const baseClasses = "rounded-lg border";

  const variantClasses = {
    default: "bg-gray-800 border-gray-700 p-3",
    stats: "bg-gray-800 border-gray-700 p-4",
    action:
      "bg-gray-800 border-gray-700 p-3 hover:bg-gray-750 transition-colors duration-200",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
};

interface ActionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}

const ActionButton = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
}: ActionButtonProps) => {
  const baseClasses =
    "font-medium rounded-full transition-all duration-200 min-h-[44px] flex items-center justify-center";

  const variantClasses = {
    primary: "bg-cyan-400 hover:bg-cyan-500 text-black",
    secondary: "bg-gray-700 hover:bg-gray-600 text-white",
    outline:
      "bg-transparent border border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black",
  };

  const sizeClasses = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base font-semibold",
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </Button>
  );
};

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string;
}

const BottomSheet = ({
  isOpen,
  onClose,
  children,
  maxHeight = "max-h-[90vh]",
}: BottomSheetProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`
        relative w-full sm:w-auto sm:min-w-[400px] sm:max-w-lg
        bg-black sm:bg-gray-900 
        rounded-t-xl sm:rounded-xl 
        ${maxHeight}
        overflow-hidden
        animate-in slide-in-from-bottom duration-300 sm:animate-in sm:fade-in sm:slide-in-from-bottom-4
      `}
      >
        {children}
      </div>
    </div>
  );
};

// Goal Card Component
const GoalCard = ({
  goal,
  showBalance = true,
  onToggleBalance,
  onCardClick,
}: {
  goal: Goal;
  showBalance?: boolean;
  onToggleBalance?: () => void;
  onCardClick?: () => void;
}) => {
  const formatAmount = (amount: string) => {
    if (!showBalance) return "****";
    return new Intl.NumberFormat("en-KE").format(Number(amount));
  };

  const formatTargetAmount = (amount: string) => {
    if (!showBalance) return "****";
    return new Intl.NumberFormat("en-KE").format(Number(amount));
  };

  // Special styling for Quick Save card - Mobile-First Design
  if (goal.category === "quick") {
    return (
      <div
        className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl overflow-hidden relative cursor-pointer hover:scale-[1.02] transition-transform duration-200 border-0"
        onClick={onCardClick}
      >
        {/* Header Section */}
        <div className="p-4 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-1">
                {goal.title}
              </h3>
              <div className="text-xs text-white/70">Current Balance</div>
            </div>
            <div className="text-4xl opacity-80">🐷</div>
          </div>

          {/* Balance Display */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-2xl font-bold text-white">
              KES {formatAmount(goal.amount)}
            </div>
            {onToggleBalance && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBalance();
                }}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                {showBalance ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCardClick?.();
              }}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 min-h-[44px] flex items-center justify-center"
            >
              Save Now
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Handle withdraw action
              }}
              className="bg-transparent border border-white/40 text-white hover:bg-white/10 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 min-h-[44px] flex items-center justify-center"
            >
              Withdraw
            </button>
          </div>
        </div>

        {/* Description Section */}
        {goal.description && (
          <div className="bg-black/20 p-3 backdrop-blur-sm">
            <p className="text-xs text-white/90 leading-relaxed">
              {goal.description}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Regular goal cards - Updated with new design system
  const getCardBackground = () => {
    if (goal.category === "personal") {
      return "bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700";
    }
    if (goal.category === "retirement") {
      return "bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-600";
    }
    return "bg-gray-800 border border-gray-700";
  };

  return (
    <div
      className={`rounded-xl overflow-hidden relative ${getCardBackground()}`}
    >
      {/* Background pattern for personal goals */}
      {goal.category === "personal" && (
        <div className="absolute inset-0 opacity-20">
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-teal-500/30">
            {/* Chart-like dots pattern */}
            <div className="flex items-end justify-center space-x-1 h-full p-4">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-teal-400 rounded-full"
                  style={{ height: `${Math.random() * 60 + 20}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Background for retirement goals */}
      {goal.category === "retirement" && (
        <div className="absolute inset-0 opacity-30">
          <div className="absolute bottom-0 right-0 text-6xl p-4">☂️</div>
        </div>
      )}

      <div className="p-4 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <span>{goal.title}</span>
              <div className="w-4 h-4 border border-gray-400 rounded-sm flex items-center justify-center">
                <div className="w-2 h-2 bg-gray-400 rounded-sm"></div>
              </div>
            </h3>
          </div>
          <span className="text-lg font-bold text-cyan-400">
            {goal.progress.toFixed(1)}%
          </span>
        </div>

        {/* Amount Section */}
        <InfoCard variant="stats" className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-300">Amount saved (KES)</div>
            {onToggleBalance && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBalance();
                }}
                className="text-gray-400 hover:text-white p-1 rounded transition-colors duration-200"
              >
                {showBalance ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          <div className="text-xl font-bold text-white mb-3">
            {formatAmount(goal.amount)} of{" "}
            {formatTargetAmount(goal.targetAmount)}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-600 rounded-full h-2">
            <div
              className="bg-cyan-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(goal.progress, 100)}%` }}
            />
          </div>
        </InfoCard>
      </div>
    </div>
  );
};

// Save Options Modal Component - Mobile-First Redesign
const SaveOptionsModal = ({
  isOpen,
  onClose,
  onOptionSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOptionSelect: (optionId: string) => void;
}) => {
  const saveOptions: SaveOption[] = [
    {
      id: "personal",
      title: "Personal Goal",
      icon: User,
    },
    {
      id: "group",
      title: "Group Goal",
      icon: Users,
    },
    {
      id: "quick",
      title: "Quick Save",
      icon: HelpCircle,
    },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[80vh]">
      <ModalHeader title="Create New Goal" onClose={onClose} />

      <div className="bg-black p-4 space-y-6">
        {/* Header Section */}
        <div className="text-center py-2">
          <div className="text-4xl mb-3">🐷</div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Where would you like to save?
          </h3>
          <p className="text-sm text-gray-400">
            Choose the type of savings goal you want to create
          </p>
        </div>

        {/* Goal Options */}
        <div className="space-y-3">
          {saveOptions.map((option) => {
            const IconComponent = option.icon;
            return (
              <InfoCard
                key={option.id}
                variant="action"
                className="cursor-pointer hover:border-cyan-400 transition-all duration-200"
              >
                <button
                  onClick={() => onOptionSelect(option.id)}
                  className="w-full flex items-center space-x-4 p-2"
                >
                  <div className="w-12 h-12 bg-cyan-400/20 rounded-full flex items-center justify-center">
                    <IconComponent className="w-6 h-6 text-cyan-400" />
                  </div>

                  <div className="flex-1 text-left">
                    <div className="text-lg font-semibold text-white">
                      {option.title}
                    </div>
                    <div className="text-sm text-gray-400">
                      {option.id === "personal" &&
                        "Set personal savings targets"}
                      {option.id === "group" && "Save together with others"}
                      {option.id === "quick" && "Save without a specific goal"}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </InfoCard>
            );
          })}
        </div>

        {/* Cancel Button */}
        <ActionButton
          onClick={onClose}
          variant="outline"
          size="lg"
          className="w-full"
        >
          Cancel
        </ActionButton>

        {/* Bottom spacing for safe area */}
        <div className="h-4"></div>
      </div>
    </BottomSheet>
  );
};

// Quick Save Details Modal Component - Mobile-First Redesign
const QuickSaveDetailsModal = ({
  isOpen,
  onClose,
  onSaveNow,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaveNow: () => void;
}) => {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[85vh]">
      <ModalHeader
        title="Quick Save"
        onClose={onClose}
        rightAction={{
          label: "Save now",
          onClick: onSaveNow,
          variant: "secondary",
        }}
      />

      {/* Quick Save Card Header */}
      <div className="bg-gradient-to-r from-teal-500 to-cyan-500 p-3 flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm text-white/80">Current Balance</div>
          <div className="text-2xl font-bold text-white">KES 0</div>
        </div>
        <div className="text-4xl opacity-80">🐷</div>
      </div>

      {/* Content */}
      <div className="bg-black p-3 space-y-3 overflow-y-auto">
        {/* Balance Overview */}
        <InfoCard variant="stats">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Savings</div>
              <div className="text-lg font-semibold text-white">0</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Target</div>
              <div className="text-sm text-cyan-400">No pressure</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-600 rounded-full h-1 mt-3">
            <div className="bg-cyan-400 h-1 rounded-full w-0"></div>
          </div>
        </InfoCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <ActionButton onClick={onSaveNow} variant="primary" size="sm">
            Save Money
          </ActionButton>
          <ActionButton onClick={() => {}} variant="outline" size="sm">
            Withdraw
          </ActionButton>
        </div>

        {/* Key Information */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white">Key Info</h3>

          <InfoCard variant="action">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="text-sm font-medium text-white">
                    Interest (5%)
                  </div>
                  <div className="text-xs text-gray-400">Earned: KES 0</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </InfoCard>

          <InfoCard variant="action">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 text-cyan-400">📊</div>
                <div>
                  <div className="text-sm font-medium text-white">
                    Transactions
                  </div>
                  <div className="text-xs text-gray-400">View history</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </InfoCard>
        </div>

        {/* Payment Details */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Payment Info</h3>
            <Share2 className="w-4 h-4 text-gray-400" />
          </div>

          <InfoCard>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Business No.</span>
                <span className="text-cyan-400 font-medium">4072222</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Account No.</span>
                <span className="text-cyan-400 font-medium">PTU5C5</span>
              </div>
            </div>
          </InfoCard>
        </div>

        {/* Timeline (Compact) */}
        <InfoCard>
          <div className="flex items-center justify-between text-sm">
            <div>
              <div className="text-white font-medium">Started</div>
              <div className="text-xs text-gray-400">2 years ago</div>
            </div>
            <div className="text-cyan-400">25th Dec 2023</div>
          </div>
        </InfoCard>

        {/* Bottom spacing for safe area */}
        <div className="h-4"></div>
      </div>
    </BottomSheet>
  );
};

// Quick Save Amount Input Modal - Mobile-First
const QuickSaveAmountModal = ({
  isOpen,
  onClose,
  onContinue,
}: {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (amount: string) => void;
}) => {
  const [amount, setAmount] = useState("100");

  const handleNumberPress = (num: string) => {
    if (num === "00") {
      setAmount((prev) => prev + "00");
    } else if (num === "⌫") {
      setAmount((prev) => prev.slice(0, -1) || "0");
    } else {
      setAmount((prev) => (prev === "0" ? num : prev + num));
    }
  };

  const handleContinue = () => {
    onContinue(amount);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[95vh]">
      <ModalHeader title="How much do you want to save?" onClose={onClose} />

      <div className="bg-black p-4 space-y-6">
        {/* Amount Display */}
        <div className="text-center py-6">
          <div className="text-6xl mb-6">🐷</div>
          <div className="text-4xl font-bold text-white">
            <span className="text-cyan-400">KES </span>
            {amount}
          </div>
        </div>

        {/* Continue Button */}
        <ActionButton
          onClick={handleContinue}
          variant="primary"
          size="lg"
          className="w-full"
        >
          CONTINUE
        </ActionButton>

        {/* Number Keypad */}
        <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto pb-6">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"].map(
            (key) => (
              <button
                key={key}
                onClick={() => handleNumberPress(key)}
                className="w-14 h-14 text-white text-xl font-medium hover:bg-gray-800 rounded-full transition-colors duration-200 flex items-center justify-center border border-gray-700 hover:border-cyan-400"
              >
                {key === "⌫" ? "⌫" : key}
              </button>
            )
          )}
        </div>
      </div>
    </BottomSheet>
  );
};

// Quick Save Confirmation Modal - Mobile-First
const QuickSaveConfirmationModal = ({
  isOpen,
  onClose,
  amount,
  onDeposit,
  isLoading = false,
  error = null,
  transactionStatus = null,
  tokenSymbol = "USDC",
  depositSuccess = null,
  account = null,
  tokens = [],
  tokenInfos = {},
  supportedStablecoins = [],
  copied = false,
  setCopied = () => {},
  setSelectedTokenForOnramp = () => {},
  setShowOnrampModal = () => {},
}: {
  isOpen: boolean;
  onClose: () => void;
  amount: string;
  onDeposit: () => void;
  isLoading?: boolean;
  error?: string | null;
  transactionStatus?: string | null;
  tokenSymbol?: string;
  depositSuccess?: { amount: string; transactionHash?: string } | null;
  account?: any;
  tokens?: any[];
  tokenInfos?: any;
  supportedStablecoins?: string[];
  copied?: boolean;
  setCopied?: (value: boolean) => void;
  setSelectedTokenForOnramp?: (value: string) => void;
  setShowOnrampModal?: (value: boolean) => void;
}) => {
  // Show success state if deposit is successful
  if (depositSuccess) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[90vh]">
        <ModalHeader title="Deposit Successful!" onClose={onClose} />

        <div className="bg-black p-4 space-y-6">
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="text-white text-lg font-medium mb-2">
              Deposit Successful!
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Your KES {depositSuccess.amount} has been deposited to your Quick
              Save goal.
            </p>

            {depositSuccess.transactionHash && (
              <div className="text-xs text-cyan-400 break-all">
                Transaction: {depositSuccess.transactionHash.substring(0, 20)}
                ...
              </div>
            )}
          </div>

          <InfoCard>
            <div className="text-center">
              <div className="text-3xl mb-3">🎉</div>
              <p className="text-gray-300 text-sm">
                Your funds are now earning yield in the vault!
              </p>
            </div>
          </InfoCard>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[90vh]">
      <ModalHeader title="Confirm Deposit" onClose={onClose} />

      <div className="bg-black p-4 space-y-6">
        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-300 p-3 rounded-xl text-sm">
            <div className="flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>

            {/* Show funding options if user has zero balance */}
            {error.includes("You have KES 0") && (
              <div className="mt-3 space-y-3">
                <p className="text-red-200 text-xs text-center">
                  Choose how to add funds:
                </p>

                {/* Compact Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (account?.address) {
                        navigator.clipboard.writeText(account.address);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-3 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <span>{copied ? "✓ Copied!" : "📋 Copy Address"}</span>
                  </button>
                  <button
                    onClick={() => {
                      // Find USDC token for onramp (default to first supported token)
                      const usdcToken = tokens.find(
                        (t) =>
                          tokenInfos[t.address]?.symbol?.toUpperCase() ===
                          "USDC"
                      );
                      const tokenForOnramp =
                        usdcToken?.address || supportedStablecoins[0] || "";

                      setSelectedTokenForOnramp(tokenForOnramp);
                      setShowOnrampModal(true);
                    }}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs py-3 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    📱 Mobile Money
                  </button>
                </div>

                <p className="text-gray-400 text-xs text-center mt-3">
                  Once you add funds, you can proceed with your KES {amount}{" "}
                  deposit.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Transaction Status */}
        {transactionStatus && (
          <div className="bg-blue-900/20 border border-blue-700 text-blue-300 p-3 rounded-xl text-sm flex items-start gap-2">
            <Loader2 className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin" />
            <span>{transactionStatus}</span>
          </div>
        )}

        {/* Only show confirmation details if there's no zero balance error */}
        {!error?.includes("You have KES 0") && (
          <>
            {/* Confirmation Details */}
            <div className="text-center py-4">
              <div className="text-xs text-white mb-2">
                Is the following correct?
              </div>
              <div className="text-xs text-cyan-400 mb-4">
                You wish to deposit to Quick Save
              </div>

              <div className="text-3xl font-bold text-cyan-400 mb-2">
                KES {amount}
              </div>

              <div className="text-gray-400 mb-2 text-xs">to your</div>
              <div className="text-lg font-bold text-cyan-400">
                Quick Save Goal
              </div>
            </div>

            {/* Remember Info Card */}
            <InfoCard>
              <div className="text-center">
                <div className="text-3xl mb-3">🐷</div>
                <h4 className="text-white text-lg font-semibold mb-3">
                  Remember
                </h4>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Your funds will be safely deposited and start earning yield
                  immediately.
                </p>
              </div>
            </InfoCard>

            {/* Action Button */}
            <ActionButton
              onClick={onDeposit}
              variant="primary"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                "DEPOSIT"
              )}
            </ActionButton>
          </>
        )}

        {/* Bottom spacing */}
        <div className="h-4"></div>
      </div>
    </BottomSheet>
  );
};

// Profile Screen Component - Mobile-First
const ProfileScreen = ({
  showBalance,
  onToggleBalance,
}: {
  showBalance: boolean;
  onToggleBalance: () => void;
}) => {
  const account = useActiveAccount();
  const address = account?.address;
  const { chain } = useChain();

  const formatAmount = (amount: string) => {
    if (!showBalance) return "****";
    return new Intl.NumberFormat("en-KE").format(Number(amount));
  };

  const getUserName = () => {
    if (address) {
      // You can replace this with actual user data from your backend
      return "Batman";
    }
    return "Guest User";
  };

  const getMemberSince = () => {
    // You can replace this with actual registration date from your backend
    return "Member since December, 2023";
  };

  // Calculate dynamic savings data based on goals
  const calculateSavingsStats = () => {
    // In a real app, these would come from your backend
    const allTimeSavings = "100";
    const currentSavings = "0";
    const groupSavings = "10";

    return {
      allTimeSavings,
      currentSavings,
      groupSavings,
    };
  };

  const { allTimeSavings, currentSavings, groupSavings } =
    calculateSavingsStats();

  return (
    <div className="space-y-0 min-h-screen bg-black">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-teal-500 to-cyan-500 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white">
              {getUserName()}
            </h1>
            <p className="text-sm text-white/80">{getMemberSince()}</p>
          </div>
        </div>
      </div>

      {/* Savings Statistics */}
      <div className="bg-gray-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-white">Your Savings</h2>
          <button
            onClick={onToggleBalance}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700"
          >
            {showBalance ? (
              <Eye className="w-5 h-5" />
            ) : (
              <EyeOff className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="grid gap-3">
          {/* All time savings */}
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-white">
                  KES {formatAmount(allTimeSavings)}
                </p>
                <p className="text-sm text-gray-400">All time savings</p>
              </div>
            </div>
          </div>

          {/* Current and Group savings */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-lg font-semibold text-white">
                KES {formatAmount(currentSavings)}
              </p>
              <p className="text-sm text-gray-400">Current savings</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-3">
              <p className="text-lg font-semibold text-white">
                KES {formatAmount(groupSavings)}
              </p>
              <p className="text-sm text-gray-400">All time group savings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Friends */}
      <div className="bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <Share2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-base font-medium text-white">
                Invite friends
              </h3>
              <p className="text-sm text-gray-400">
                Support your friends in growing and managing their savings.
              </p>
            </div>
          </div>
          <ActionButton
            onClick={() => {
              // Handle invite logic - could open a share modal or copy referral link
              if (navigator.share) {
                navigator.share({
                  title: "Minilend - Start Saving Together",
                  text: "Join me on Minilend and start building your savings goals!",
                  url: window.location.origin,
                });
              } else {
                // Fallback for browsers that don't support Web Share API
                console.log("Invite friends clicked");
              }
            }}
            variant="primary"
            size="sm"
            className="text-black px-4 flex-shrink-0"
          >
            Invite
          </ActionButton>
        </div>
      </div>

      {/* Account Section */}
      <div className="space-y-0">
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-900">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            Account
          </h3>
        </div>

        {/* Connect/Disconnect Wallet */}
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Wallet className="w-5 h-5 text-gray-400" />
              <span className="text-white">Wallet Connection</span>
            </div>
            <ConnectWallet />
          </div>
        </div>

        {/* Settings */}
        <button className="w-full px-4 py-3 border-b border-gray-700 bg-gray-800 hover:bg-gray-750 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="w-5 h-5 text-gray-400" />
              <span className="text-white">Settings</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>

        {/* Next of kin */}
        <button className="w-full px-4 py-3 border-b border-gray-700 bg-gray-800 hover:bg-gray-750 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-white">Next of kin</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>

        {/* Personal details */}
        <button className="w-full px-4 py-3 border-b border-gray-700 bg-gray-800 hover:bg-gray-750 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <User className="w-5 h-5 text-gray-400" />
              <span className="text-white">Personal details</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>

        {/* Log out */}
        <button
          onClick={() => {
            // Handle logout logic
            console.log("Logout clicked");
            // You can implement actual logout logic here
          }}
          className="w-full px-4 py-3 border-b border-gray-700 bg-gray-800 hover:bg-gray-750 transition-colors text-red-400 hover:text-red-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <LogOut className="w-5 h-5" />
              <span>Log out</span>
            </div>
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* Support Section */}
      <div className="space-y-0">
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-900">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            Support
          </h3>
        </div>

        {/* Get Help */}
        <button
          onClick={() => {
            // Handle help - could open WhatsApp, email, or help center
            window.open("https://wa.me/+25451201818", "_blank");
          }}
          className="w-full px-4 py-3 border-b border-gray-700 bg-gray-800 hover:bg-gray-750 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <HelpCircle className="w-5 h-5 text-gray-400" />
              <span className="text-white">Get Help</span>
            </div>
            <ExternalLink className="w-5 h-5 text-gray-400" />
          </div>
        </button>

        {/* FAQ */}
        <button
          onClick={() => {
            // Handle FAQ navigation
            console.log("FAQ clicked");
          }}
          className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-750 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Hash className="w-5 h-5 text-gray-400" />
              <span className="text-white">Frequently Asked Questions</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </button>
      </div>

      {/* Bottom spacing for footer */}
      <div className="h-20"></div>
    </div>
  );
};

export default function AppPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const account = useActiveAccount();
  const address = account?.address;
  const isConnected = !!account;
  // const { connect } = useConnect();
  const { mutateAsync: sendTransaction } = useSendTransaction({
    payModal: false,
  });
  const { isSDKLoaded, context } = useMiniApp();
  const { chain, tokens, tokenInfos } = useChain();

  // Get default token for Quick Save (prioritize USDC, then first available token)
  const defaultToken = useMemo(() => {
    if (!tokens || tokens.length === 0) return null;

    // Try to find USDC first
    const usdc = tokens.find((t) => t.symbol.toUpperCase() === "USDC");
    if (usdc) return usdc;

    // Try other stablecoins
    const stablecoins = tokens.filter((t) =>
      ["USDT", "CUSD", "DAI"].includes(t.symbol.toUpperCase())
    );
    if (stablecoins.length > 0) return stablecoins[0];

    // Fallback to first token
    return tokens[0];
  }, [tokens]);

  // Only show deposit-appropriate tokens per chain
  const supportedStablecoins = useMemo(() => {
    if (!tokens) return [];

    if (chain?.id === 42220) {
      // Celo
      const allowedSymbols = ["USDC", "USDT", "CUSD"];
      return tokens
        .filter((t) => allowedSymbols.includes(t.symbol.toUpperCase()))
        .map((t) => t.address);
    } else if (chain?.id === 534352) {
      // Scroll
      const allowedSymbols = ["USDC", "WETH"];
      return tokens
        .filter((t) => allowedSymbols.includes(t.symbol.toUpperCase()))
        .map((t) => t.address);
    }
    return tokens.map((t) => t.address);
  }, [tokens, chain?.id]);

  // Use wallet balance hook for the default token
  const { data: walletBalanceData, isLoading: isBalanceLoading } =
    useWalletBalance({
      client,
      chain,
      address: account?.address,
      tokenAddress: defaultToken?.address,
    });

  // State for the new design
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [saveOptionsModalOpen, setSaveOptionsModalOpen] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "goals" | "groups" | "leaderboard" | "profile"
  >("goals");

  // Footer is always visible

  // Quick Save modal states
  const [quickSaveDetailsOpen, setQuickSaveDetailsOpen] = useState(false);
  const [quickSaveAmountOpen, setQuickSaveAmountOpen] = useState(false);
  const [quickSaveConfirmationOpen, setQuickSaveConfirmationOpen] =
    useState(false);
  const [quickSaveAmount, setQuickSaveAmount] = useState("100");

  // Quick Save deposit transaction states
  const [isDepositLoading, setIsDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<string | null>(
    null
  );
  const [depositSuccess, setDepositSuccess] = useState<{
    amount: string;
    transactionHash?: string;
  } | null>(null);

  // Mobile money onramp states
  const [showOnrampModal, setShowOnrampModal] = useState(false);
  const [selectedTokenForOnramp, setSelectedTokenForOnramp] = useState("");
  const [copied, setCopied] = useState(false);
  const [pendingDeposit, setPendingDeposit] = useState(false);

  // Sample goals data - replace with real data from your backend
  const goals: Goal[] = useMemo(
    () => [
      {
        id: "quick-save",
        title: "Quick Save",
        amount: "0",
        targetAmount: "0",
        progress: 0,
        category: "quick",
        description:
          "*Quick save enables you to save when you don't have a goal in mind. Money saved on quick save is transferrable to any goal*",
      },
      {
        id: "soma-plan",
        title: "Soma plan",
        amount: "0",
        targetAmount: "10000000",
        progress: 0,
        category: "personal",
        icon: "📊",
      },
      {
        id: "insure",
        title: "Insure",
        amount: "20",
        targetAmount: "20",
        progress: 100,
        category: "retirement",
        icon: "☂️",
      },
    ],
    []
  );

  // Validate chain configuration
  const chainConfigValid = useMemo(() => {
    return chain && tokens && tokens.length > 0 && tokenInfos;
  }, [chain, tokens, tokenInfos]);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    updateStatus();
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  // Monitor account connection and retry deposit if pending
  useEffect(() => {
    if (account && pendingDeposit) {
      setPendingDeposit(false);
      setDepositError(null);
      // Retry the deposit
      handleQuickSaveDeposit();
    }
  }, [account, pendingDeposit]);

  const handleSaveOptionSelect = (optionId: string) => {
    setSaveOptionsModalOpen(false);
    // Handle the different save options
    switch (optionId) {
      case "personal":
        setActiveModal("save");
        break;
      case "group":
        // Handle group goal creation
        console.log("Group goal selected");
        break;
      case "quick":
        // Handle quick save
        setActiveModal("save");
        break;
    }
  };

  const toggleBalanceVisibility = () => {
    setShowBalances(!showBalances);
  };

  // Quick Save modal handlers
  const handleQuickSaveCardClick = () => {
    setQuickSaveDetailsOpen(true);
  };

  const handleQuickSaveSaveNow = () => {
    setQuickSaveDetailsOpen(false);
    setQuickSaveAmountOpen(true);
  };

  const handleQuickSaveAmountContinue = (amount: string) => {
    setQuickSaveAmount(amount);
    setQuickSaveAmountOpen(false);
    setQuickSaveConfirmationOpen(true);
  };

  // Prepare deposit transaction for Quick Save
  const prepareQuickSaveDepositTransaction = async (amount: string) => {
    if (!defaultToken || !account || !chain) {
      throw new Error("Missing required parameters");
    }

    const chainId = chain.id;
    const isVaultChain = hasVaultContracts(chainId);

    if (!isVaultChain) {
      throw new Error("This chain is not yet supported for deposits");
    }

    const decimals = defaultToken.decimals || 18;
    const amountWei = parseUnits(amount, decimals);
    const tokenSymbol = defaultToken.symbol;

    try {
      const vaultAddress = getVaultAddress(chainId, tokenSymbol);

      if (process.env.NODE_ENV === "development") {
        console.log("[QuickSave] Using Aave vault:", {
          token: tokenSymbol,
          vault: vaultAddress?.substring(0, 10) + "...",
        });
      }

      const vaultContract = getContract({
        client,
        chain: chain,
        address: vaultAddress,
        abi: vaultABI,
      });

      // Use no lock period for Quick Save (lockTierId = 0)
      const lockTierId = 0;

      // Create the deposit transaction for vault (amount, lockTierId)
      const depositTx = prepareContractCall({
        contract: vaultContract,
        method: "deposit",
        params: [amountWei, BigInt(lockTierId)],
        erc20Value: {
          tokenAddress: defaultToken.address,
          amountWei,
        },
      });

      return depositTx;
    } catch (error) {
      console.error("[QuickSave] Error preparing vault transaction:", error);
      throw error;
    }
  };

  // Handle transaction errors with user-friendly messages
  const handleDepositError = (error: Error) => {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[QuickSave] Transaction error:",
        error?.message || "Unknown error"
      );
    }

    let userMessage = "Transaction failed. Please try again.";

    if (
      error.message.includes("user rejected") ||
      error.message.includes("User rejected")
    ) {
      userMessage = "Transaction was cancelled.";
    } else if (error.message.includes("insufficient funds")) {
      userMessage = "Insufficient funds for this transaction.";
    } else if (error.message.includes("transfer amount exceeds allowance")) {
      userMessage = "Token approval failed. Please try again.";
    } else if (error.message.includes("network")) {
      userMessage =
        "Network error. Please check your connection and try again.";
    }

    setDepositError(userMessage);
  };

  // Handle successful transaction
  const handleDepositSuccess = async (receipt: any) => {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "[QuickSave] Transaction successful:",
        receipt?.transactionHash || "unknown"
      );
    }

    // Set the success state
    setDepositSuccess({
      amount: quickSaveAmount,
      transactionHash: receipt.transactionHash,
    });

    // Keep confirmation modal open to show success, reset after delay
    setTimeout(() => {
      setQuickSaveConfirmationOpen(false);
      setDepositSuccess(null);
      setTransactionStatus(null);
      setDepositError(null);
    }, 3000);
  };

  // Handle successful onramp deposit
  const handleOnrampSuccess = () => {
    setShowOnrampModal(false);
    // Close the error modal and reset states
    setQuickSaveConfirmationOpen(false);
    setDepositError("");
    setTransactionStatus("");
    setIsDepositLoading(false);
  };

  const handleQuickSaveDeposit = async () => {
    if (!account) {
      setPendingDeposit(true);
      setDepositError("Connecting wallet automatically...");
      return;
    }

    if (!defaultToken) {
      setDepositError("No supported tokens found for deposit");
      return;
    }

    // Validate balance
    const walletBalance = parseFloat(walletBalanceData?.displayValue || "0");
    const inputAmount = parseFloat(quickSaveAmount);

    if (inputAmount > walletBalance) {
      if (walletBalance === 0) {
        setDepositError(
          `You have KES 0 in your wallet. To deposit, please add funds using Mobile Money or transfer from another wallet.`
        );
      } else {
        setDepositError(
          `Amount exceeds available balance of KES ${walletBalance}`
        );
      }
      return;
    }

    setIsDepositLoading(true);
    setDepositError(null);
    setTransactionStatus("Setting up your deposit...");

    try {
      const depositTx =
        await prepareQuickSaveDepositTransaction(quickSaveAmount);

      // Get approval if needed
      const approveTx = await getApprovalForTransaction({
        transaction: depositTx as any,
        account: account!,
      });

      if (approveTx) {
        setTransactionStatus("Authorizing transaction...");
        const approveResult = await sendTransaction(approveTx);

        if (approveResult?.transactionHash) {
          setTransactionStatus("Processing authorization...");
          await waitForReceipt({
            client,
            chain,
            transactionHash: approveResult.transactionHash,
          });
        }
      }

      setTransactionStatus("Completing your deposit...");

      const depositResult = await sendTransaction(depositTx);

      if (depositResult?.transactionHash) {
        setTransactionStatus("Almost done...");
        const depositReceipt = await waitForReceipt({
          client,
          chain,
          transactionHash: depositResult.transactionHash,
        });
        setTransactionStatus("Success!");
        handleDepositSuccess(depositReceipt);

        // Report to Divvi after successful transaction
        try {
          reportTransactionToDivvi(depositResult.transactionHash, chain.id);
        } catch (error) {
          console.log("[QuickSave] Divvi reporting skipped:", error);
        }
      }
    } catch (err: any) {
      setTransactionStatus(null);
      handleDepositError(err);
    } finally {
      setIsDepositLoading(false);
    }
  };

  const closeAllQuickSaveModals = () => {
    setQuickSaveDetailsOpen(false);
    setQuickSaveAmountOpen(false);
    setQuickSaveConfirmationOpen(false);
    // Reset deposit states
    setIsDepositLoading(false);
    setDepositError(null);
    setTransactionStatus(null);
    setDepositSuccess(null);
  };

  // Show error if chain configuration is invalid
  if (!chainConfigValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center space-y-4 p-8">
          <div className="text-red-400 text-xl font-semibold">
            Chain Configuration Error
          </div>
          <div className="text-gray-300 max-w-md">
            The current chain is not properly configured. Please check the chain
            configuration or switch to a supported network.
          </div>
          <div className="text-sm text-gray-400">
            Chain: {chain?.name || "Unknown"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* AutoConnect for silent wallet connection */}
      <AutoConnect
        client={client}
        wallets={[
          inAppWallet({
            auth: {
              options: ["guest"],
            },
          }),
          createWallet("io.metamask"),
          createWallet("com.coinbase.wallet"),
        ]}
        timeout={10000}
      />

      {/* Header */}
      <header className="bg-black/60 backdrop-blur-md border-b border-white/10 px-4 py-4 sticky top-0 z-40 relative">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          {/* Dynamic Header based on active tab */}
          <div>
            <h1 className="text-xl font-bold text-cyan-400">
              {activeTab === "goals" && "Goals"}
              {activeTab === "groups" && "Groups"}
              {activeTab === "leaderboard" && "LeaderBoard"}
              {activeTab === "profile" && "Profile"}
            </h1>
            <p className="text-sm text-gray-400">
              {activeTab === "goals" && "Home"}
              {activeTab === "groups" && "Save with friends"}
              {activeTab === "leaderboard" && "Community rankings"}
              {activeTab === "profile" && "Account & Settings"}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Show different buttons based on active tab */}
            {activeTab === "goals" && (
              <>
                {/* New Goal Button */}
                <ActionButton
                  onClick={() => setSaveOptionsModalOpen(true)}
                  variant="outline"
                  size="sm"
                >
                  New goal
                </ActionButton>

                {/* Notifications */}
                <button className="p-2 text-gray-400 hover:text-white border border-gray-600 rounded-full transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </button>
              </>
            )}

            {(activeTab === "groups" || activeTab === "leaderboard") && (
              <button className="p-2 text-gray-400 hover:text-white border border-gray-600 rounded-full transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto relative z-10">
        {!isOnline && (
          <div className="bg-red-900/60 border border-red-500/30 text-red-200 rounded-lg p-3 mb-4 text-sm flex items-center backdrop-blur-sm mx-4">
            <WifiOff className="w-4 h-4 mr-2" />
            <p>You are currently offline. Some features may be limited.</p>
          </div>
        )}

        {/* Conditional Content based on active tab */}
        {activeTab === "goals" && (
          <div className="px-4 py-6">
            {/* Quick Save Section */}
            <div className="mb-6">
              <GoalCard
                goal={goals.find((g) => g.category === "quick")!}
                showBalance={showBalances}
                onToggleBalance={toggleBalanceVisibility}
                onCardClick={handleQuickSaveCardClick}
              />
            </div>

            {/* Personal Goals Section */}
            <div className="mb-6">
              <div className="flex items-center space-x-2 mb-4">
                <User className="w-5 h-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-white">
                  Personal goals
                </h2>
              </div>

              <div className="space-y-4">
                {goals
                  .filter((g) => g.category === "personal")
                  .map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      showBalance={showBalances}
                    />
                  ))}
              </div>
            </div>

            {/* Retirement Section */}
            <div className="mb-32 pb-4">
              <div className="flex items-center space-x-2 mb-4">
                <Shield className="w-5 h-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-white">Retirement</h2>
              </div>

              <div className="space-y-4">
                {goals
                  .filter((g) => g.category === "retirement")
                  .map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      showBalance={showBalances}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "groups" && (
          <div className="px-4 py-6">
            <div className="text-center py-20">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                Groups coming soon
              </h3>
              <p className="text-gray-400">
                Save together with friends and family
              </p>
            </div>
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="px-4 py-6">
            <div className="text-center py-20">
              <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                LeaderBoard coming soon
              </h3>
              <p className="text-gray-400">
                See how you rank among other savers
              </p>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <ProfileScreen
            showBalance={showBalances}
            onToggleBalance={toggleBalanceVisibility}
          />
        )}
      </main>

      {/* Bottom Navigation Bar - Always Visible */}
      <footer
        className="
          fixed bottom-0 left-0 right-0 z-50
          bg-black/95 backdrop-blur-md border-t border-gray-700
        "
      >
        <div className="flex items-center justify-between px-4 py-1.5 relative">
          {/* Goals Tab */}
          <button
            onClick={() => setActiveTab("goals")}
            className={`flex flex-col items-center space-y-0.5 px-2 py-1 min-w-[44px] rounded-lg transition-all duration-200 ${
              activeTab === "goals"
                ? "bg-cyan-400/15 text-cyan-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-current rounded-full flex items-center justify-center">
                <div className="w-1 h-1 bg-current rounded-full"></div>
              </div>
            </div>
            <span className="text-xs font-medium">Goals</span>
          </button>

          {/* Groups Tab */}
          <button
            onClick={() => setActiveTab("groups")}
            className={`flex flex-col items-center space-y-0.5 px-2 py-1 min-w-[44px] transition-all duration-200 ${
              activeTab === "groups"
                ? "bg-cyan-400/15 text-cyan-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs">Groups</span>
          </button>

          {/* Save Now Button - Center FAB */}
          <div className="absolute left-1/2 transform -translate-x-1/2 -top-5">
            <ActionButton
              onClick={() => setSaveOptionsModalOpen(true)}
              variant="primary"
              size="lg"
              className="w-14 h-14 rounded-full text-xs font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border-2 border-black"
            >
              <span className="text-xs font-bold">SAVE</span>
            </ActionButton>
          </div>

          {/* Leaderboard Tab */}
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`flex flex-col items-center space-y-0.5 px-2 py-1 min-w-[44px] transition-all duration-200 ${
              activeTab === "leaderboard"
                ? "bg-cyan-400/15 text-cyan-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-xs">Board</span>
          </button>

          {/* Profile Tab */}
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center space-y-0.5 px-2 py-1 min-w-[44px] transition-all duration-200 ${
              activeTab === "profile"
                ? "bg-cyan-400/15 text-cyan-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </footer>

      {/* Modals */}
      <SaveOptionsModal
        isOpen={saveOptionsModalOpen}
        onClose={() => setSaveOptionsModalOpen(false)}
        onOptionSelect={handleSaveOptionSelect}
      />

      {/* Quick Save Modals */}
      <QuickSaveDetailsModal
        isOpen={quickSaveDetailsOpen}
        onClose={closeAllQuickSaveModals}
        onSaveNow={handleQuickSaveSaveNow}
      />

      <QuickSaveAmountModal
        isOpen={quickSaveAmountOpen}
        onClose={closeAllQuickSaveModals}
        onContinue={handleQuickSaveAmountContinue}
      />

      <QuickSaveConfirmationModal
        isOpen={quickSaveConfirmationOpen}
        onClose={closeAllQuickSaveModals}
        amount={quickSaveAmount}
        onDeposit={handleQuickSaveDeposit}
        isLoading={isDepositLoading}
        error={depositError}
        transactionStatus={transactionStatus}
        tokenSymbol={defaultToken?.symbol || "USDC"}
        depositSuccess={depositSuccess}
        account={account}
        tokens={tokens}
        tokenInfos={tokenInfos}
        supportedStablecoins={supportedStablecoins}
        copied={copied}
        setCopied={setCopied}
        setSelectedTokenForOnramp={setSelectedTokenForOnramp}
        setShowOnrampModal={setShowOnrampModal}
      />

      {/* Keep existing modals for functionality */}
      <SaveMoneyModal
        isOpen={activeModal === "save"}
        onClose={() => setActiveModal(null)}
        loading={false}
        requiresAuth={!isConnected}
      />

      {/* Onramp Modal for Mobile Money Deposits */}
      <OnrampDepositModal
        isOpen={showOnrampModal}
        onClose={() => setShowOnrampModal(false)}
        selectedAsset={tokenInfos[selectedTokenForOnramp]?.symbol || "USDC"}
        assetSymbol={tokenInfos[selectedTokenForOnramp]?.symbol || "USDC"}
        onSuccess={handleOnrampSuccess}
      />
    </div>
  );
}
