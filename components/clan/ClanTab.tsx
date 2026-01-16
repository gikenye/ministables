"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronRight,
  MessageCircle,
  Plus,
  Users,
  ArrowUpRight,
  Lock,
  Globe,
  Share2,
  X,
  ArrowDownLeft,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GroupSavingsGoal } from "@/lib/services/backendApiService";
import { Account, MyGroups } from "@/lib/types/shared";
import { BottomSheet, ModalHeader } from "@/components/ui";
import SaveMoneyModal from "@/components/SaveMoneyModal";
import { AmountInputModal } from "@/components/common";
import SaveActionsModal from "@/components/common/SaveActionsModal";

interface ClanTabProps {
  account?: Account;
  myGroups?: MyGroups;
  groupGoalsLoading: boolean;
  myGroupsLoading: boolean;
  onCreateGroupGoal: () => void;
  onOpenWithdrawActions?: () => void;
  onJoinGroupGoalWithAmount: (goal: GroupSavingsGoal, amount: string) => void;
  exchangeRate?: number;
  isJoinGoalLoading: boolean;
  joinGoalError: string | null;
  tokens: any[];
  tokenInfos: Record<string, any>;
  supportedStablecoins: string[];
  defaultToken?: any;
  copied: boolean;
  setCopied: (value: boolean) => void;
  setDepositMethod: (method: "ONCHAIN" | "MPESA") => void;
  setSelectedTokenForOnramp: (token: string) => void;
  setShowOnrampModal: (show: boolean) => void;
}

const formatCurrency = (amount: number, rate?: number) => {
  if (rate) {
    return `KES ${(amount * rate).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
  }
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
};

const Badge = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "active" | "default" | "soon" }) => (
  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
    variant === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
    variant === "soon" ? " bg-[#4ade80] text-[8px] text-black tracking-tighter shadow-lg" : "bg-white/10 text-white/60  bg-[#4ade80] text-[8px] text-black tracking-tighter shadow-lg"
  }`}>
    {children}
  </span>
);

export const ClanTab: React.FC<ClanTabProps> = ({
  account,
  myGroups,
  groupGoalsLoading,
  myGroupsLoading,
  onCreateGroupGoal,
  onOpenWithdrawActions,
  onJoinGroupGoalWithAmount,
  exchangeRate,
  isJoinGoalLoading,
  joinGoalError,
  tokens,
  tokenInfos,
  supportedStablecoins,
  defaultToken,
  copied,
  setCopied,
  setDepositMethod,
  setSelectedTokenForOnramp,
  setShowOnrampModal,
}) => {
  const [selectedGoal, setSelectedGoal] = useState<GroupSavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState("100");
  const [isSaveActionsOpen, setIsSaveActionsOpen] = useState(false);
  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "members">("overview");
  const isLoading = groupGoalsLoading || myGroupsLoading;

  const allGoals = useMemo(() => [
    ...(myGroups?.public?.goals || []),
    ...(myGroups?.private?.goals || [])
  ], [myGroups]);

  const handleDepositClick = () => {
    setIsSaveActionsOpen(true);
  };

  const handleInvite = async (goal: GroupSavingsGoal) => {
    const link = goal.inviteLink || `${window.location.origin}/goals/${goal.metaGoalId}?inviter=${goal.creatorAddress}`;
    const message = `Join my clan "${goal.name}" on NewDay: ${link}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    const popup = window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    if (!popup) {
      window.location.href = whatsappUrl;
    }
  };

  if (!account?.address) return (
    <div className="p-6 text-center bg-black/20 rounded-[40px] border border-white/5 my-8">
      <Lock className="mx-auto mb-4 text-white/10" size={20} />
      <h3 className="text-m font-black text-white">Wallet Locked</h3>
      <p className="text-white/30 mt-2 font-bold text-sm">Connect wallet to view clans.</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-10">
      {/* Header */}
      <div className="flex justify-between items-end px-2">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">Clans</h1>
          <p className=" bg-emerald-500/10 text-emerald-400 font-bold mt-2 uppercase text-[10px] tracking-[0.025em]">Save with friends and family</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onCreateGroupGoal}
          className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-black shadow-1xl"
        >
          <Plus size={28} strokeWidth={3} />
        </motion.button>
      </div>

      {/* Goal Cards */}
      <div className="grid gap-4">
        {isLoading ? (
          Array.from({ length: 2 }, (_, index) => (
            <div
              key={`clan-skeleton-${index}`}
              className="rounded-[32px] border border-emerald-500/10 bg-[#1e2923]/60 p-4 animate-pulse"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-2">
                  <div className="h-6 w-20 rounded-full bg-white/10" />
                  <div className="h-6 w-6 rounded-full bg-white/10" />
                </div>
                <div className="h-8 w-8 rounded-full bg-white/10" />
              </div>
              <div className="h-6 w-36 rounded bg-white/10 mb-2" />
              <div className="h-4 w-24 rounded bg-white/10 mb-8" />
              <div className="flex justify-between items-end">
                <div>
                  <div className="h-3 w-16 rounded bg-white/10 mb-2" />
                  <div className="h-6 w-24 rounded bg-white/10" />
                </div>
                <div className="text-right">
                  <div className="h-3 w-10 rounded bg-white/10 mb-2 ml-auto" />
                  <div className="w-20 h-1.5 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
          ))
        ) : allGoals.length > 0 ? (
          allGoals.map((goal) => (
            <motion.div
              key={goal.metaGoalId}
              onClick={() => { setSelectedGoal(goal); setActiveTab("overview"); }}
              className="group relative overflow-hidden rounded-[32px] border border-emerald-500/10 bg-[#1e2923]/80 p-6 cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-2">
                  <Badge variant="active">{goal.participantCount || 0} Members</Badge>
                  <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center">
                    {goal.isPublic ? <Globe size={12} className="text-white/40" /> : <Lock size={12} className="text-white/40" />}
                  </div>
                </div>
                <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-colors">
                  <ChevronRight size={18} strokeWidth={3} />
                </div>
              </div>
              <h3 className="text-2xl font-black text-white mb-1 tracking-tight">{goal.name}</h3>
              <p className="text-white/20 text-sm mb-8 font-bold line-clamp-1">{goal.description || "Active Savings Clan"}</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Total Vault</p>
                  <p className="text-2xl font-black text-white tracking-tight">{formatCurrency(goal.totalProgressUSD || 0, exchangeRate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-emerald-400 mb-2">
                    {Math.min(((goal.totalProgressUSD || 0) / (goal.targetAmountUSD || 1)) * 100, 100).toFixed(0)}%
                  </p>
                  <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400" style={{ width: `${Math.min(((goal.totalProgressUSD || 0) / (goal.targetAmountUSD || 1)) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="p-8 text-center bg-[#1e2923]/60 rounded-[32px] border border-emerald-500/10">
            <p className="text-xs font-black text-white/60 uppercase tracking-[0.2em]">No clans yet</p>
            <p className="text-white/30 mt-2 font-bold text-sm">Create or join a clan to get started.</p>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <BottomSheet
        isOpen={
          !!selectedGoal &&
          !isDepositModalOpen &&
          !isAmountModalOpen &&
          !isSaveActionsOpen
        }
        onClose={() => setSelectedGoal(null)}
      >
        {selectedGoal && (
          <div className="p-6 pt-0 pb-20">
            <ModalHeader title={selectedGoal.name} onClose={() => setSelectedGoal(null)} />
            
            <div className="grid grid-cols-2 gap-3 mt-4 mb-8">
              <button 
                onClick={handleDepositClick}
                className="flex flex-col items-center justify-center gap-2 py-6 rounded-[28px] bg-white text-black font-black active:scale-95 transition-all shadow-xl"
              >
                <ArrowUpRight size={24} strokeWidth={3} />
                <span className="text-sm">Deposit</span>
              </button>
              <div className="relative flex flex-col items-center justify-center gap-2 py-6 rounded-[28px] bg-black/40 text-white/10 font-black border border-white/5">
                <MessageCircle size={24} />
                <span className="text-sm">Chat</span>
                <div className="absolute top-4 right-4 "><Badge variant="soon">Soon</Badge></div>
              </div>
            </div>

            {/* Tabs & Content */}
            <div className="flex gap-1 p-1.5 bg-black/40 rounded-[20px] mb-2 border border-white/5">
              {["overview", "members"].map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t as any)}
                  className={`flex-1 py-3 rounded-[14px] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                    activeTab === t ? "bg-white text-black shadow-md" : "text-white/40"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="max-h-[250px]">
              {activeTab === "overview" ? (
                <div className="space-y-2">
                  <div className="bg-black/40 p-6 rounded-[32px] border border-white/5">
                    <p className="text-white/30 font-black uppercase text-[10px] tracking-widest mb-2">Total Progress</p>
                    <span className="text-2xl font-black text-white">{formatCurrency(selectedGoal.totalProgressUSD || 0, exchangeRate)}</span>
                    <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mt-4">
                      <div className="h-full bg-emerald-400" style={{ width: `${Math.min(((selectedGoal.totalProgressUSD || 0) / (selectedGoal.targetAmountUSD || 1)) * 100, 100)}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleInvite(selectedGoal)} className="flex items-center justify-center gap-2 py-4 bg-white/5 rounded-[20px] border border-white/5 text-white/60 font-black text-[10px] uppercase tracking-widest active:bg-white active:text-black transition-all">
                      <Share2 size={16} /> Invite
                    </button>
                    <button
                      onClick={() => {
                        if (!onOpenWithdrawActions) {
                          toast.info("Contact clan admin to withdraw");
                          return;
                        }
                        onOpenWithdrawActions();
                        setSelectedGoal(null);
                      }}
                      className="flex items-center justify-center gap-2 py-4 bg-white/5 rounded-[20px] border border-white/5 text-white/60 font-black text-[10px] uppercase tracking-widest active:bg-white active:text-black transition-all"
                    >
                      <ArrowDownLeft size={16} /> Withdraw
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {(selectedGoal.participants || []).map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-black/20 rounded-[20px] border border-white/5">
                      <span className="text-xs font-black text-white/80 font-mono">{p.substring(0, 8)}...{p.substring(p.length-4)}</span>
                      <Badge variant="active">Member</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      <SaveActionsModal
        isOpen={isSaveActionsOpen}
        onClose={() => setIsSaveActionsOpen(false)}
        onActionSelect={(actionId) => {
          setIsSaveActionsOpen(false);
          if (actionId === "onramp") {
            setDepositMethod("MPESA");
            setShowOnrampModal(true);
            return;
          }
          if (actionId === "onchain") {
            setDepositMethod("ONCHAIN");
            setIsAmountModalOpen(true);
          }
        }}
      />

      {selectedGoal && (
        <AmountInputModal
          isOpen={isAmountModalOpen}
          onClose={() => setIsAmountModalOpen(false)}
          onContinue={(amount: string) => {
            setDepositAmount(amount);
            setIsAmountModalOpen(false);
            setIsDepositModalOpen(true);
          }}
          title="How much do you want to add?"
          initialAmount={depositAmount}
          currency="KES"
        />
      )}

      {selectedGoal && (
        <SaveMoneyModal
          isOpen={isDepositModalOpen}
          onClose={() => setIsDepositModalOpen(false)}
          amount={depositAmount}
          goal={{ title: selectedGoal.name, ...selectedGoal }}
          account={account}
          isLoading={isJoinGoalLoading}
          error={joinGoalError}
          tokenSymbol={defaultToken?.symbol || "USDC"}
          tokens={tokens}
          tokenInfos={tokenInfos}
          supportedStablecoins={supportedStablecoins}
          copied={copied}
          setCopied={setCopied}
          setSelectedTokenForOnramp={setSelectedTokenForOnramp}
          setShowOnrampModal={setShowOnrampModal}
          onDeposit={() => {
            onJoinGroupGoalWithAmount(selectedGoal, depositAmount);
          }}
        />
      )}
    </div>
  );
};

export default ClanTab;
