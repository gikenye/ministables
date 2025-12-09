"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  ChevronUp,
  ChevronDown,
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
  Trophy,
  Banknote,
  Mail,
  Check,
  Plus,
  type LucideIcon,
} from "lucide-react";

// Import reusable components
import {
  ModalHeader,
  InfoCard,
  ActionButton,
  BottomSheet,
  NumberKeypad,
  AmountDisplay,
  ProgressBar,
  FormField,
  TextInput,
  SelectInput,
  AmountInput,
} from "@/components/ui";
import {
  AmountInputModal,
  TabNavigation,
  ProfileSection,
  ProfileHeaderCard,
  SavingsStatsCard,
  InviteFriendsCard,
  AccountSettingsCard,
  SupportCard,
  StatsCard,
  GoalCard,
  NewProfile,
  type SaveOption,
  type FrontendGoal,
  type GoalCategory,
} from "@/components/common";
import { ClanTab } from "@/components/clan/ClanTab";
import { JoinGoalModal } from "@/components/clan/JoinGoalModal";

// Import custom hooks for API integration
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { backendApiClient, type GroupSavingsGoal, type CreateGoalRequest, type SupportedAsset } from "@/lib/services/backendApiService";
// import { useBlockchainGoals } from "@/hooks/useBlockchainGoals"; // Removed for production deployment
import {
  reportError,
  reportWarning,
  reportInfo,
} from "@/lib/services/errorReportingService";
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
import SaveMoneyModal from "@/components/SaveMoneyModal";

// Import chain configuration utilities
import { getVaultAddress, hasVaultContracts } from "@/config/chainConfig";
import { reportTransactionToDivvi } from "@/lib/services/divviService";
import { vaultService } from "@/lib/services/vaultService";
import type { VaultPosition, VaultDeposit } from "@/lib/services/vaultService";
import { formatAmount } from "@/lib/utils";
import { getBestStablecoinForDeposit } from "@/lib/services/balanceService";
import { mapTokenSymbolToAsset } from "@/lib/services/backendApiService";

interface WithdrawableDeposit {
  depositId: number;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  withdrawableAmount: string;
  lockTier: number;
  depositTime: number;
  unlockTime: number;
}
import { getReferralTag } from "@divvi/referral-sdk";

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
import { WithdrawModal } from "@/components/WithdrawModal";
import {
  getTransactionUrl,
  getTokens,
  getTokenInfo as getChainTokenInfo,
} from "@/config/chainConfig";

// Types - Using Goal interface from @/components/common

interface TokenInfo {
  symbol: string;
  decimals: number;
}

// Save Actions Modal - Quick save actions for main SAVE button
const SaveActionsModal = ({
  isOpen,
  onClose,
  onActionSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onActionSelect: (actionId: string) => void;
}) => {
  const saveActions = [
    {
      id: "quick",
      title: "Quick Save",
      icon: Wallet,
      description: "Save without a specific goal",
    },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[50vh]">
      <ModalHeader title="Where to Save?" onClose={onClose} />

      <div className="bg-gray-800/20 backdrop-blur-sm p-3 space-y-3">
        {/* Header Section */}
        <div className="text-center py-0.5">
          <div className="text-2xl mb-1.5">🐷</div>
          <h3 className="text-sm font-semibold text-white mb-0.5">
            Choose your save option
          </h3>
          <p className="text-xs text-gray-400">
            Select where you'd like to save your money
          </p>
        </div>

        {/* Save Action Options */}
        <div className="space-y-1.5">
          {saveActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <InfoCard
                key={action.id}
                variant="action"
                className="cursor-pointer hover:border-cyan-400 transition-all duration-200"
              >
                <button
                  onClick={() => onActionSelect(action.id)}
                  className="w-full flex items-center space-x-2 p-1"
                >
                  <div className="w-6 h-6 bg-cyan-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <IconComponent className="w-3.5 h-3.5 text-cyan-400" />
                  </div>

                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-white">
                      {action.title}
                    </div>
                    <div className="text-xs text-gray-400">
                      {action.description}
                    </div>
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </InfoCard>
            );
          })}
        </div>

        {/* Cancel Button */}
        <ActionButton
          onClick={onClose}
          variant="outline"
          size="sm"
          className="w-full"
        >
          Cancel
        </ActionButton>

        {/* Bottom spacing for safe area */}
        <div className="h-1"></div>
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
      <div className="bg-gradient-to-r from-teal-500 to-cyan-500 p-2 flex items-center justify-between">
        <div className="flex-1">
          <div className="text-xs text-white/80">Current Balance</div>
          <div className="text-xl font-bold text-white">KES 0</div>
        </div>
        <div className="text-3xl opacity-80">🐷</div>
      </div>

      {/* Content */}
      <div className="bg-gray-800/20 backdrop-blur-sm p-2 space-y-2 overflow-y-auto">
        {/* Balance Overview */}
        <InfoCard variant="stats">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-0.5">Savings</div>
              <div className="text-base font-semibold text-white">0</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-0.5">Target</div>
              <div className="text-xs text-cyan-400">No pressure</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-600 rounded-full h-1 mt-2">
            <div className="bg-cyan-400 h-1 rounded-full w-0"></div>
          </div>
        </InfoCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-1.5">
          <ActionButton onClick={onSaveNow} variant="primary" size="sm">
            Save Money
          </ActionButton>
          <ActionButton onClick={() => {}} variant="outline" size="sm">
            Withdraw
          </ActionButton>
        </div>

        {/* Key Information */}
        {/* <div className="space-y-1.5">
          <h3 className="text-xs font-medium text-white">Key Info</h3>

          <InfoCard variant="action">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                <div>
                  <div className="text-xs font-medium text-white">
                    Interest (5%)
                  </div>
                  <div className="text-xs text-gray-400">Earned: KES 0</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </div>
          </InfoCard>

          <InfoCard variant="action">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <div className="w-3.5 h-3.5 text-cyan-400">📊</div>
                <div>
                  <div className="text-xs font-medium text-white">
                    Transactions
                  </div>
                  <div className="text-xs text-gray-400">View history</div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </div>
          </InfoCard>
        </div> */}
        {/* Bottom spacing for safe area */}
        <div className="h-2"></div>
      </div>
    </BottomSheet>
  );
};

// Custom Goal Modal - Mobile-First Step-by-Step Wizard
const CustomGoalModal = ({
  isOpen,
  onClose,
  onCreateGoal,
  form,
  setForm,
  isLoading = false,
  error = null,
  exchangeRate = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateGoal: () => void;
  form: {
    name: string;
    amount: string;
    timeline: string;
    category: string;
  };
  setForm: (form: any) => void;
  isLoading?: boolean;
  error?: string | null;
  exchangeRate?: number | null;
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { key: "name", label: "Goal Name", required: true },
    { key: "amount", label: "Target Amount", required: true },
    { key: "timeline", label: "Timeline", required: false },
    { key: "category", label: "Category", required: false },
  ];

  const currentField = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const canProceed =
    !currentField.required ||
    (form[currentField.key as keyof typeof form] &&
      form[currentField.key as keyof typeof form].trim() !== "");

  // Convert KES amount to USD for contract
  const convertKESToUSD = (kesAmount: string): string => {
    if (!exchangeRate || !kesAmount) return "0";
    const kesValue = parseFloat(kesAmount);
    const usdValue = kesValue / exchangeRate;
    return usdValue.toFixed(2);
  };

  const handleNext = () => {
    if (isLastStep) {
      onCreateGoal();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onClose();
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[95vh]">
      <div className="bg-gray-800/20 backdrop-blur-sm min-h-full p-2 space-y-3 overflow-y-auto">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center space-x-1 py-1">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index <= currentStep ? "bg-cyan-400" : "bg-gray-600"
              }`}
            />
          ))}
        </div>

        {/* Step Header */}
        <div className="text-center py-2">
          <div className="text-2xl mb-2">🎯</div>
          <h2 className="text-lg font-bold text-white mb-1">
            {currentField.label}
          </h2>
          <p className="text-sm text-gray-400">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>

        {/* Dynamic Form Field */}
        <div className="space-y-2">
          {currentField.key === "name" && (
            <div>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., New Car, Vacation"
                className="w-full p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-base font-medium"
                maxLength={50}
                autoFocus
              />
              <div className="text-xs text-gray-500 text-right mt-1">
                {form.name.length}/50
              </div>
            </div>
          )}

          {currentField.key === "amount" && (
            <div>
              <div className="text-center mb-2">
                <span className="text-2xl font-bold text-cyan-400">KES</span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={form.amount}
                onChange={(e) =>
                  handleInputChange(
                    "amount",
                    e.target.value.replace(/[^0-9]/g, "")
                  )
                }
                placeholder="0"
                className="w-full p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-center text-xl font-bold"
                autoFocus
              />
              {form.amount && exchangeRate && (
                <div className="text-center mt-2 text-sm text-gray-400">
                  ≈ ${convertKESToUSD(form.amount)} USD
                </div>
              )}
            </div>
          )}

          {currentField.key === "timeline" && (
            <select
              value={form.timeline}
              onChange={(e) => handleInputChange("timeline", e.target.value)}
              className="w-full p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white focus:outline-none focus:border-cyan-400 text-base"
            >
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">12 months</option>
            </select>
          )}

          {currentField.key === "category" && (
            <select
              value={form.category}
              onChange={(e) => handleInputChange("category", e.target.value)}
              className="w-full p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white focus:outline-none focus:border-cyan-400 text-base"
            >
              <option value="personal">Personal</option>
              <option value="emergency">Emergency Fund</option>
              <option value="travel">Travel</option>
              <option value="education">Education</option>
              <option value="business">Business</option>
              <option value="health">Health</option>
              <option value="home">Home</option>
              <option value="other">Other</option>
            </select>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-2 pt-2">
          <ActionButton
            onClick={handleBack}
            variant="outline"
            size="lg"
            className="flex-1"
          >
            {currentStep === 0 ? "Cancel" : "Back"}
          </ActionButton>
          <ActionButton
            onClick={handleNext}
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={
              !canProceed ||
              isLoading ||
              (currentField.key === "amount" && !exchangeRate)
            }
          >
            {isLoading ? "Creating..." : isLastStep ? "Create Goal" : "Next"}
          </ActionButton>
        </div>

        {currentField.key === "amount" && !exchangeRate && (
          <div className="text-center mt-2">
            <p className="text-xs text-yellow-400">Loading exchange rate...</p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

// Quick Save Card Skeleton Component
const QuickSaveCardSkeleton = () => {
  return (
    <div className="relative">
      <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-3 text-white shadow-lg animate-pulse">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="bg-white/20 h-3 w-20 rounded mb-2"></div>
            <div className="bg-white/30 h-6 w-32 rounded"></div>
            <div className="bg-white/20 h-3 w-24 rounded mt-1"></div>
          </div>

          {/* Currency Toggle Skeleton */}
          <div className="flex items-center gap-1">
            <div className="bg-white/20 h-3 w-8 rounded"></div>
            <div className="w-8 h-4 bg-white/20 rounded-full"></div>
            <div className="bg-white/20 h-3 w-8 rounded"></div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1.5 mb-3">
          <div className="flex-1 bg-white/20 h-8 rounded-full"></div>
          <div className="flex-1 bg-white/20 h-8 rounded-full"></div>
        </div>

        {/* Balance visibility toggle */}
        <div className="flex justify-end">
          <div className="w-4 h-4 bg-white/20 rounded"></div>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <div className="flex justify-center">
        <div className="bg-gray-600 rounded-full p-1 shadow-lg mt-1.5 w-6 h-6"></div>
      </div>
    </div>
  );
};

// Goal Card Skeleton Component
const GoalCardSkeleton = () => {
  return (
    <div className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-xl p-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="bg-gray-600 h-4 w-24 rounded"></div>
        <div className="bg-gray-600 h-4 w-16 rounded"></div>
      </div>

      {/* Amount */}
      <div className="mb-4">
        <div className="bg-gray-600 h-8 w-32 rounded mb-2"></div>
        <div className="bg-gray-600 h-3 w-20 rounded"></div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="bg-gray-700 h-2 w-full rounded-full">
          <div className="bg-gray-600 h-2 w-1/3 rounded-full"></div>
        </div>
        <div className="flex justify-between mt-2">
          <div className="bg-gray-600 h-3 w-16 rounded"></div>
          <div className="bg-gray-600 h-3 w-20 rounded"></div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <div className="flex-1 bg-gray-600 h-8 rounded-lg"></div>
        <div className="flex-1 bg-gray-600 h-8 rounded-lg"></div>
      </div>
    </div>
  );
};

// Goal Details Modal Component - Following PWA Design Pattern
const GoalDetailsModal = ({
  isOpen,
  onClose,
  onSaveNow,
  goal,
  showBalance = true,
  exchangeRate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaveNow: () => void;
  goal?: any;
  showBalance?: boolean;
  exchangeRate?: number;
}) => {
  if (!goal) return null;

  const formatAmount = (amount: string) => {
    if (!showBalance) return "****";
    const usdAmount = Number(amount) || 0;
    if (isNaN(usdAmount)) return "0";
    if (exchangeRate && exchangeRate > 0) {
      const kesAmount = usdAmount * exchangeRate;
      return new Intl.NumberFormat("en-KE").format(kesAmount);
    }
    return new Intl.NumberFormat("en-KE").format(usdAmount);
  };

  const getGoalEmoji = (category: string) => {
    switch (category) {
      case "personal":
        return "";
      case "retirement":
        return "🏦";
      case "emergency":
        return "🚨";
      case "travel":
        return "✈️";
      case "education":
        return "🎓";
      case "business":
        return "💼";
      case "health":
        return "🏥";
      case "home":
        return "🏠";
      default:
        return "💰";
    }
  };

  const getGoalGradient = (category: string) => {
    switch (category) {
      case "personal":
        return "from-blue-500 to-blue-600";
      case "retirement":
        return "from-purple-500 to-purple-600";
      case "emergency":
        return "from-red-500 to-red-600";
      case "travel":
        return "from-green-500 to-green-600";
      case "education":
        return "from-yellow-500 to-yellow-600";
      case "business":
        return "from-indigo-500 to-indigo-600";
      case "health":
        return "from-pink-500 to-pink-600";
      case "home":
        return "from-orange-500 to-orange-600";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[85vh]">
      <ModalHeader
        title={goal.title}
        onClose={onClose}
        rightAction={{
          label: "Save now",
          onClick: onSaveNow,
          variant: "secondary",
        }}
      />

      {/* Goal Card Header */}
      <div
        className={`bg-gradient-to-r ${getGoalGradient(
          goal.category
        )} p-2 flex items-center justify-between`}
      >
        <div className="flex-1">
          <div className="text-xs text-white/80">Current Balance</div>
          <div className="text-xl font-bold text-white">
            KES {showBalance ? formatAmount(goal.currentAmount) : "****"}
          </div>
        </div>
        <div className="text-3xl opacity-80">{getGoalEmoji(goal.category)}</div>
      </div>

      {/* Content */}
      <div className="bg-gray-800/20 backdrop-blur-sm p-2 space-y-2 overflow-y-auto">
        {/* Balance Overview */}
        <InfoCard variant="stats">
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-0.5">Saved</div>
              <div className="text-base font-semibold text-white">
                {showBalance ? formatAmount(goal.currentAmount) : "****"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-0.5">Target</div>
              <div className="text-base font-semibold text-cyan-400">
                {showBalance ? formatAmount(goal.targetAmount) : "****"}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-600 rounded-full h-1 mt-2">
            <div
              className="bg-cyan-400 h-1 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(goal.progress || 0, 100)}%` }}
            ></div>
          </div>
          <div className="text-center mt-1">
            <span className="text-xs text-gray-400">
              {(goal.progress || 0).toFixed(1)}% complete
            </span>
          </div>
        </InfoCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-1.5">
          <ActionButton onClick={onSaveNow} variant="primary" size="sm">
            Save Money
          </ActionButton>
          <ActionButton onClick={() => {}} variant="outline" size="sm">
            Withdraw
          </ActionButton>
        </div>

        {/* Goal Information */}
        {goal.description && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-white">About this goal</h3>
            <InfoCard variant="action">
              <p className="text-xs text-gray-300 leading-relaxed">
                {goal.description}
              </p>
            </InfoCard>
          </div>
        )}

        {/* Bottom spacing for safe area */}
        <div className="h-2"></div>
      </div>
    </BottomSheet>
  );
};

// Universal Deposit Confirmation Modal
const DepositConfirmationModal = ({
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
  goalTitle = "Quick Save Goal",
  goalIcon = "🐷",
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
  goalTitle?: string;
  goalIcon?: string;
}) => {
  // Show success state if deposit is successful
  if (depositSuccess) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[90vh]">
        <ModalHeader title="Deposit Successful!" onClose={onClose} />

        <div className="bg-gray-800/20 backdrop-blur-sm p-3 space-y-4">
          <div className="text-center py-3">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">✓</span>
            </div>
            <h3 className="text-white text-base font-medium mb-1.5">
              Deposit Successful!
            </h3>
            <p className="text-gray-400 text-xs mb-3">
              Your KES {depositSuccess.amount} has been deposited to your{" "}
              {goalTitle}.
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
              <div className="text-2xl mb-2">🎉</div>
              <p className="text-gray-300 text-xs">
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

      <div className="bg-gray-800/20 backdrop-blur-sm p-4 space-y-6">
        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-300 p-3 rounded-xl text-sm">
            <div className="flex items-start gap-2 mb-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>

            {/* Show funding options if user has zero balance */}
            {(error.includes("You have KES 0") ||
              error.includes("You have $0")) && (
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
        {!(
          error?.includes("You have KES 0") || error?.includes("You have $0")
        ) && (
          <>
            {/* Confirmation Details */}
            <div className="text-center py-3">
              <div className="text-xs text-cyan-400 mb-3">
                deposit{" "}
                <div className="text-2xl font-bold text-cyan-400 mb-1.5">
                  KES {amount}
                </div>
              </div>
              <div className="text-gray-400 mb-1.5 text-xs">to your</div>
              <div className="text-base font-bold text-cyan-400">
                {goalTitle}
              </div>
            </div>

            {/* Remember Info Card */}
            <InfoCard>
              <div className="text-center">
                <div className="text-2xl mb-2">{goalIcon}</div>
                <h4 className="text-white text-base font-semibold mb-2">
                  Remember
                </h4>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Your funds will be safely deposited and start earning yield
                  immediately.
                </p>
              </div>
            </InfoCard>

            {/* Action Button */}
            <ActionButton
              onClick={onDeposit}
              variant="primary"
              size="md"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing...
                </div>
              ) : (
                "DEPOSIT"
              )}
            </ActionButton>
          </>
        )}

        {/* Bottom spacing */}
        <div className="h-2"></div>
      </div>
    </BottomSheet>
  );
};

// Expandable Quick Save Card Component
interface ExpandableQuickSaveCardProps {
  goal: any; // Quick Save goal object
  goals: any[]; // All user goals for total calculation
  userPositions?: any; // User positions data with totalValueUSD
  account?: any;
  user?: any; // User object with ID
  isLoading?: boolean;
  showBalance?: boolean;
  onToggleBalance?: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  defaultToken?: any;
  chain?: any;
  tokenInfo?: any;
  exchangeRate?: number;
  onGoalsRefetch?: () => void; // Function to refresh goals after transfer
  sendTransaction?: any; // Function for blockchain transactions
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
  // const blockchainGoals = useBlockchainGoals(); // Removed for production deployment
  const [isExpanded, setIsExpanded] = useState(false);
  const [currencyMode, setCurrencyMode] = useState<"LOCAL" | "USD">("USD");
  const [isDragging, setIsDragging] = useState(false);
  const [dragTimeout, setDragTimeout] = useState<NodeJS.Timeout | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Calculate total savings using userPositions.totalValueUSD
  const totalSavingsNum = parseFloat(userPositions?.totalValueUSD || "0");

  // Parse Quick Save goal amounts (for the expanded view)
  const quickSaveAmountNum = parseFloat(goal?.currentAmount || "0");
  const tokenSymbol = defaultToken?.symbol || "USDC";
  const tokenDecimals = defaultToken?.decimals || 6;

  // For main card display - use total savings
  const hasValidExchangeRate = exchangeRate && exchangeRate > 0;
  const totalLocalAmount = hasValidExchangeRate
    ? totalSavingsNum * exchangeRate
    : 0;

  // For expanded Quick Save display - use Quick Save amount
  const quickSaveLocalAmount = hasValidExchangeRate
    ? quickSaveAmountNum * exchangeRate
    : 0;

  // Determine primary and secondary amounts based on currency mode for TOTAL SAVINGS
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
    // Only allow toggle to LOCAL if we have a valid exchange rate
    if (currencyMode === "USD" && !hasValidExchangeRate) {
      return; // Don't toggle to LOCAL if no valid rate
    }
    setCurrencyMode((curr) => (curr === "LOCAL" ? "USD" : "LOCAL"));
  };

  // Drag and drop handlers
  const handleTouchStart = () => {
    const timeout = setTimeout(() => {
      setIsDragging(true);
    }, 500); // 500ms hold to start dragging
    setDragTimeout(timeout);
  };

  const handleTouchEnd = () => {
    if (dragTimeout) {
      clearTimeout(dragTimeout);
      setDragTimeout(null);
    }

    // If dropping on a target goal
    if (isDragging && dropTargetId) {
      handleTransferFunds(dropTargetId);
    }

    setIsDragging(false);
    setDropTargetId(null);
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

    const quickSaveAmount = parseFloat(goal?.currentAmount || "0");
    if (quickSaveAmount <= 0) {
      reportWarning("No funds available in Quick Save to transfer", {
        component: "ExpandableQuickSaveCard",
        operation: "handleTransferFunds",
        userId: user?.address,
      });
      return;
    }

    try {
      // 1. First, get available deposits from quicksave goal
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

      // 2. Select the first available deposit for transfer
      // In a more sophisticated implementation, you might want to let users choose
      // or automatically select the best deposits based on amount
      const selectedDeposit = prepareData.availableDeposits[0];

      // 3. Execute production transfer with blockchain transaction
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
          sendTransaction: sendTransaction, // Pass the sendTransaction function
        }),
      });

      if (!transferResponse.ok) {
        const errorData = await transferResponse.json();
        throw new Error(errorData.error || "Blockchain transfer failed");
      }

      const transferResult = await transferResponse.json();

      // 4. Success - refresh goals data to reflect the blockchain state
      if (onGoalsRefetch) {
        onGoalsRefetch();
      }

      // Show success feedback
      reportInfo(
        `Successfully transferred deposit ${transferResult.transferredDepositId} to target goal`,
        {
          component: "ExpandableQuickSaveCard",
          operation: "handleTransferFunds",
          transactionHash: transferResult.blockchainTransactionHash,
        }
      );
    } catch (error) {
      reportError("Failed to transfer funds", {
        component: "ExpandableQuickSaveCard",
        operation: "handleTransferFunds",
        userId: user?.address,
        additional: { error },
      });
    }
  };

  const handleDropTarget = (goalId: string, isOver: boolean) => {
    if (isDragging) {
      setDropTargetId(isOver ? goalId : null);
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

  return (
    <div className="relative">
      <div className="bg-gray-800/20 backdrop-blur-sm rounded-xl p-3 text-white shadow-lg border border-gray-700/30">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/80 text-xs font-medium">Total Savings</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold">
                {!account
                  ? "0"
                  : isLoading
                  ? "Loading..."
                  : showBalance
                  ? primaryAmount
                  : "••••"}
              </span>
            </div>
            {/* Show secondary amount */}
            {account && !isLoading && showBalance && (
              <div className="text-white/70 text-xs mt-0.5">
                {secondaryAmount}
              </div>
            )}
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-white/80">USD</span>
            <div
              className="relative w-8 h-4 bg-white/20 rounded-full cursor-pointer transition-all"
              onClick={handleCurrencyToggle}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${
                  currencyMode === "LOCAL" ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-xs text-white font-medium">KES</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1.5 mb-3">
          <button
            onClick={onDeposit}
            className="flex-1 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium py-1.5 rounded-full transition-all duration-200 flex items-center justify-center gap-1 text-sm"
          >
            <ArrowDown className="w-3 h-3" />
            Deposit
          </button>
          <button
            onClick={onWithdraw}
            className="flex-1 bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium py-1.5 rounded-full transition-all duration-200 flex items-center justify-center gap-1 text-sm"
          >
            <ArrowUp className="w-3 h-3" />
            Withdraw
          </button>
        </div>

        {/* Goals Cards - Only show when expanded */}
        {isExpanded && (
          <div className="mb-2">
            {/* Grid aligned with deposit/withdraw buttons - increased spacing */}
            <div className="grid grid-cols-2 gap-3">
              {/* Quick Save Card - Draggable */}
              <div
                className={`bg-white rounded-lg p-2 shadow-sm transition-all duration-200 relative overflow-hidden ${
                  isDragging ? "scale-105 shadow-lg ring-2 ring-cyan-400" : ""
                }`}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseUp={handleTouchEnd}
              >
                {/* Colored left section with icon - smaller */}
                <div className="absolute top-0 left-0 w-8 h-full bg-gradient-to-br from-green-400 to-green-500 rounded-l-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-white/30 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">$</span>
                  </div>
                </div>

                {/* Main content area - compact */}
                <div className="ml-10 py-1.5">
                  <div className="text-gray-900 text-sm font-bold leading-tight">
                    {isLoading
                      ? "..."
                      : quickSaveAmountNum < 0.01
                      ? "<0.01"
                      : quickSaveAmountNum.toFixed(2)}
                  </div>
                  <div className="text-gray-600 text-xs font-medium">
                    {isDragging ? "Dragging..." : "Quick Save"}
                  </div>
                </div>
              </div>

              {/* Other User Goals - Drop Targets */}
              {goals
                .filter((g) => g.category !== "quick")
                .slice(0, 5) // Limit to fit nicely in grid
                .map((userGoal, index) => {
                  const goalAmount = parseFloat(userGoal?.currentAmount || "0");
                  const isDropTarget =
                    isDragging && dropTargetId === userGoal.id;

                  // Cycle through colors for different goals
                  const colors = [
                    { from: "blue-400", to: "blue-500" },
                    { from: "purple-400", to: "purple-500" },
                    { from: "indigo-400", to: "indigo-500" },
                    { from: "pink-400", to: "pink-500" },
                    { from: "orange-400", to: "orange-500" },
                  ];
                  const colorSet = colors[index % colors.length];

                  return (
                    <div
                      key={userGoal.id}
                      className={`bg-white rounded-lg p-2 shadow-sm transition-all duration-200 relative overflow-hidden ${
                        isDragging
                          ? isDropTarget
                            ? "border-2 border-green-400 bg-green-50 shadow-lg scale-105"
                            : "border-2 border-dashed border-cyan-300 bg-cyan-50"
                          : ""
                      }`}
                      onTouchMove={(e) => {
                        if (isDragging) {
                          const touch = e.touches[0];
                          const element = document.elementFromPoint(
                            touch.clientX,
                            touch.clientY
                          );
                          const goalCard = element?.closest(
                            `[data-goal-id="${userGoal.id}"]`
                          );
                          handleDropTarget(userGoal.id, !!goalCard);
                        }
                      }}
                      data-goal-id={userGoal.id}
                    >
                      {/* Colored left section with icon - smaller */}
                      <div
                        className={`absolute top-0 left-0 w-8 h-full bg-gradient-to-br from-${colorSet.from} to-${colorSet.to} rounded-l-lg flex items-center justify-center`}
                      >
                        <div className="w-4 h-4 bg-white/30 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs"></span>
                        </div>
                      </div>

                      {/* Main content area - compact */}
                      <div className="ml-10 py-1.5">
                        <div className="text-gray-900 text-sm font-bold leading-tight">
                          {goalAmount < 0.01 ? "<0.01" : goalAmount.toFixed(2)}
                        </div>
                        <div className="text-gray-600 text-xs font-medium truncate">
                          {isDropTarget ? "Drop here!" : userGoal.title}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Add Goal Card - if user has less than 6 goals */}
              {goals.length < 6 && (
                <div className="bg-gray-50 rounded-lg p-2 shadow-sm border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-1">
                      <span className="text-gray-400 text-sm">+</span>
                    </div>
                    <p className="text-gray-500 text-xs font-medium">
                      Add Goal
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Drag instruction */}
            {isDragging && (
              <div className="text-center py-2">
                <p className="text-cyan-400 text-sm font-medium">
                  Drop Quick Save on any goal to transfer funds
                </p>
              </div>
            )}

            {/* Show message if no additional goals */}
            {goals.filter((g) => g.category !== "quick").length === 0 && (
              <div className="mt-3 bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-gray-500 text-sm">No additional goals yet</p>
                <p className="text-gray-400 text-xs mt-1">
                  Create goals to organize your savings
                </p>
              </div>
            )}
          </div>
        )}

        {/* Balance visibility toggle */}
        {account && (
          <div className="flex justify-end">
            <button
              onClick={onToggleBalance}
              className="text-white/60 hover:text-white/80 transition-colors p-0.5"
            >
              {showBalance ? (
                <EyeOff className="w-3 h-3" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Expand/Collapse Button */}
      <div className="flex justify-center">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="bg-gray-600 hover:bg-gray-700 text-white rounded-full p-1 shadow-lg transition-all mt-1.5"
        >
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
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
  const { chain, tokens, tokenInfos } = useChain();

  // Accessibility: Announce dynamic content changes
  const [announcements, setAnnouncements] = useState<string[]>([]);

  // Blockchain goals integration removed for production deployment
  // const blockchainGoals = useBlockchainGoals();

  // Utility function to format token amounts from raw decimals
  const formatTokenAmount = (amount: string, decimals: number): string => {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;

    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
    const trimmedFractional = fractionalStr.replace(/0+$/, "");

    return trimmedFractional
      ? `${wholePart}.${trimmedFractional}`
      : wholePart.toString();
  };

  const defaultToken = useMemo(() => {
    if (!tokens || tokens.length === 0) return null;

    const usdc = tokens.find((t) => t.symbol.toUpperCase() === "USDC");
    if (usdc) return usdc;

    const stablecoins = tokens.filter((t) =>
      ["USDT", "CUSD", "USDC"].includes(t.symbol.toUpperCase())
    );
    if (stablecoins.length > 0) return stablecoins[0];

    return tokens[0];
  }, [tokens]);

  const supportedStablecoins = useMemo(() => {
    if (!tokens) return [];

    if (chain?.id === 42220) {
      const allowedSymbols = ["USDC", "USDT", "CUSD"];
      return tokens
        .filter((t) => allowedSymbols.includes(t.symbol.toUpperCase()))
        .map((t) => t.address);
    } else if (chain?.id === 534352) {
      const allowedSymbols = ["USDC", "WETH"];
      return tokens
        .filter((t) => allowedSymbols.includes(t.symbol.toUpperCase()))
        .map((t) => t.address);
    }
    return tokens.map((t) => t.address);
  }, [tokens, chain?.id]);

  const { data: walletBalanceData, isLoading: isBalanceLoading } =
    useWalletBalance({
      client,
      chain,
      address: account?.address,
      tokenAddress: defaultToken?.address,
    });

  // User portfolio from backend API
  const [userPortfolio, setUserPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  const fetchUserPortfolio = async () => {
    if (!account?.address) return;

    setPortfolioLoading(true);
    setPortfolioError(null);

    try {
      const data = await backendApiClient.getUserPortfolio(account.address);
      setUserPortfolio(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setPortfolioError(errorMessage);
      setUserPortfolio({
        totalValueUSD: "0",
        leaderboardScore: "0",
        formattedLeaderboardScore: "0.00",
        leaderboardRank: 0,
        assetBalances: [],
      });
      reportError("Failed to fetch user portfolio", {
        component: "AppPage",
        operation: "fetchUserPortfolio",
        additional: { error: errorMessage },
      });
    } finally {
      setPortfolioLoading(false);
    }
  };

  useEffect(() => {
    if (account?.address && !portfolioLoading && !userPortfolio) {
      fetchUserPortfolio();
    }
  }, [account?.address]);

  // Multi-vault goals from backend API
  const [userGoals, setUserGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  
  // Leaderboard from backend API
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [userScore, setUserScore] = useState<{rank: number; formattedScore: string} | null>(null);

  const { rates, getKESRate, loading: ratesLoading } = useExchangeRates();

  const fetchUserGoals = async () => {
    if (!account?.address) return;
    setGoalsLoading(true);
    setGoalsError(null);
    try {
      console.log('Fetching goals for address:', account.address);
      const goals = await backendApiClient.getGoalsWithProgress(account.address);
      console.log('Received goals:', goals);
      setUserGoals(goals);
    } catch (error) {
      console.error('Error fetching goals:', error);
      setGoalsError(error instanceof Error ? error.message : "Failed to load goals");
      setUserGoals([]);
    } finally {
      setGoalsLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const [leaderboardData, userPortfolioData] = await Promise.all([
        backendApiClient.getLeaderboard(0, 10),
        account?.address ? backendApiClient.getUserPortfolio(account.address) : null
      ]);
      setLeaderboard(leaderboardData.data.map((entry, index) => ({
        ...entry,
        isCurrentUser: account?.address === entry.address
      })));
      if (userPortfolioData) {
        setUserScore({
          rank: userPortfolioData.leaderboardRank,
          formattedScore: userPortfolioData.formattedLeaderboardScore
        });
      }
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : "Failed to load leaderboard");
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const forceRefresh = () => {
    fetchUserPortfolio();
    fetchUserGoals();
    fetchLeaderboard();
  };

  const refetchGoals = () => {
    fetchUserGoals();
  };

  const refetchLeaderboard = () => {
    fetchLeaderboard();
  };

  // Initialize data fetching
  useEffect(() => {
    if (account?.address) {
      fetchUserGoals();
      fetchLeaderboard();
    }
  }, [account?.address]);

  // State for the new design
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [saveActionsModalOpen, setSaveActionsModalOpen] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "goals" | "groups" | "leaderboard" | "profile"
  >("goals");

  // Group goals state
  const [groupGoals, setGroupGoals] = useState<GroupSavingsGoal[]>([]);
  const [groupGoalsLoading, setGroupGoalsLoading] = useState(false);
  const [groupGoalsError, setGroupGoalsError] = useState<string | null>(null);
  const [myGroups, setMyGroups] = useState<{ total: number; public: { total: number; goals: GroupSavingsGoal[] }; private: { total: number; goals: GroupSavingsGoal[] } } | null>(null);
  const [myGroupsLoading, setMyGroupsLoading] = useState(false);
  const [createGroupGoalModalOpen, setCreateGroupGoalModalOpen] = useState(false);
  const [groupGoalForm, setGroupGoalForm] = useState({
    name: "",
    amount: "",
    timeline: "3",
    isPublic: true,
  });

  // Join Goal modal states
  const [joinGoalModalOpen, setJoinGoalModalOpen] = useState(false);
  const [selectedGoalToJoin, setSelectedGoalToJoin] = useState<GroupSavingsGoal | null>(null);
  const [joinGoalLoading, setJoinGoalLoading] = useState(false);
  const [joinGoalError, setJoinGoalError] = useState<string | null>(null);

  // Quick Save modal states
  const [quickSaveDetailsOpen, setQuickSaveDetailsOpen] = useState(false);
  const [quickSaveAmountOpen, setQuickSaveAmountOpen] = useState(false);
  const [quickSaveConfirmationOpen, setQuickSaveConfirmationOpen] =
    useState(false);
  const [quickSaveAmount, setQuickSaveAmount] = useState("100");
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [vaultPositions, setVaultPositions] = useState<WithdrawableDeposit[]>(
    []
  );
  const [vaultPositionsLoading, setVaultPositionsLoading] = useState(false);

  // Goal modal states (following same pattern as Quick Save)
  const [goalDetailsOpen, setGoalDetailsOpen] = useState(false);
  const [goalAmountOpen, setGoalAmountOpen] = useState(false);
  const [goalConfirmationOpen, setGoalConfirmationOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [goalAmount, setGoalAmount] = useState("100");

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
  const [selectedDepositToken, setSelectedDepositToken] = useState<any>(null);

  // Mobile money onramp states
  const [showOnrampModal, setShowOnrampModal] = useState(false);
  const [selectedTokenForOnramp, setSelectedTokenForOnramp] = useState("");
  const [copied, setCopied] = useState(false);
  const [pendingDeposit, setPendingDeposit] = useState(false);

  // Custom Goal modal states
  const [customGoalModalOpen, setCustomGoalModalOpen] = useState(false);
  const [customGoalForm, setCustomGoalForm] = useState({
    name: "",
    amount: "",
    timeline: "3", // months
    category: "custom",
  });

  // Goals data is now fetched from API via useGoals hook above

  // Validate chain configuration
  const chainConfigValid = useMemo(() => {
    return chain && tokens && tokens.length > 0 && tokenInfos;
  }, [chain, tokens, tokenInfos]);

  // Chain-aware messaging
  const getChainDisplayName = () => {
    if (!chain) return "Unknown Network";
    return chain.name;
  };

  // Keyboard navigation handler
  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (event.key === "g" && event.ctrlKey) {
      event.preventDefault();
      setActiveTab("goals");
      setAnnouncements(["Switched to Goals tab"]);
    } else if (event.key === "l" && event.ctrlKey) {
      event.preventDefault();
      setActiveTab("leaderboard");
      setAnnouncements(["Switched to Leaderboard tab"]);
    } else if (event.key === "p" && event.ctrlKey) {
      event.preventDefault();
      setActiveTab("profile");
      setAnnouncements(["Switched to Profile tab"]);
    }
  };

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

  // Fetch group goals when groups tab is active
  useEffect(() => {
    if (activeTab === "groups") {
      fetchGroupGoals();
      fetchMyGroups();
    }
  }, [activeTab, account?.address]);

  const fetchGroupGoals = async () => {
    setGroupGoalsLoading(true);
    setGroupGoalsError(null);
    try {
      const response = await backendApiClient.getPublicGoals();
      setGroupGoals(response.goals);
    } catch (error) {
      setGroupGoalsError(error instanceof Error ? error.message : "Failed to load group goals");
      setGroupGoals([]);
    } finally {
      setGroupGoalsLoading(false);
    }
  };

  const fetchMyGroups = async () => {
    if (!account?.address) return;
    setMyGroupsLoading(true);
    try {
      const response = await backendApiClient.getMyGroups(account.address);
      setMyGroups(response);
    } catch (error) {
      reportError("Failed to fetch user's groups", {
        component: "AppPage",
        operation: "fetchMyGroups",
        additional: { error },
      });
      setMyGroups(null);
    } finally {
      setMyGroupsLoading(false);
    }
  };

  const handleCreateGroupGoal = async () => {
    if (!groupGoalForm.name.trim() || !groupGoalForm.amount.trim()) {
      reportWarning("Goal name and amount are required", {
        component: "AppPage",
        operation: "handleCreateGroupGoal",
      });
      return;
    }

    if (!account?.address) {
      reportWarning("Please connect your wallet to create a group goal", {
        component: "AppPage",
        operation: "handleCreateGroupGoal",
      });
      return;
    }

    const kesAmount = parseFloat(groupGoalForm.amount.replace(/,/g, ""));
    if (kesAmount <= 0) {
      reportWarning("Target amount must be greater than 0", {
        component: "AppPage",
        operation: "handleCreateGroupGoal",
      });
      return;
    }

    const exchangeRate = getKESRate();
    if (!exchangeRate) {
      reportWarning("Exchange rate not available. Please try again.", {
        component: "AppPage",
        operation: "handleCreateGroupGoal",
      });
      return;
    }

    const usdAmount = kesAmount / exchangeRate;
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + parseInt(groupGoalForm.timeline));

    const createRequest: CreateGoalRequest = {
      name: groupGoalForm.name,
      targetAmountUSD: usdAmount,
      targetDate: targetDate.toISOString(),
      creatorAddress: account.address,
      vaults: "all",
      isPublic: groupGoalForm.isPublic,
    };

    try {
      await backendApiClient.createGroupGoal(createRequest);
      setCreateGroupGoalModalOpen(false);
      setGroupGoalForm({ name: "", amount: "", timeline: "3", isPublic: true });
      fetchGroupGoals(); // Refresh the list
      reportInfo("Group goal created successfully", {
        component: "AppPage",
        operation: "handleCreateGroupGoal",
      });
    } catch (error) {
      reportError("Failed to create group goal", {
        component: "AppPage",
        operation: "handleCreateGroupGoal",
        additional: { error },
      });
    }
  };

  const handleJoinGroupGoal = async (goal: GroupSavingsGoal) => {
    if (!account?.address) {
      reportWarning("Please connect your wallet to join a group goal", {
        component: "AppPage",
        operation: "handleJoinGroupGoal",
      });
      return;
    }
    
    setSelectedGoalToJoin(goal);
    setJoinGoalModalOpen(true);
    setJoinGoalError(null);
  };

  const handleJoinGoalWithAmount = async (amount: string) => {
    if (!selectedGoalToJoin || !account?.address) return;

    setJoinGoalLoading(true);
    setJoinGoalError(null);

    try {
      // Convert KES to USD
      const exchangeRate = getKESRate();
      if (!exchangeRate) {
        throw new Error("Exchange rate not available");
      }

      const kesAmount = parseFloat(amount);
      const usdAmount = kesAmount / exchangeRate;

      // Get best stablecoin for deposit
      const bestToken = await getBestStablecoinForDeposit(account.address, chain.id);
      if (!bestToken) {
        throw new Error("No stablecoin with balance available. Please add funds to your wallet first.");
      }

      // Check if user has sufficient balance
      if (bestToken.balance < usdAmount) {
        throw new Error(`Insufficient balance. You have $${bestToken.balance.toFixed(2)} but need $${usdAmount.toFixed(2)}`);
      }

      // Prepare deposit transaction
      const selectedToken = {
        address: bestToken.address,
        symbol: bestToken.symbol,
        decimals: bestToken.decimals,
      };

      const chainId = chain.id;
      const isVaultChain = hasVaultContracts(chainId);

      if (!isVaultChain) {
        throw new Error("This chain is not yet supported for deposits");
      }

      const amountWei = parseUnits(usdAmount.toString(), selectedToken.decimals);
      const vaultAddress = getVaultAddress(chainId, selectedToken.symbol);

      const vaultContract = getContract({
        client,
        chain: chain,
        address: vaultAddress,
        abi: vaultABI,
      });

      // Use 30-day lock period
      const lockTierId = 1;

      const depositTx = prepareContractCall({
        contract: vaultContract,
        method: "deposit",
        params: [amountWei, BigInt(lockTierId)],
        erc20Value: {
          tokenAddress: selectedToken.address,
          amountWei,
        },
      });

      // Get approval if needed
      const approveTx = await getApprovalForTransaction({
        transaction: depositTx as any,
        account: account,
      });

      if (approveTx) {
        const approveResult = await sendTransaction(approveTx);
        if (approveResult?.transactionHash) {
          await waitForReceipt({
            client,
            chain,
            transactionHash: approveResult.transactionHash,
          });
        }
      }

      // Send deposit transaction
      const depositResult = await sendTransaction(depositTx);
      if (depositResult?.transactionHash) {
        const depositReceipt = await waitForReceipt({
          client,
          chain,
          transactionHash: depositResult.transactionHash,
        });

        // Allocate deposit to the group goal
        const mappedAsset = mapTokenSymbolToAsset(selectedToken.symbol);
        if (!mappedAsset) {
          throw new Error(`Unsupported token: ${selectedToken.symbol}`);
        }

        const allocationRequest = {
          asset: mappedAsset,
          userAddress: account.address,
          amount: amountWei.toString(),
          txHash: depositResult.transactionHash,
          targetGoalId: selectedGoalToJoin.metaGoalId,
        };

        await backendApiClient.joinGoalWithAllocation(allocationRequest);

        // Success - close modal and refresh data
        setJoinGoalModalOpen(false);
        setSelectedGoalToJoin(null);
        fetchGroupGoals();
        fetchMyGroups();
        fetchUserPortfolio();

        reportInfo(`Successfully joined ${selectedGoalToJoin.name}`, {
          component: "AppPage",
          operation: "handleJoinGoalWithAmount",
          transactionHash: depositResult.transactionHash,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to join group goal";
      setJoinGoalError(errorMessage);
      reportError("Failed to join group goal", {
        component: "AppPage",
        operation: "handleJoinGoalWithAmount",
        additional: { error },
      });
    } finally {
      setJoinGoalLoading(false);
    }
  };



  const handleSaveActionSelect = (actionId: string) => {
    setSaveActionsModalOpen(false);
    // Handle the different save actions from main SAVE button
    switch (actionId) {
      case "quick":
        // Handle quick save
        setQuickSaveDetailsOpen(true);
        break;
      default:
        // Unknown save action selected
        break;
    }
  };

  const handleGoalCardClick = (goal: any) => {
    // Open goal details modal following PWA design pattern
    setSelectedGoal(goal);
    setGoalDetailsOpen(true);
  };

  // Goal modal handlers (following Quick Save pattern)
  const handleGoalSaveNow = () => {
    setGoalDetailsOpen(false);
    setGoalAmountOpen(true);
  };

  const handleGoalAmountContinue = (amount: string) => {
    setGoalAmount(amount);
    setGoalAmountOpen(false);
    setGoalConfirmationOpen(true);
  };

  const closeAllGoalModals = () => {
    setGoalDetailsOpen(false);
    setGoalAmountOpen(false);
    setGoalConfirmationOpen(false);
    setSelectedGoal(null);
    // Reset any goal-specific states if needed
  };

  const handleCreateCustomGoal = async () => {
    if (!customGoalForm.name.trim() || !customGoalForm.amount.trim()) {
      reportWarning("Goal name and amount are required", {
        component: "AppPage",
        operation: "handleCreateCustomGoal",
      });
      return;
    }

    if (!account?.address) {
      reportWarning("Please connect your wallet to create a goal", {
        component: "AppPage",
        operation: "handleCreateCustomGoal",
      });
      return;
    }

    const kesAmount = parseFloat(customGoalForm.amount.replace(/,/g, ""));
    if (kesAmount <= 0) {
      reportWarning("Target amount must be greater than 0", {
        component: "AppPage",
        operation: "handleCreateCustomGoal",
      });
      return;
    }

    const exchangeRate = getKESRate();
    if (!exchangeRate) {
      reportWarning("Exchange rate not available. Please try again.", {
        component: "AppPage",
        operation: "handleCreateCustomGoal",
      });
      return;
    }

    const usdAmount = kesAmount / exchangeRate;
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + parseInt(customGoalForm.timeline));

    const createRequest: CreateGoalRequest = {
      name: customGoalForm.name,
      targetAmountUSD: usdAmount,
      targetDate: targetDate.toISOString(),
      creatorAddress: account.address,
      vaults: "all",
      isPublic: false,
    };

    try {
      await backendApiClient.createGroupGoal(createRequest);
      setCustomGoalModalOpen(false);
      setCustomGoalForm({ name: "", amount: "", timeline: "3", category: customGoalForm.category });
      fetchUserGoals();
      reportInfo("Goal created successfully", {
        component: "AppPage",
        operation: "handleCreateCustomGoal",
      });
    } catch (error) {
      reportError("Failed to create goal", {
        component: "AppPage",
        operation: "handleCreateCustomGoal",
        additional: { error },
      });
    }
  };

  const toggleBalanceVisibility = () => {
    setShowBalances(!showBalances);
  };

  // Smart handler for "Create Your First Goal" button
  const handleCreateFirstGoal = () => {
    // Check if user is authenticated (has connected wallet)
    if (!account || !isConnected) {
      // User is not authenticated - redirect to profile tab to sign in
      setActiveTab("profile");
    } else {
      // User is authenticated - proceed to goal creation
      setCustomGoalModalOpen(true);
    }
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
  const prepareQuickSaveDepositTransaction = async (
    amount: string,
    token?: any
  ) => {
    const selectedToken = token || defaultToken;
    if (!selectedToken || !account || !chain) {
      throw new Error("Missing required parameters");
    }

    const chainId = chain.id;
    const isVaultChain = hasVaultContracts(chainId);

    if (!isVaultChain) {
      throw new Error("This chain is not yet supported for deposits");
    }

    const decimals = selectedToken.decimals || 18;
    const amountWei = parseUnits(amount, decimals);
    const tokenSymbol = selectedToken.symbol;

    try {
      const vaultAddress = getVaultAddress(chainId, tokenSymbol);

      const vaultContract = getContract({
        client,
        chain: chain,
        address: vaultAddress,
        abi: vaultABI,
      });

      // Use 30-day lock period for Quick Save (lockTierId = 1)
      const lockTierId = 1;

      const depositTx = prepareContractCall({
        contract: vaultContract,
        method: "deposit",
        params: [amountWei, BigInt(lockTierId)],
        erc20Value: {
          tokenAddress: selectedToken.address,
          amountWei,
        },
      });

      return depositTx;
    } catch (error) {
      reportError("[QuickSave] Error preparing vault transaction", {
        component: "AppPage",
        operation: "prepareQuickSaveDepositTransaction",
        chainId: chain?.id,
        tokenSymbol: selectedToken.symbol,
        additional: { error },
      });
      throw error;
    }
  };

  // Handle transaction errors with user-friendly messages
  const handleDepositError = (error: Error) => {
    console.log("🔍 Handling deposit error:", error.message);
    let userMessage = "Transaction failed. Please try again.";

    if (
      error.message.includes("user rejected") ||
      error.message.includes("User rejected")
    ) {
      console.log("📝 Mapped to: Transaction cancelled");
      userMessage = "Transaction was cancelled.";
    } else if (error.message.includes("insufficient funds")) {
      console.log("📝 Mapped to: Insufficient funds");
      userMessage = "Insufficient funds for this transaction.";
    } else if (error.message.includes("transfer amount exceeds allowance")) {
      console.log("📝 Mapped to: Token approval failed");
      userMessage = "Token approval failed. Please try again.";
    } else if (error.message.includes("network")) {
      console.log("📝 Mapped to: Network error");
      userMessage =
        "Network error. Please check your connection and try again.";
    } else {
      console.log("📝 Using default error message");
    }

    console.log("📢 Setting error message:", userMessage);
    setDepositError(userMessage);
  };

  // Handle successful transaction
  const handleDepositSuccess = async (
    receipt: any,
    usdAmount?: number,
    selectedToken?: any
  ) => {
    // Report successful transaction for monitoring
    reportInfo("Quick Save deposit successful", {
      component: "AppPage",
      operation: "handleDepositSuccess",
      transactionHash: receipt?.transactionHash,
      amount: quickSaveAmount,
      tokenSymbol: selectedToken?.symbol || defaultToken?.symbol,
      chainId: chain?.id,
    });

    // Set the success state
    const successAmount = goalConfirmationOpen ? goalAmount : quickSaveAmount;
    setDepositSuccess({
      amount: successAmount,
      transactionHash: receipt.transactionHash,
    });

    // Call backend allocation API
    try {
      if (account?.address && defaultToken && receipt?.transactionHash) {
        const amountWei = parseUnits(
          (usdAmount || parseFloat(successAmount)).toString(),
          defaultToken.decimals || 6
        );

        // Map token symbol to supported asset
        const mappedAsset = mapTokenSymbolToAsset(selectedToken?.symbol || defaultToken.symbol);
        if (!mappedAsset) {
          throw new Error(`Unsupported token: ${selectedToken?.symbol || defaultToken.symbol}`);
        }

        const allocationRequest = {
          asset: mappedAsset,
          userAddress: account.address,
          amount: amountWei.toString(),
          txHash: receipt.transactionHash,
          targetGoalId: goalConfirmationOpen && selectedGoal?.onChainGoals?.[mappedAsset] ? selectedGoal.onChainGoals[mappedAsset] : undefined,
        };

        console.log("🎯 Allocation Request:", {
          ...allocationRequest,
          goalConfirmationOpen,
          selectedGoalOnChainId: selectedGoal?.onChainGoals?.[mappedAsset],
          selectedGoalTitle: selectedGoal?.title,
          isQuickSave: !allocationRequest.targetGoalId
        });

        try {
          const allocationResult = await backendApiClient.allocateDeposit(allocationRequest);
          
          console.log("📊 Allocation Result:", allocationResult);
          
          if (allocationResult && allocationResult.success) {
            console.log("✅ Deposit attached to goalId:", allocationResult.goalId || 'quicksave');
            reportInfo("Backend allocation completed successfully", {
              component: "AppPage",
              operation: "handleDepositSuccess",
              transactionHash: receipt.transactionHash,
              additional: {
                goalId: allocationResult.goalId,
                depositId: allocationResult.depositId,
                shares: allocationResult.shares,
                formattedShares: allocationResult.formattedShares,
                targetGoalId: allocationRequest.targetGoalId,
              },
            });
          } else {
            console.warn("⚠️ Allocation completed but with issues:", allocationResult);
            reportWarning("Deposit successful but allocation may have issues", {
              component: "AppPage",
              operation: "handleDepositSuccess",
              transactionHash: receipt.transactionHash,
              additional: { allocationResult, targetGoalId: allocationRequest.targetGoalId }
            });
          }
        } catch (allocationError) {
          console.error("❌ Allocation Error:", allocationError);
          reportWarning("Deposit successful but allocation tracking failed", {
            component: "AppPage",
            operation: "handleDepositSuccess",
            transactionHash: receipt.transactionHash,
            error: allocationError,
            additional: { targetGoalId: allocationRequest.targetGoalId }
          });
        }
      }
    } catch (error) {
      reportError(error as Error, {
        component: "AppPage",
        operation: "handleDepositSuccess",
        transactionHash: receipt?.transactionHash,
      });
    }

    // Update data after allocation
    try {
      await fetchUserPortfolio();
      await fetchUserGoals();
    } catch (error) {
      reportError(error as Error, {
        component: "AppPage",
        operation: "handleDepositSuccess",
        transactionHash: receipt?.transactionHash,
      });
    }

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
    const depositAmount = goalConfirmationOpen ? goalAmount : quickSaveAmount;
    console.log("🚀 Starting deposit process");
    console.log("Account:", account?.address);
    console.log("Default token:", defaultToken);
    console.log("Deposit amount:", depositAmount);

    if (!account) {
      console.log("❌ No account connected");
      setPendingDeposit(true);
      setDepositError("Connecting wallet automatically...");
      return;
    }

    if (!chain) {
      console.log("❌ No chain available");
      setDepositError("Network not available");
      return;
    }

    // Select the best stablecoin for deposit
    console.log("🔍 Selecting best stablecoin for deposit");
    let bestToken;
    try {
      bestToken = await getBestStablecoinForDeposit(account.address, chain.id);
      console.log("Selected token:", bestToken);
    } catch (error) {
      console.log("❌ Error selecting stablecoin:", error);
      setDepositError("Failed to check available tokens for deposit");
      setIsDepositLoading(false);
      return;
    }

    if (!bestToken) {
      console.log("❌ No stablecoin with balance available");
      setDepositError("You have $0 in your wallet. To deposit, please add funds using Mobile Money or transfer from another wallet.");
      setIsDepositLoading(false);
      return;
    }

    // Use the selected token instead of defaultToken
    const selectedToken = {
      address: bestToken.address,
      symbol: bestToken.symbol,
      decimals: bestToken.decimals,
    };

    // Update the component state for the modal
    setSelectedDepositToken(selectedToken);

    const walletBalance = bestToken.balance;
    const hasBalanceData = true; // We just fetched it
    const inputAmountKES = parseFloat(depositAmount);

    console.log(
      "Wallet balance:",
      walletBalance,
      "Has balance data:",
      hasBalanceData
    );
    console.log("Input amount KES:", inputAmountKES);

    setIsDepositLoading(true);
    setDepositError(null);
    setTransactionStatus("processing...");

    try {
      console.log("🔄 Starting currency conversion");
      // Convert KES amount to USD equivalent using exchange rate API
      const exchangeRateResponse = await fetch("/api/onramp/exchange-rate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currency_code: "KES" }),
      });

      console.log(
        "Exchange rate response status:",
        exchangeRateResponse.status
      );

      if (!exchangeRateResponse.ok) {
        console.log("❌ Exchange rate API failed");
        throw new Error(
          "Failed to get exchange rate for KES to USD conversion"
        );
      }

      const exchangeRateData = await exchangeRateResponse.json();
      console.log("Exchange rate data:", exchangeRateData);
      console.log("Nested data object:", exchangeRateData.data.data);

      if (!exchangeRateData.success || !exchangeRateData.data) {
        console.log("❌ Invalid exchange rate response structure");
        throw new Error("Invalid exchange rate response");
      }

      // The API returns buying_rate and selling_rate in KES per USD
      // selling_rate: 130.59 means 1 USD = 130.59 KES, so 1 KES = 1/130.59 USD
      const sellingRate = exchangeRateData.data.data?.selling_rate;
      console.log("Selling rate (KES per USD):", sellingRate);

      if (!sellingRate || sellingRate <= 0) {
        console.log("❌ Invalid selling rate:", sellingRate);
        throw new Error(
          "Exchange rate data does not contain valid selling rate"
        );
      }

      const usdPerKES = 1 / sellingRate;
      console.log("Calculated USD per KES:", usdPerKES);

      const usdAmount = inputAmountKES * usdPerKES;
      console.log(
        `✅ Converting ${inputAmountKES} KES to ${usdAmount} USD (rate: ${usdPerKES})`
      );

      // Check if converted USD amount exceeds wallet balance (only if balance data is available)
      if (hasBalanceData && usdAmount > walletBalance) {
        setDepositError(
          `Amount exceeds available balance of $${walletBalance.toFixed(
            2
          )} in ${selectedToken.symbol}`
        );
        setIsDepositLoading(false);
        return;
      }

      // Report transaction start for monitoring
      reportInfo("Deposit started", {
        component: "AppPage",
        operation: "handleQuickSaveDeposit",
        amount: depositAmount,
        tokenSymbol: selectedToken.symbol,
        chainId: chain?.id,
        userId: account?.address,
      });

      setTransactionStatus("Setting up your deposit...");
      console.log("📋 Preparing deposit transaction for amount:", usdAmount);

      const depositTx = await prepareQuickSaveDepositTransaction(
        usdAmount.toString(),
        selectedToken
      );
      console.log("✅ Deposit transaction prepared");

      // Get approval if needed
      console.log("🔐 Checking for approval transaction");
      const approveTx = await getApprovalForTransaction({
        transaction: depositTx as any,
        account: account,
      });
      console.log("Approval needed:", !!approveTx);

      if (approveTx) {
        console.log("🚀 Sending approval transaction");
        setTransactionStatus("Authorizing transaction...");
        const approveResult = await sendTransaction(approveTx);
        console.log("Approval result:", approveResult);

        if (approveResult?.transactionHash) {
          console.log("⏳ Waiting for approval receipt");
          setTransactionStatus("Processing authorization...");
          await waitForReceipt({
            client,
            chain,
            transactionHash: approveResult.transactionHash,
          });
          console.log("✅ Approval confirmed");
        }
      }

      console.log("🚀 Sending deposit transaction");
      setTransactionStatus("Completing your deposit...");

      const depositResult = await sendTransaction(depositTx);
      console.log("Deposit result:", depositResult);

      if (depositResult?.transactionHash) {
        setTransactionStatus("Almost done...");
        const depositReceipt = await waitForReceipt({
          client,
          chain,
          transactionHash: depositResult.transactionHash,
        });
        console.log("✅ Deposit transaction successful");
        setTransactionStatus("Success!");
        handleDepositSuccess(depositReceipt, usdAmount, selectedToken);

        // Report to Divvi after successful transaction
        try {
          reportTransactionToDivvi(depositResult.transactionHash, chain.id);
        } catch (error) {
          // Divvi reporting failed - transaction still succeeded
        }
      }
    } catch (err: any) {
      console.log("❌ Deposit failed with error:", err);
      console.log("Error message:", err.message);
      console.log("Error stack:", err.stack);
      setTransactionStatus(null);
      handleDepositError(err);
    } finally {
      console.log("🏁 Deposit process finished");
      setIsDepositLoading(false);
    }
  };

  const handleVaultWithdrawal = async (
    tokenSymbol: string,
    depositIds: number[]
  ) => {
    // Check wallet connection - this is the primary requirement
    if (!account?.address) {
      throw new Error(
        "Wallet not connected. Please connect your wallet to withdraw."
      );
    }

    if (!chain?.id) {
      throw new Error(
        "Network not detected. Please ensure you're connected to a supported network."
      );
    }

    if (!depositIds || depositIds.length === 0) {
      throw new Error("No deposits selected for withdrawal.");
    }

    // Use connected wallet address - this is what matters for the blockchain transaction
    const userAddress = account.address;

    const withdrawMethodABI = {
      inputs: [{ internalType: "uint256", name: "depositId", type: "uint256" }],
      name: "withdraw",
      outputs: [
        { internalType: "uint256", name: "amountWithdrawn", type: "uint256" },
      ],
      stateMutability: "nonpayable",
      type: "function",
    } as const;

    const vaultAddress = getVaultAddress(chain.id, tokenSymbol);
    if (!vaultAddress) {
      throw new Error(
        `No vault address found for ${tokenSymbol} on chain ${chain.id}`
      );
    }

    try {
      // Process each deposit withdrawal
      for (const depositId of depositIds) {
        const vaultContract = getContract({
          client,
          chain,
          address: vaultAddress,
        });

        // Prepare withdrawal transaction
        const withdrawTx = prepareContractCall({
          contract: vaultContract,
          method: withdrawMethodABI,
          params: [BigInt(depositId)],
        });

        // Send transaction
        const result = await sendTransaction(withdrawTx);

        // Wait for transaction to be confirmed
        await waitForReceipt({
          client,
          chain,
          transactionHash: result.transactionHash,
        });

        // Record the withdrawal in the backend
        // Note: In a full implementation, you'd want to get the actual withdrawal amount and yield from the transaction receipt
        await fetch(`/api/goals/vault-withdraw`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: userAddress,
            chainId: chain.id,
            depositId,
            transactionHash: result.transactionHash,
            withdrawnAmount: "0", // Should be extracted from transaction receipt
            yieldEarned: "0", // Should be extracted from transaction receipt
          }),
        });
      }

      // Refresh data after successful withdrawal
      await Promise.all([fetchUserGoals(), fetchUserPortfolio()]);
    } catch (error) {
      reportError("Vault withdrawal failed", {
        component: "AppPage",
        operation: "handleVaultWithdrawal",
        chainId: chain?.id,
        tokenSymbol,
        additional: { error, depositIds },
      });
      throw error;
    }
  };

  const fetchVaultPositions = async () => {
    if (!account?.address || !chain || !tokens) {
      return;
    }

    setVaultPositionsLoading(true);
    try {
      const tokenSymbols = tokens.map((token) => token.symbol);

      const positions = await vaultService.getAllVaultPositions(
        chain,
        account.address,
        tokenSymbols
      );

      // Transform service VaultPosition[] to WithdrawableDeposit[]
      const withdrawableDeposits: WithdrawableDeposit[] = [];

      positions.forEach((position: VaultPosition) => {
        position.deposits.forEach((deposit: VaultDeposit) => {
          // Convert raw amounts to human-readable using token decimals
          const formattedPrincipal = formatTokenAmount(
            deposit.principal,
            position.decimals
          );
          const formattedCurrentValue = formatTokenAmount(
            deposit.currentValue,
            position.decimals
          );

          const withdrawableAmount = deposit.canWithdraw
            ? formattedCurrentValue
            : "0";

          withdrawableDeposits.push({
            depositId: deposit.depositId,
            tokenAddress: position.tokenAddress,
            tokenSymbol: position.tokenSymbol,
            amount: formattedPrincipal,
            withdrawableAmount,
            lockTier: 0, // Default value since not in service interface
            depositTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // Default to 30 days ago
            unlockTime: deposit.lockEnd * 1000, // Convert to milliseconds
          });
        });
      });

      setVaultPositions(withdrawableDeposits);
    } catch (error) {
      reportError("Failed to fetch vault positions", {
        component: "AppPage",
        operation: "fetchVaultPositions",
        chainId: chain?.id,
        additional: { error },
      });
      setVaultPositions([]);
    } finally {
      setVaultPositionsLoading(false);
    }
  };

  // Effect to fetch vault positions when withdrawal modal opens
  useEffect(() => {
    if (withdrawalModalOpen && account?.address && chain) {
      fetchVaultPositions();
    }
  }, [withdrawalModalOpen, account?.address, chain?.id]);

  // Create quick save goal from portfolio data
  const combinedGoals = useMemo(() => {
    const quickSaveGoal = {
      id: "quicksave",
      title: "Quick Save",
      description: "Save without a specific goal",
      currentAmount: userPortfolio?.totalValueUSD || "0",
      targetAmount: "0",
      progress: 0,
      category: "quick" as const,
      status: "active" as const,
    };

    // Map API response to UI format compatible with GoalCard
    const mappedUserGoals = userGoals.map((goal: any) => ({
      id: goal._id,
      metaGoalId: goal.metaGoalId,
      title: goal.name,
      name: goal.name,
      description: goal.targetDate && goal.targetDate !== "0" 
        ? `Target: $${goal.targetAmountUSD} by ${new Date(goal.targetDate).toLocaleDateString()}` 
        : `Target: $${goal.targetAmountUSD}`,
      currentAmount: goal.totalProgressUSD?.toString() || "0",
      targetAmount: goal.targetAmountUSD?.toString() || "0",
      progress: Math.min(goal.progressPercent || 0, 100),
      category: "personal" as const,
      status: "active" as const,
      // Additional fields from API
      targetAmountUSD: goal.targetAmountUSD,
      targetDate: goal.targetDate,
      creatorAddress: goal.creatorAddress,
      onChainGoals: goal.onChainGoals,
      participants: goal.participants,
      vaultProgress: goal.vaultProgress,
      userBalance: goal.userBalance,
      userBalanceUSD: goal.userBalanceUSD,
      isPublic: goal.isPublic,
      cachedMembers: goal.cachedMembers,
    }));

    return [quickSaveGoal, ...mappedUserGoals];
  }, [userPortfolio, userGoals]);

  const combinedLoading = goalsLoading || portfolioLoading;
  const combinedError = goalsError || portfolioError;



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

  const closeCustomGoalModal = () => {
    setCustomGoalModalOpen(false);
    // Reset form
    setCustomGoalForm({
      name: "",
      amount: "",
      timeline: "12",
      category: "custom",
    });
  };

  // Show error if chain configuration is invalid
  if (!chainConfigValid) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-900"
        role="alert"
        aria-live="assertive"
      >
        <div className="text-center space-y-4 p-8 max-w-md mx-auto">
          <div
            className="text-red-400 text-xl font-semibold"
            role="heading"
            aria-level={1}
          >
            Chain Configuration Error
          </div>
          <div className="text-gray-300">
            The current network is not properly configured. Please check your
            network connection or switch to a supported blockchain network.
          </div>
          <div className="text-sm text-gray-400 bg-gray-800/50 rounded-lg p-3">
            <strong>Current Network:</strong> {getChainDisplayName()}
          </div>
          <div className="text-xs text-gray-500 mt-4">
            Supported networks: Celo, Scroll, Base
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/african-safari-scene-2005.jpg')",
      }}
      role="application"
      aria-label="Minilend Savings Application"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-cyan-600 text-white px-4 py-2 rounded z-50"
      >
        Skip to main content
      </a>

      {/* Background overlay for better text readability */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px] pointer-events-none"
        aria-hidden="true"
      ></div>

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcements.map((announcement, index) => (
          <div key={index}>{announcement}</div>
        ))}
      </div>

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

      {/* Desktop Sidebar Navigation - Hidden on mobile */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-72 lg:overflow-y-auto lg:bg-black/60 lg:backdrop-blur-md lg:border-r lg:border-white/10">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-6 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <Image
                src="/minilend-pwa.png"
                alt="Minilend"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <div className="text-xl font-bold text-cyan-400">Minilend</div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-6 py-8">
            <div className="space-y-2">
              {[
                {
                  id: "goals",
                  label: "Goals",
                  icon: "",
                  description: "Manage your savings goals",
                },
                {
                  id: "groups",
                  label: "Clan",
                  icon: "👥",
                  description: "Save with friends",
                },
                {
                  id: "leaderboard",
                  label: "Leaderboard",
                  icon: "",
                  description: "Community rankings",
                },
                {
                  id: "profile",
                  label: "Profile",
                  icon: "👤",
                  description: "Account & settings",
                },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    setActiveTab(
                      item.id as "goals" | "groups" | "leaderboard" | "profile"
                    )
                  }
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                    activeTab === item.id
                      ? "bg-cyan-400/20 text-cyan-400 border border-cyan-400/30"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs opacity-75">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="mt-8 pt-8 border-t border-white/10">
              <div className="space-y-3">
                <ActionButton
                  onClick={() => setSaveActionsModalOpen(true)}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  Quick Save
                </ActionButton>
                <ActionButton
                  onClick={() => setCustomGoalModalOpen(true)}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  ➕ New Goal
                </ActionButton>
              </div>
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content Container - Adjusted for sidebar on desktop */}
      <div className="lg:pl-72 relative z-10">
        {/* Header */}
        <header
          className="bg-black/60 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-40 relative"
          role="banner"
          aria-label="Application header"
        >
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            {/* Dynamic Header based on active tab */}
            <div className="flex items-center space-x-3">
              {/* Logo for mobile */}
              <div className="lg:hidden">
                <Image
                  src="/minilend-pwa.png"
                  alt="Minilend - Decentralized Savings Platform"
                  width={24}
                  height={24}
                  className="rounded"
                  priority
                />
              </div>
              <div>
                <h1
                  className="text-xl lg:text-2xl font-bold text-cyan-400"
                  id="page-title"
                >
                  {activeTab === "goals" && "Goals"}
                  {activeTab === "groups" && "Clan"}
                  {activeTab === "leaderboard" && "Leaderboard"}
                  {activeTab === "profile" && "Profile"}
                </h1>
                <p
                  className="text-sm lg:text-base text-gray-400"
                  aria-describedby="page-title"
                >
                  {activeTab === "goals" && "Home"}
                  {activeTab === "groups" && "Save with friends"}
                  {activeTab === "leaderboard" && "Community rankings"}
                  {activeTab === "profile" && "Account & Settings"}
                </p>
                {/* Keyboard shortcuts hint for screen readers */}
                <div className="sr-only">
                  Keyboard shortcuts: Ctrl+G for Goals, Ctrl+L for Leaderboard,
                  Ctrl+P for Profile
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 lg:space-x-4">
              {/* Show different buttons based on active tab */}
              {activeTab === "goals" && (
                <>
                  {/* New Goal Button */}
                  <ActionButton
                    onClick={() => setCustomGoalModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex"
                  >
                    New goal
                  </ActionButton>

                  {/* Mobile New Goal Button */}
                  <ActionButton
                    onClick={() => setCustomGoalModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="sm:hidden"
                  >
                    +
                  </ActionButton>

                  {/* Refresh Button */}
                  <button
                    onClick={forceRefresh}
                    className="p-2 text-gray-400 hover:text-white border border-gray-600 rounded-full transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title="Refresh goals"
                  >
                    <ArrowDownLeft className="w-5 h-5" />
                  </button>

                  {/* Notifications */}
                  <button className="p-2 text-gray-400 hover:text-white border border-gray-600 rounded-full transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </button>
                </>
              )}

              {activeTab === "groups" && (
                <>
                  <ActionButton
                    onClick={() => setCreateGroupGoalModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex"
                  >
                    New Group
                  </ActionButton>
                  <ActionButton
                    onClick={() => setCreateGroupGoalModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="sm:hidden"
                  >
                    +
                  </ActionButton>
                  <button className="p-2 text-gray-400 hover:text-white border border-gray-600 rounded-full transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <Bell className="w-5 h-5" />
                  </button>
                </>
              )}

              {activeTab === "leaderboard" && (
                <button className="p-2 text-gray-400 hover:text-white border border-gray-600 rounded-full transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main
          id="main-content"
          className="max-w-7xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8"
          role="main"
          aria-labelledby="page-title"
        >
          {!isOnline && (
            <div
              className="bg-red-900/60 border border-red-500/30 text-red-200 rounded-lg p-3 mb-4 text-sm flex items-center backdrop-blur-sm"
              role="alert"
              aria-live="assertive"
            >
              <WifiOff className="w-4 h-4 mr-2" aria-hidden="true" />
              <p>You are currently offline. Some features may be limited.</p>
            </div>
          )}

          {/* Conditional Content based on active tab */}
          {activeTab === "goals" && (
            <div className="py-4">
              {/* Error State - only show when there's an error and not loading */}
              {combinedError && !combinedLoading && (
                <div className="text-center py-8">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                    <p className="text-red-400 mb-2">Failed to load data</p>
                    <p className="text-gray-400 text-sm">
                      {goalsError || portfolioError || "Unknown error occurred"}
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <ActionButton
                      onClick={fetchUserGoals}
                      variant="outline"
                      size="sm"
                    >
                      Retry Goals
                    </ActionButton>
                    <ActionButton
                      onClick={fetchUserPortfolio}
                      variant="outline"
                      size="sm"
                    >
                      Retry Positions
                    </ActionButton>
                  </div>
                </div>
              )}

              {/* Goals Content - Always show, with loading states */}
              {!combinedError && (
                <>
                  {/* Quick Save Section - Always visible */}
                  <div className="mb-4">
                    {combinedLoading ||
                    !combinedGoals.find((g) => g.category === "quick") ? (
                      // Skeleton for Quick Save card
                      <QuickSaveCardSkeleton />
                    ) : (
                      <ExpandableQuickSaveCard
                        goal={
                          combinedGoals.find((g) => g.category === "quick")!
                        }
                        goals={combinedGoals}
                        userPositions={userPortfolio}
                        account={account}
                        user={account}
                        isLoading={combinedLoading}
                        showBalance={showBalances}
                        onToggleBalance={toggleBalanceVisibility}
                        onDeposit={() => setQuickSaveDetailsOpen(true)}
                        onWithdraw={() => setWithdrawalModalOpen(true)}
                        defaultToken={defaultToken}
                        chain={chain}
                        tokenInfo={tokenInfos}
                        exchangeRate={getKESRate() || undefined}
                        onGoalsRefetch={() => {
                          fetchUserPortfolio();
                          fetchUserGoals();
                        }}
                        sendTransaction={sendTransaction}
                      />
                    )}
                  </div>

                  {/* Loading indicator for goals data */}
                  {combinedLoading && (
                    <div className="flex items-center justify-center py-2 mb-3">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400 mx-auto mb-2"></div>
                        <p className="text-gray-400 text-sm">
                          Loading your goals...
                        </p>
                      </div>
                    </div>
                  )}

                  {/* User Goals Section */}
                  <section
                    className="mb-20 pb-4"
                    aria-labelledby="goals-heading"
                  >
                    <div className="flex items-center space-x-2 mb-4">
                      <TrendingUp
                        className="w-5 h-5 text-gray-400"
                        aria-hidden="true"
                      />
                      <h2
                        id="goals-heading"
                        className="text-lg font-semibold text-white"
                      >
                        My Goals
                      </h2>
                    </div>

                    <div
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6"
                      role="grid"
                      aria-label="Savings goals"
                    >
                      {goalsLoading ? (
                        // Show skeleton cards while loading
                        <>
                          <GoalCardSkeleton />
                          <GoalCardSkeleton />
                          <GoalCardSkeleton />
                        </>
                      ) : (
                        <>
                          {combinedGoals
                            .filter((g) => g.category !== "quick")
                            .map((goal, index) => (
                              <div
                                key={goal.metaGoalId || goal.id}
                                role="gridcell"
                                aria-label={`Goal ${index + 1}: ${goal.name || goal.title}`}
                              >
                                <GoalCard
                                  goal={goal}
                                  showBalance={showBalances}
                                  onCardClick={() => handleGoalCardClick(goal)}
                                  exchangeRate={getKESRate() || undefined}
                                />
                              </div>
                            ))}

                          {/* Show empty state if no user goals exist */}
                          {combinedGoals.filter((g) => g.category !== "quick")
                            .length === 0 && (
                            <div
                              className="col-span-full text-center py-8"
                              role="region"
                              aria-label="No goals available"
                            >
                              <p className="text-gray-400 mb-4">
                                No custom goals created yet
                              </p>
                              <ActionButton
                                onClick={handleCreateFirstGoal}
                                variant="primary"
                                size="lg"
                                className="w-full max-w-xs mx-auto"
                                aria-describedby="create-goal-description"
                              >
                                <Plus className="w-5 h-5 mr-2" />
                                Create Your First Goal
                              </ActionButton>
                              <div
                                id="create-goal-description"
                                className="sr-only"
                              >
                                Opens a form to create your first savings goal
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
          )}

          {activeTab === "groups" && (
            <ClanTab
              account={account}
              groupGoals={groupGoals}
              myGroups={myGroups}
              groupGoalsLoading={groupGoalsLoading}
              myGroupsLoading={myGroupsLoading}
              onCreateGroupGoal={() => setCreateGroupGoalModalOpen(true)}
              onJoinGroupGoal={handleJoinGroupGoal}
              onRefreshGroups={() => {
                fetchGroupGoals();
                fetchMyGroups();
              }}
              exchangeRate={getKESRate() || undefined}
            />
          )}

          {activeTab === "leaderboard" && (
            <section
              className="px-4 py-6 space-y-4"
              role="region"
              aria-labelledby="leaderboard-heading"
            >
              {/* User Score Card - Compact Version */}
              {userScore && (
                <div
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl p-3 text-white"
                  role="region"
                  aria-label="Your leaderboard ranking"
                >
                  <div className="flex items-center justify-between">
                    {/* Rank Section */}
                    <div className="flex items-center gap-2">
                      <div className="text-2xl" aria-hidden="true"></div>
                      <div>
                        <div className="text-xs opacity-75">Rank</div>
                        <div className="text-lg font-bold">
                          {userScore.rank != null &&
                          userScore.rank !== undefined
                            ? `#${userScore.rank}`
                            : "Not ranked"}
                        </div>
                      </div>
                    </div>

                    {/* Score Section */}
                    <div className="text-right">
                      <div className="text-xs opacity-75">Score</div>
                      <div className="text-lg font-bold">
                        ${userScore.formattedScore}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Leaderboard List */}
              <div
                className="bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-xl p-4"
                role="region"
                aria-labelledby="leaderboard-table-heading"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3
                    id="leaderboard-table-heading"
                    className="text-lg font-semibold text-white flex items-center gap-2"
                  >
                    <BarChart3 className="w-5 h-5" aria-hidden="true" />
                    Top Savers
                  </h3>
                  <button
                    onClick={fetchLeaderboard}
                    className="text-cyan-400 hover:text-cyan-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded"
                    disabled={leaderboardLoading}
                    aria-label={
                      leaderboardLoading
                        ? "Refreshing leaderboard"
                        : "Refresh leaderboard"
                    }
                  >
                    {leaderboardLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {leaderboardLoading ? (
                  <div className="space-y-3" aria-label="Loading leaderboard">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 animate-pulse"
                        aria-hidden="true"
                      >
                        <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-600 rounded w-24 mb-1"></div>
                          <div className="h-3 bg-gray-600 rounded w-32"></div>
                        </div>
                        <div className="h-4 bg-gray-600 rounded w-16"></div>
                      </div>
                    ))}
                  </div>
                ) : leaderboardError ? (
                  <div className="text-center py-8" role="alert">
                    <div className="text-red-400 mb-2">
                      Failed to load leaderboard
                    </div>
                    <button
                      onClick={fetchLeaderboard}
                      className="text-cyan-400 hover:text-cyan-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 rounded px-2 py-1"
                    >
                      Try again
                    </button>
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-8" role="status">
                    <BarChart3
                      className="w-12 h-12 text-gray-600 mx-auto mb-3"
                      aria-hidden="true"
                    />
                    <div className="text-gray-400">No rankings yet</div>
                  </div>
                ) : (
                  <div
                    className="space-y-2"
                    role="table"
                    aria-label="Leaderboard rankings"
                  >
                    <div role="rowgroup">
                      {leaderboard.map((entry, index) => (
                        <div
                          key={entry.address}
                          role="row"
                          className={`flex items-center gap-3 p-3 rounded-lg ${
                            entry.isCurrentUser
                              ? "bg-cyan-500/10 border border-cyan-500/20"
                              : "bg-gray-700/20"
                          }`}
                          aria-label={`Rank ${entry.rank}: ${
                            entry.isCurrentUser ? "You" : "User"
                          } with score ${entry.formattedScore} USD`}
                        >
                          {/* Rank */}
                          <div
                            role="cell"
                            className="flex items-center justify-center w-8 h-8"
                            aria-label={`Rank ${entry.rank}`}
                          >
                            {entry.rank <= 3 ? (
                              <div className="text-xl" aria-hidden="true">
                                {entry.rank === 1
                                  ? "🥇"
                                  : entry.rank === 2
                                  ? "🥈"
                                  : "🥉"}
                              </div>
                            ) : (
                              <div className="text-sm font-semibold text-gray-400">
                                #{entry.rank}
                              </div>
                            )}
                          </div>

                          {/* User Info */}
                          <div role="cell" className="flex-1">
                            <div className="text-white font-medium">
                              {entry.isCurrentUser
                                ? "You"
                                : `${entry.address.slice(
                                    0,
                                    6
                                  )}...${entry.address.slice(-4)}`}
                            </div>
                            {entry.isCurrentUser && (
                              <div className="text-xs text-cyan-400">
                                Your account
                              </div>
                            )}
                          </div>

                          {/* Score */}
                          <div role="cell" className="text-right">
                            <div className="text-white font-semibold">
                              ${entry.formattedScore || entry.score}
                            </div>
                            <div className="text-xs text-gray-400">USD</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Load More Button */}
              {leaderboard.length > 0 && (
                <div className="text-center">
                  <button
                    onClick={() => {
                      /* Load more functionality can be added here */
                    }}
                    className="text-cyan-400 hover:text-cyan-300 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded px-2 py-1"
                    disabled={leaderboardLoading}
                    aria-label="Load more leaderboard rankings"
                  >
                    View more rankings
                  </button>
                </div>
              )}
            </section>
          )}

          {activeTab === "profile" && (
            <NewProfile
              showBalance={showBalances}
              onToggleBalance={toggleBalanceVisibility}
            />
          )}
        </main>

        {/* Bottom Navigation Bar - Mobile Only */}
        <nav
          className="lg:hidden"
          role="navigation"
          aria-label="Main navigation"
        >
          <TabNavigation
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(
                tab as "goals" | "groups" | "leaderboard" | "profile"
              );
              // Announce tab change for screen readers
              setAnnouncements([`Switched to ${tab} tab`]);
            }}
            tabs={[
              {
                id: "goals",
                label: "Goals",
                icon: ({ className }) => (
                  <div
                    className={`w-5 h-5 flex items-center justify-center ${className}`}
                    aria-hidden="true"
                  >
                    <div className="w-3 h-3 border-2 border-current rounded-full flex items-center justify-center">
                      <div className="w-1 h-1 bg-current rounded-full"></div>
                    </div>
                  </div>
                ),
              },
              { id: "groups", label: "Clan", icon: Users },
              { id: "leaderboard", label: "Board", icon: BarChart3 },
              { id: "profile", label: "Profile", icon: User },
            ]}
            centerAction={{
              label: "SAVE",
              onClick: () => {
                setSaveActionsModalOpen(true);
                setAnnouncements(["Save options opened"]);
              },
            }}
          />
        </nav>

        {/* Modals */}
        <SaveActionsModal
          isOpen={saveActionsModalOpen}
          onClose={() => setSaveActionsModalOpen(false)}
          onActionSelect={handleSaveActionSelect}
        />

        {/* Quick Save Modals */}
        <QuickSaveDetailsModal
          isOpen={quickSaveDetailsOpen}
          onClose={closeAllQuickSaveModals}
          onSaveNow={handleQuickSaveSaveNow}
        />

        <AmountInputModal
          isOpen={quickSaveAmountOpen}
          onClose={closeAllQuickSaveModals}
          onContinue={handleQuickSaveAmountContinue}
          title="How much do you want to save?"
          initialAmount="100"
          currency="KES"
          icon="🐷"
        />

        <DepositConfirmationModal
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
          goalTitle="Quick Save Goal"
          goalIcon="🐷"
        />

        {/* Goal Modals (following same pattern as Quick Save) */}
        <GoalDetailsModal
          isOpen={goalDetailsOpen}
          onClose={closeAllGoalModals}
          onSaveNow={handleGoalSaveNow}
          goal={selectedGoal}
          showBalance={showBalances}
          exchangeRate={getKESRate() || undefined}
        />

        <AmountInputModal
          isOpen={goalAmountOpen}
          onClose={closeAllGoalModals}
          onContinue={handleGoalAmountContinue}
          title={`Save to ${selectedGoal?.title || "Goal"}`}
          initialAmount="100"
          currency="KES"
          icon={
            selectedGoal?.category === "personal"
              ? ""
              : selectedGoal?.category === "retirement"
              ? "🏦"
              : selectedGoal?.category === "emergency"
              ? "🚨"
              : selectedGoal?.category === "travel"
              ? "✈️"
              : selectedGoal?.category === "education"
              ? "🎓"
              : selectedGoal?.category === "business"
              ? "💼"
              : selectedGoal?.category === "health"
              ? "🏥"
              : selectedGoal?.category === "home"
              ? "🏠"
              : "💰"
          }
        />

        {/* Goal Confirmation Modal */}
        <DepositConfirmationModal
          isOpen={goalConfirmationOpen}
          onClose={closeAllGoalModals}
          amount={goalAmount}
          onDeposit={() => {
            handleQuickSaveDeposit();
          }}
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
          goalTitle={selectedGoal?.title || "Goal"}
          goalIcon={
            selectedGoal?.category === "personal"
              ? "🎯"
              : selectedGoal?.category === "travel"
              ? "✈️"
              : selectedGoal?.category === "education"
              ? "🎓"
              : selectedGoal?.category === "business"
              ? "💼"
              : selectedGoal?.category === "health"
              ? "🏥"
              : selectedGoal?.category === "home"
              ? "🏠"
              : "💰"
          }
        />

        {/* Custom Goal Modal */}
        <CustomGoalModal
          isOpen={customGoalModalOpen}
          onClose={closeCustomGoalModal}
          onCreateGoal={handleCreateCustomGoal}
          form={customGoalForm}
          setForm={setCustomGoalForm}
          isLoading={false}
          error={null}
          exchangeRate={getKESRate()}
        />

        {/* Create Group Goal Modal */}
        <BottomSheet
          isOpen={createGroupGoalModalOpen}
          onClose={() => setCreateGroupGoalModalOpen(false)}
          maxHeight="max-h-[95vh]"
        >
          <ModalHeader
            title="Create Group Goal"
            onClose={() => setCreateGroupGoalModalOpen(false)}
          />
          <div className="bg-gray-800/20 backdrop-blur-sm p-4 space-y-4">
            <div className="text-center py-2">
              <div className="text-2xl mb-2">👥</div>
              <h3 className="text-lg font-bold text-white mb-1">
                Create Group Savings Goal
              </h3>
              <p className="text-sm text-gray-400">
                Invite friends and family to save together
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Goal Name
                </label>
                <input
                  type="text"
                  value={groupGoalForm.name}
                  onChange={(e) => setGroupGoalForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Family Vacation, Wedding Fund"
                  className="w-full p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Target Amount (KES)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={groupGoalForm.amount}
                  onChange={(e) => setGroupGoalForm(prev => ({ ...prev, amount: e.target.value.replace(/[^0-9]/g, "") }))}
                  placeholder="0"
                  className="w-full p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-center text-xl font-bold"
                />
                {groupGoalForm.amount && getKESRate() && (
                  <div className="text-center mt-2 text-sm text-gray-400">
                    ≈ ${(parseFloat(groupGoalForm.amount) / getKESRate()).toFixed(2)} USD
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Timeline
                </label>
                <select
                  value={groupGoalForm.timeline}
                  onChange={(e) => setGroupGoalForm(prev => ({ ...prev, timeline: e.target.value }))}
                  className="w-full p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-800/20 backdrop-blur-sm border border-gray-700/30 rounded-lg">
                <div>
                  <div className="text-white font-medium">{groupGoalForm.isPublic ? 'Public Goal' : 'Private Goal'}</div>
                  <div className="text-xs text-gray-400">{groupGoalForm.isPublic ? 'Anyone can discover and join' : 'Invite only'}</div>
                </div>
                <div
                  className={`relative w-12 h-6 rounded-full cursor-pointer transition-all ${
                    groupGoalForm.isPublic ? 'bg-cyan-500' : 'bg-gray-600'
                  }`}
                  onClick={() => setGroupGoalForm(prev => ({ ...prev, isPublic: !prev.isPublic }))}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                      groupGoalForm.isPublic ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <ActionButton
                onClick={() => setCreateGroupGoalModalOpen(false)}
                variant="outline"
                size="lg"
                className="flex-1"
              >
                Cancel
              </ActionButton>
              <ActionButton
                onClick={handleCreateGroupGoal}
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={!groupGoalForm.name.trim() || !groupGoalForm.amount.trim() || !getKESRate()}
              >
                Create Goal
              </ActionButton>
            </div>
          </div>
        </BottomSheet>

        {/* Keep existing modals for functionality */}
        <SaveMoneyModal
          isOpen={activeModal === "save"}
          onClose={() => setActiveModal(null)}
          amount={quickSaveAmount || "100"}
          onDeposit={handleQuickSaveDeposit}
          isLoading={isDepositLoading}
          error={depositError}
          transactionStatus={transactionStatus}
          tokenSymbol={
            selectedDepositToken?.symbol || defaultToken?.symbol || "USDC"
          }
          depositSuccess={depositSuccess}
          account={account}
          tokens={tokens || []}
          tokenInfos={tokenInfos || {}}
          supportedStablecoins={supportedStablecoins}
          copied={copied}
          setCopied={setCopied}
          setSelectedTokenForOnramp={setSelectedTokenForOnramp}
          setShowOnrampModal={setShowOnrampModal}
          goal={selectedGoal}
        />

        {/* Onramp Modal for Mobile Money Deposits */}
        <OnrampDepositModal
          isOpen={showOnrampModal}
          onClose={() => setShowOnrampModal(false)}
          selectedAsset={tokenInfos[selectedTokenForOnramp]?.symbol || "USDC"}
          assetSymbol={tokenInfos[selectedTokenForOnramp]?.symbol || "USDC"}
          onSuccess={handleOnrampSuccess}
        />

        {/* Funds Withdrawal Modal */}
        <WithdrawModal
          isOpen={withdrawalModalOpen}
          onClose={() => setWithdrawalModalOpen(false)}
          onWithdraw={handleVaultWithdrawal}
          vaultPositions={vaultPositions}
          loading={vaultPositionsLoading}
        />

        {/* Join Goal Modal */}
        <JoinGoalModal
          isOpen={joinGoalModalOpen}
          onClose={() => {
            setJoinGoalModalOpen(false);
            setSelectedGoalToJoin(null);
            setJoinGoalError(null);
          }}
          goal={selectedGoalToJoin}
          onJoin={handleJoinGoalWithAmount}
          isLoading={joinGoalLoading}
          error={joinGoalError}
          exchangeRate={getKESRate() || undefined}
        />
      </div>
    </div>
  );
}
