"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { useMiniApp } from "@/hooks/useMiniApp";
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
  type SaveOption,
  type FrontendGoal,
  type GoalCategory,
} from "@/components/common";

// Import custom hooks for API integration
import { useGoals } from "@/hooks/useGoals";
import { useUser } from "@/hooks/useUser";
import { useCreateGoal } from "@/hooks/useCreateGoal";
import { useInitializeUserGoals } from "@/hooks/useInitializeUserGoals";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useGroupSavingsAmount } from "@/hooks/useGroupGoals";

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
import { vaultService } from "@/lib/services/vaultService";
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

      <div className="bg-black/90 backdrop-blur-sm p-3 space-y-3">
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
      <div className="bg-black/90 backdrop-blur-sm p-2 space-y-2 overflow-y-auto">
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
        <div className="space-y-1.5">
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
        </div>

        {/* Timeline (Compact) */}
        <InfoCard>
          <div className="flex items-center justify-between text-xs">
            <div>
              <div className="text-white font-medium">Started</div>
              <div className="text-xs text-gray-400">2 years ago</div>
            </div>
            <div className="text-cyan-400">25th Dec 2023</div>
          </div>
        </InfoCard>

        {/* Bottom spacing for safe area */}
        <div className="h-2"></div>
      </div>
    </BottomSheet>
  );
};

// Custom Goal Modal - Create user-defined goals
const CustomGoalModal = ({
  isOpen,
  onClose,
  onCreateGoal,
  form,
  setForm,
  isLoading = false,
  error = null,
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
}) => {
  const handleInputChange = (field: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const formatAmount = (value: string) => {
    // Remove non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, "");
    // Format with commas
    const parts = numericValue.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  const handleAmountChange = (value: string) => {
    const formatted = formatAmount(value);
    handleInputChange("amount", formatted);
  };

  const isFormValid = () => {
    return (
      form.name.trim() !== "" &&
      form.amount.trim() !== "" &&
      parseFloat(form.amount.replace(/,/g, "")) > 0
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxHeight="max-h-[95vh]">
      <ModalHeader
        title="Create Custom Goal"
        onClose={onClose}
        rightAction={{
          label: "Create",
          onClick: onCreateGoal,
          variant: "primary",
        }}
      />

      <div className="bg-black/90 backdrop-blur-sm p-3 space-y-3">
        {/* Header */}
        <div className="text-center py-0.5">
          <div className="text-2xl mb-1.5">🎯</div>
          <h3 className="text-base font-semibold text-white mb-0.5">
            Set Your Goal
          </h3>
          <p className="text-xs text-gray-400">
            Create a personalized savings goal with your own target and timeline
          </p>
        </div>

        {/* Goal Name */}
        <div className="space-y-0.5">
          <label className="text-white font-medium text-xs">Goal Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="e.g., New Car, Vacation, Emergency Fund"
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-sm"
            maxLength={50}
          />
          <div className="text-xs text-gray-500 text-right">
            {form.name.length}/50
          </div>
        </div>

        {/* Target Amount */}
        <div className="space-y-0.5">
          <label className="text-white font-medium text-xs">
            Target Amount (KES)
          </label>
          <input
            type="text"
            value={form.amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0"
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 text-right text-base font-semibold"
          />
          <div className="text-xs text-gray-500">
            Enter your target savings amount
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-0.5">
          <label className="text-white font-medium text-xs">Timeline</label>
          <select
            value={form.timeline}
            onChange={(e) => handleInputChange("timeline", e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-400 text-sm"
          >
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12">1 year</option>
            <option value="18">1.5 years</option>
            <option value="24">2 years</option>
            <option value="36">3 years</option>
            <option value="60">5 years</option>
          </select>
          <div className="text-xs text-gray-500">
            How long do you want to save for this goal?
          </div>
        </div>

        {/* Goal Category */}
        <div className="space-y-0.5">
          <label className="text-white font-medium text-xs">Category</label>
          <select
            value={form.category}
            onChange={(e) => handleInputChange("category", e.target.value)}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-400 text-sm"
          >
            <option value="personal">Personal</option>
            <option value="emergency">Emergency Fund</option>
            <option value="travel">Travel</option>
            <option value="education">Education</option>
            <option value="business">Business</option>
            <option value="health">Health</option>
            <option value="home">Home & Family</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Goal Summary */}
        {isFormValid() && (
          <InfoCard variant="stats">
            <div className="space-y-0.5">
              <h4 className="text-white font-semibold text-xs">Goal Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-gray-400 text-xs">Monthly Target</div>
                  <div className="text-cyan-400 font-semibold">
                    KES{" "}
                    {Math.ceil(
                      parseFloat(form.amount.replace(/,/g, "")) /
                        parseInt(form.timeline)
                    ).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Weekly Target</div>
                  <div className="text-cyan-400 font-semibold">
                    KES{" "}
                    {Math.ceil(
                      parseFloat(form.amount.replace(/,/g, "")) /
                        (parseInt(form.timeline) * 4.33)
                    ).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </InfoCard>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Create Button */}
        <ActionButton
          onClick={onCreateGoal}
          variant="primary"
          size="md"
          className="w-full"
          disabled={!isFormValid() || isLoading}
        >
          {isLoading ? "Creating Goal..." : "Create Goal"}
        </ActionButton>
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

        <div className="bg-black/90 backdrop-blur-sm p-3 space-y-4">
          <div className="text-center py-3">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">✓</span>
            </div>
            <h3 className="text-white text-base font-medium mb-1.5">
              Deposit Successful!
            </h3>
            <p className="text-gray-400 text-xs mb-3">
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

      <div className="bg-black/90 backdrop-blur-sm p-4 space-y-6">
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
            <div className="text-center py-3">
              <div className="text-xs text-white mb-1.5">
                Is the following correct?
              </div>
              <div className="text-xs text-cyan-400 mb-3">
                You wish to deposit to Quick Save
              </div>

              <div className="text-2xl font-bold text-cyan-400 mb-1.5">
                KES {amount}
              </div>

              <div className="text-gray-400 mb-1.5 text-xs">to your</div>
              <div className="text-base font-bold text-cyan-400">
                Quick Save Goal
              </div>
            </div>

            {/* Remember Info Card */}
            <InfoCard>
              <div className="text-center">
                <div className="text-2xl mb-2">🐷</div>
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

// Profile Screen Component - Mobile-First with Separated Cards
const ProfileScreen = ({
  showBalance,
  onToggleBalance,
  user,
  goalStats,
  groupSavings,
}: {
  showBalance: boolean;
  onToggleBalance: () => void;
  user: any; // User from API
  goalStats: any; // Goal stats from API
  groupSavings: string; // Group savings amount
}) => {
  const account = useActiveAccount();
  const address = account?.address;

  const getUserName = () => {
    if (user?.username) {
      return user.username;
    }
    if (address) {
      // Fallback to shortened address
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return "Guest User";
  };

  const getMemberSince = () => {
    if (user?.createdAt) {
      const date = new Date(user.createdAt);
      return `Member since ${date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })}`;
    }
    return "New Member";
  };

  // Calculate savings data for display
  const allTimeSavings = goalStats?.totalSaved || "0";
  const currentSavings = goalStats?.totalSaved || "0";

  return (
    <div className="min-h-screen bg-black/20 pb-20">
      {/* Profile Header Card */}
      <ProfileHeaderCard
        username={getUserName()}
        memberSince={getMemberSince()}
      />

      {/* Savings Statistics Card */}
      <SavingsStatsCard
        allTimeSavings={allTimeSavings}
        currentSavings={currentSavings}
        groupSavings={groupSavings}
        showBalance={showBalance}
        onToggleBalance={onToggleBalance}
      />

      {/* Invite Friends Card */}
      <InviteFriendsCard />

      {/* Account Settings Card */}
      <AccountSettingsCard />

      {/* Support Card */}
      <SupportCard />

      {/* Bottom spacing for footer */}
      <div className="h-2"></div>
    </div>
  );
};

// Expandable Quick Save Card Component
interface ExpandableQuickSaveCardProps {
  goal: any; // Quick Save goal object
  goals: any[]; // All user goals for total calculation
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
}

const ExpandableQuickSaveCard = ({
  goal,
  goals,
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
  exchangeRate = 131.5,
  onGoalsRefetch,
}: ExpandableQuickSaveCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currencyMode, setCurrencyMode] = useState<"LOCAL" | "USD">("USD");
  const [isDragging, setIsDragging] = useState(false);
  const [dragTimeout, setDragTimeout] = useState<NodeJS.Timeout | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Calculate total savings across all goals
  const totalSavingsNum = goals.reduce((total, goalItem) => {
    return total + parseFloat(goalItem?.currentAmount || "0");
  }, 0);

  // Parse Quick Save goal amounts (for the expanded view)
  const quickSaveAmountNum = parseFloat(goal?.currentAmount || "0");
  const tokenSymbol = defaultToken?.symbol || "USDC";
  const tokenDecimals = defaultToken?.decimals || 6;

  // For main card display - use total savings
  const totalLocalAmount = totalSavingsNum * exchangeRate;

  // For expanded Quick Save display - use Quick Save amount
  const quickSaveLocalAmount = quickSaveAmountNum * exchangeRate;

  // Determine primary and secondary amounts based on currency mode for TOTAL SAVINGS
  const primaryAmount =
    currencyMode === "LOCAL"
      ? `Ksh${totalLocalAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : `$${totalSavingsNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const secondaryAmount =
    currencyMode === "LOCAL"
      ? `≈ $${totalSavingsNum.toFixed(2)} ${tokenSymbol}`
      : `≈ Ksh${totalLocalAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const handleCurrencyToggle = () => {
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
    if (!user?.id || !goal?.id) {
      console.error("Missing user ID or Quick Save goal ID");
      return;
    }

    const quickSaveAmount = parseFloat(goal?.currentAmount || "0");
    if (quickSaveAmount <= 0) {
      console.error("No funds available in Quick Save to transfer");
      return;
    }

    try {
      // For now, transfer all available Quick Save funds
      // In a full implementation, you might want to show a modal to let user choose amount
      const transferAmount = quickSaveAmount.toString();

      const response = await fetch("/api/goals/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          fromGoalId: goal.id,
          toGoalId: targetGoalId,
          amount: transferAmount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Transfer failed");
      }

      const result = await response.json();
      console.log("Transfer successful:", result);

      // Refresh goals data to reflect the transfer
      if (onGoalsRefetch) {
        onGoalsRefetch();
      }

      // Optionally show success feedback
      // You could add a toast notification here
    } catch (error) {
      console.error("Failed to transfer funds:", error);
      // You could show an error toast here
    }
  };

  const handleDropTarget = (goalId: string, isOver: boolean) => {
    if (isDragging) {
      setDropTargetId(isOver ? goalId : null);
    }
  };

  // Get token logo URL - check multiple sources
  const getTokenLogoUrl = () => {
    // First check if defaultToken has direct logo URLs
    if (defaultToken?.logoUrl) return defaultToken.logoUrl;
    if (defaultToken?.image) return defaultToken.image;
    if (defaultToken?.icon) return defaultToken.icon;

    // Check tokenInfo from chainConfig
    if (tokenInfo?.icon) return tokenInfo.icon;

    // If chain and defaultToken are available, get from chainConfig
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

    // Fallback to a generic token icon
    return "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png";
  };

  return (
    <div className="relative">
      <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-3 text-white shadow-lg">
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
                          <span className="text-white text-xs">🎯</span>
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

  // API hooks for data fetching
  const {
    goals,
    stats: goalStats,
    loading: goalsLoading,
    error: goalsError,
    refetch: refetchGoals,
  } = useGoals();
  const {
    user,
    loading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useUser();
  const {
    createGoal,
    loading: createGoalLoading,
    error: createGoalError,
  } = useCreateGoal();

  // Initialize user goals (create Quick Save goal for new users)
  useInitializeUserGoals(defaultToken, chain);

  // Exchange rates hook
  const { rates, getKESRate, loading: ratesLoading } = useExchangeRates();

  // Group savings hook
  const { amount: groupSavingsAmount, loading: groupSavingsLoading } =
    useGroupSavingsAmount();

  // State for the new design
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [saveActionsModalOpen, setSaveActionsModalOpen] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "goals" | "groups" | "leaderboard" | "profile"
  >("goals");

  // Save options data
  const saveOptions: SaveOption[] = [
    {
      id: "52-week",
      title: "52 Week Challenge",
      icon: Calendar,
      description: "Save incrementally over 52 weeks",
    },
    {
      id: "superfans",
      title: "Superfans Challenge",
      icon: Trophy,
      description: "Join the superfans saving challenge",
    },
    {
      id: "vault",
      title: "Akiba Vault",
      icon: Shield,
      description: "Secure long-term savings vault",
    },
    {
      id: "mia-kwa-mia",
      title: "Mia Kwa Mia Challenge",
      icon: Banknote,
      description: "Monthly progressive savings challenge",
    },
    {
      id: "envelope",
      title: "Envelope Challenge",
      icon: Mail,
      description: "Digital envelope saving method",
    },
    {
      id: "personal",
      title: "Personal Goal",
      icon: User,
      description: "Set your own custom savings target",
    },
  ];

  // Footer is always visible

  // Quick Save modal states
  const [quickSaveDetailsOpen, setQuickSaveDetailsOpen] = useState(false);
  const [quickSaveAmountOpen, setQuickSaveAmountOpen] = useState(false);
  const [quickSaveConfirmationOpen, setQuickSaveConfirmationOpen] =
    useState(false);
  const [quickSaveAmount, setQuickSaveAmount] = useState("100");
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [vaultPositions, setVaultPositions] = useState<any[]>([]);
  const [vaultPositionsLoading, setVaultPositionsLoading] = useState(false);

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

  // Custom Goal modal states
  const [customGoalModalOpen, setCustomGoalModalOpen] = useState(false);
  const [customGoalForm, setCustomGoalForm] = useState({
    name: "",
    amount: "",
    timeline: "12", // months
    category: "custom",
  });

  // Goals data is now fetched from API via useGoals hook above

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

  const handleSaveActionSelect = (actionId: string) => {
    setSaveActionsModalOpen(false);
    // Handle the different save actions from main SAVE button
    switch (actionId) {
      case "quick":
        // Handle quick save
        setQuickSaveDetailsOpen(true);
        break;
      default:
        console.log("Unknown save action selected:", actionId);
        break;
    }
  };

  const handleCreateCustomGoal = async () => {
    // Validate form
    if (!customGoalForm.name.trim() || !customGoalForm.amount.trim()) {
      console.error("Goal name and amount are required");
      return;
    }

    const targetAmount = parseFloat(customGoalForm.amount.replace(/,/g, ""));
    if (targetAmount <= 0) {
      console.error("Target amount must be greater than 0");
      return;
    }

    // Ensure we have default token info for the goal
    if (!defaultToken || !chain) {
      console.error("Chain or token information not available");
      return;
    }

    // Create goal using API
    const newGoalData = {
      title: customGoalForm.name,
      description: `Custom goal for ${customGoalForm.name}`,
      category: customGoalForm.category as GoalCategory,
      status: "active" as const,
      currentAmount: "0",
      targetAmount: targetAmount.toString(),
      tokenAddress: defaultToken.address,
      tokenSymbol: defaultToken.symbol,
      tokenDecimals: defaultToken.decimals,
      interestRate: 5.0, // Default 5% interest
      isPublic: false,
      allowContributions: false,
      isQuickSave: false,
      // Add timeline as targetDate if provided
      targetDate: customGoalForm.timeline
        ? new Date(
            Date.now() +
              parseInt(customGoalForm.timeline) * 30 * 24 * 60 * 60 * 1000
          )
        : undefined,
    };

    try {
      const createdGoal = await createGoal(newGoalData);

      if (createdGoal) {
        console.log("Goal created successfully:", createdGoal);

        // Refresh goals list
        await refetchGoals();

        // Reset form
        setCustomGoalForm({
          name: "",
          amount: "",
          timeline: "12",
          category: "custom",
        });

        // Close modal
        setCustomGoalModalOpen(false);
      }
    } catch (error) {
      console.error("Failed to create goal:", error);
      // You might want to show an error message to the user here
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

    // Refresh goals to show updated balances
    try {
      await refetchGoals();
    } catch (error) {
      console.error("Failed to refresh goals after deposit:", error);
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
    if (!account) {
      setPendingDeposit(true);
      setDepositError("Connecting wallet automatically...");
      return;
    }

    if (!defaultToken) {
      setDepositError("No supported tokens found for deposit");
      return;
    }

    // Check if balance is still loading
    if (isBalanceLoading) {
      setDepositError("Loading wallet balance, please wait...");
      return;
    }

    // Validate balance - only proceed if walletBalanceData is available
    if (!walletBalanceData) {
      setDepositError("Unable to verify wallet balance. Please try again.");
      return;
    }

    const walletBalance = parseFloat(walletBalanceData.displayValue || "0");
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

  // Handle vault withdrawals from FundsWithdrawalModal
  const handleVaultWithdrawal = async (
    tokenSymbol: string,
    depositIds: number[]
  ) => {
    if (!account?.address || !user?.address || !chain?.id) {
      throw new Error("Missing required data for withdrawal");
    }

    // Define the vault withdraw method ABI inline
    const withdrawMethodABI = {
      inputs: [{ internalType: "uint256", name: "depositId", type: "uint256" }],
      name: "withdraw",
      outputs: [
        { internalType: "uint256", name: "amountWithdrawn", type: "uint256" },
      ],
      stateMutability: "nonpayable",
      type: "function",
    } as const;

    // Get vault address for the token
    const vaultAddress = getVaultAddress(chain.id, tokenSymbol);
    if (!vaultAddress) {
      throw new Error(
        `No vault address found for ${tokenSymbol} on chain ${chain.id}`
      );
    }

    try {
      // Process each deposit withdrawal
      for (const depositId of depositIds) {
        // Create vault contract instance
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
            userId: user.address,
            chainId: chain.id,
            depositId,
            transactionHash: result.transactionHash,
            withdrawnAmount: "0", // Should be extracted from transaction receipt
            yieldEarned: "0", // Should be extracted from transaction receipt
          }),
        });
      }

      // Refresh goals after successful withdrawal
      await refetchGoals();
    } catch (error) {
      console.error("Vault withdrawal failed:", error);
      throw error;
    }
  };

  // Fetch vault positions for the withdrawal modal
  const fetchVaultPositions = async () => {
    if (!account?.address || !chain || !tokens) {
      return;
    }

    setVaultPositionsLoading(true);
    try {
      // Get all token symbols for the current chain
      const tokenSymbols = tokens.map((token) => token.symbol);

      // Fetch vault positions from the vault service
      const positions = await vaultService.getAllVaultPositions(
        chain,
        account.address,
        tokenSymbols
      );

      setVaultPositions(positions);
    } catch (error) {
      console.error("Failed to fetch vault positions:", error);
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

  // Calculate dynamic savings data based on goals
  const calculateSavingsStats = () => {
    if (goalStats) {
      return {
        allTimeSavings: goalStats.totalSaved || "0",
        currentSavings: goalStats.totalSaved || "0", // Same as total for now
        groupSavings: groupSavingsAmount, // Use group savings from hook
      };
    }

    // Fallback values
    return {
      allTimeSavings: "0",
      currentSavings: "0",
      groupSavings: groupSavingsAmount, // Use group savings from hook
    };
  };

  // Get the calculated savings stats
  const { allTimeSavings, currentSavings, groupSavings } =
    calculateSavingsStats();

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
    <div
      className="min-h-screen relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/african-safari-scene-2005.jpg')",
      }}
    >
      {/* Background overlay for better text readability */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"></div>

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
                  icon: "🎯",
                  description: "Manage your savings goals",
                },
                {
                  id: "groups",
                  label: "Groups",
                  icon: "👥",
                  description: "Save with friends",
                },
                {
                  id: "leaderboard",
                  label: "Leaderboard",
                  icon: "🏆",
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
                  🎯 Quick Save
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
        <header className="bg-black/60 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-40 relative">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            {/* Dynamic Header based on active tab */}
            <div className="flex items-center space-x-3">
              {/* Logo for mobile */}
              <div className="lg:hidden">
                <Image
                  src="/minilend-pwa.png"
                  alt="Minilend"
                  width={24}
                  height={24}
                  className="rounded"
                />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-cyan-400">
                  {activeTab === "goals" && "Goals"}
                  {activeTab === "groups" && "Groups"}
                  {activeTab === "leaderboard" && "LeaderBoard"}
                  {activeTab === "profile" && "Profile"}
                </h1>
                <p className="text-sm lg:text-base text-gray-400">
                  {activeTab === "goals" && "Home"}
                  {activeTab === "groups" && "Save with friends"}
                  {activeTab === "leaderboard" && "Community rankings"}
                  {activeTab === "profile" && "Account & Settings"}
                </p>
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
        <main className="max-w-7xl mx-auto relative z-10 px-4 sm:px-6 lg:px-8">
          {!isOnline && (
            <div className="bg-red-900/60 border border-red-500/30 text-red-200 rounded-lg p-3 mb-4 text-sm flex items-center backdrop-blur-sm">
              <WifiOff className="w-4 h-4 mr-2" />
              <p>You are currently offline. Some features may be limited.</p>
            </div>
          )}

          {/* Conditional Content based on active tab */}
          {activeTab === "goals" && (
            <div className="py-6">
              {/* Loading State */}
              {goalsLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading your goals...</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {goalsError && !goalsLoading && (
                <div className="text-center py-12">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
                    <p className="text-red-400 mb-2">Failed to load goals</p>
                    <p className="text-gray-400 text-sm">{goalsError}</p>
                  </div>
                  <ActionButton
                    onClick={refetchGoals}
                    variant="outline"
                    size="sm"
                  >
                    Try Again
                  </ActionButton>
                </div>
              )}

              {/* Goals Content */}
              {!goalsLoading && !goalsError && (
                <>
                  {/* Quick Save Section */}
                  {goals.find((g) => g.category === "quick") && (
                    <div className="mb-8">
                      <ExpandableQuickSaveCard
                        goal={goals.find((g) => g.category === "quick")!}
                        goals={goals}
                        account={account}
                        user={user}
                        isLoading={goalsLoading}
                        showBalance={showBalances}
                        onToggleBalance={toggleBalanceVisibility}
                        onDeposit={() => setQuickSaveDetailsOpen(true)}
                        onWithdraw={() => setWithdrawalModalOpen(true)}
                        defaultToken={defaultToken}
                        chain={chain}
                        tokenInfo={tokenInfos}
                        exchangeRate={getKESRate() || 131.5}
                        onGoalsRefetch={refetchGoals}
                      />
                    </div>
                  )}

                  {/* User Goals Section */}
                  <div className="mb-32 pb-4">
                    <div className="flex items-center space-x-2 mb-6">
                      <TrendingUp className="w-5 h-5 text-gray-400" />
                      <h2 className="text-lg font-semibold text-white">
                        My Goals
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                      {goals
                        .filter((g) => g.category !== "quick")
                        .map((goal) => (
                          <GoalCard
                            key={goal.id}
                            goal={goal}
                            showBalance={showBalances}
                          />
                        ))}

                      {/* Show empty state if no user goals exist */}
                      {goals.filter((g) => g.category !== "quick").length ===
                        0 && (
                        <div className="col-span-full text-center py-8">
                          <p className="text-gray-400 mb-4">
                            No goals created yet
                          </p>
                          <ActionButton
                            onClick={() => setCustomGoalModalOpen(true)}
                            variant="primary"
                            size="sm"
                          >
                            Create Your First Goal
                          </ActionButton>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
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
              user={user}
              goalStats={goalStats}
              groupSavings={groupSavingsAmount}
            />
          )}
        </main>

        {/* Bottom Navigation Bar - Mobile Only */}
        <div className="lg:hidden">
          <TabNavigation
            activeTab={activeTab}
            onTabChange={(tab) =>
              setActiveTab(
                tab as "goals" | "groups" | "leaderboard" | "profile"
              )
            }
            tabs={[
              {
                id: "goals",
                label: "Goals",
                icon: ({ className }) => (
                  <div
                    className={`w-5 h-5 flex items-center justify-center ${className}`}
                  >
                    <div className="w-3 h-3 border-2 border-current rounded-full flex items-center justify-center">
                      <div className="w-1 h-1 bg-current rounded-full"></div>
                    </div>
                  </div>
                ),
              },
              { id: "groups", label: "Groups", icon: Users },
              { id: "leaderboard", label: "Board", icon: BarChart3 },
              { id: "profile", label: "Profile", icon: User },
            ]}
            centerAction={{
              label: "SAVE",
              onClick: () => setSaveActionsModalOpen(true),
            }}
          />
        </div>

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

        {/* Custom Goal Modal */}
        <CustomGoalModal
          isOpen={customGoalModalOpen}
          onClose={closeCustomGoalModal}
          onCreateGoal={handleCreateCustomGoal}
          form={customGoalForm}
          setForm={setCustomGoalForm}
          isLoading={createGoalLoading}
          error={createGoalError}
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

        {/* Funds Withdrawal Modal */}
        <FundsWithdrawalModal
          isOpen={withdrawalModalOpen}
          onClose={() => setWithdrawalModalOpen(false)}
          onWithdraw={handleVaultWithdrawal}
          vaultPositions={vaultPositions}
          tokenInfos={tokenInfos}
          loading={vaultPositionsLoading}
        />
      </div>
    </div>
  );
}
