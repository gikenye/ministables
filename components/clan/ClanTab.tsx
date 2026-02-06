"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  MessageCircle,
  Plus,
  ArrowUpRight,
  Lock,
  Globe,
  Share2,
  ArrowDownLeft,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useActiveAccount } from "thirdweb/react";
import { backendApiClient } from "@/lib/services/backendApiService";
import type { GroupGoalMembersResponse, GroupSavingsGoal } from "@/lib/services/backendApiService";
import { Account, MyGroups } from "@/lib/types/shared";
import { useChain } from "@/components/ChainProvider";
import { BottomSheet, ModalHeader } from "@/components/ui";
import { AmountInputModal } from "@/components/common";
import SaveActionsModal from "@/components/common/SaveActionsModal";
import { DepositConfirmationModal } from "@/components/common/DepositConfirmationModal";
import { getStablecoinBalances, type TokenBalance } from "@/lib/services/balanceService";

interface ClanTabProps {
  account?: Account;
  myGroups?: MyGroups;
  groupGoalsLoading: boolean;
  myGroupsLoading: boolean;
  onCreateGroupGoal: () => void;
  onOpenWithdrawActions?: () => void;
  onJoinGroupGoalWithAmount: (
    goal: GroupSavingsGoal,
    amount: string,
    options?: {
      depositMethod?: "ONCHAIN" | "MPESA";
      token?: TokenBalance;
      context?: "join" | "deposit";
    }
  ) => void;
  exchangeRate?: number;
  isDepositLoading: boolean;
  depositError: string | null;
  depositSuccess: { amount: string } | null;
  transactionStatus: string | null;
  onResetDepositState: () => void;
  setDepositMethod: (method: "ONCHAIN" | "MPESA") => void;
  setShowOnrampModal: (show: boolean) => void;
  setOnrampTargetGoalId: (goalId: string | null) => void;
  showOnrampModal: boolean;
}

const formatCurrency = (amount: number, rate?: number) => {
  if (rate) {
    return `KES ${(amount * rate).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
  }
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
};

const toNumber = (value: number | string | undefined | null) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizePercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(value, 0);
};

const getGoalProgress = (goal: GroupSavingsGoal) => {
  const targetAmount = toNumber(goal.targetAmountToken);
  const totalProgress = toNumber(goal.totalProgressUSD);
  const currentAmount = toNumber(goal.currentAmountUSD);
  const progressPercent = toNumber(goal.progressPercent);
  const cachedProgressPercent = toNumber(goal.cachedMembers?.progressPercent);
  const cachedTotalContributed = toNumber(goal.cachedMembers?.totalContributedUSD);
  const totalContributed = toNumber(goal.totalContributedUSD ?? goal.totalContributedUsd);

  let progressUsd = totalProgress;
  if (progressUsd <= 0 && currentAmount > 0) progressUsd = currentAmount;
  if (progressUsd <= 0 && cachedTotalContributed > 0) progressUsd = cachedTotalContributed;
  if (progressUsd <= 0 && totalContributed > 0) progressUsd = totalContributed;
  if (progressUsd <= 0 && progressPercent > 0 && targetAmount > 0) progressUsd = (targetAmount * progressPercent) / 100;
  if (progressUsd <= 0 && cachedProgressPercent > 0 && targetAmount > 0) progressUsd = (targetAmount * cachedProgressPercent) / 100;

  let percent = progressPercent > 0 ? progressPercent : cachedProgressPercent;
  if (percent <= 0 && targetAmount > 0 && progressUsd > 0) percent = (progressUsd / targetAmount) * 100;

  return { progressUsd, progressPercent: normalizePercent(percent) };
};

const isWalletAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

const Badge = ({ children, variant = "default" }: { children: React.ReactNode; variant?: "active" | "default" | "soon" }) => (
  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
    variant === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
    "bg-[#4ade80] text-[8px] text-black tracking-tighter shadow-lg"
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
  isDepositLoading,
  depositError,
  depositSuccess,
  onResetDepositState,
  setDepositMethod,
  setShowOnrampModal,
  setOnrampTargetGoalId,
  showOnrampModal,
  transactionStatus,
}) => {
  const activeAccount = useActiveAccount();
  const { chain } = useChain();
  const [selectedGoal, setSelectedGoal] = useState<GroupSavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState("100");
  const [isSaveActionsOpen, setIsSaveActionsOpen] = useState(false);
  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteAddress, setInviteAddress] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [isCopyingInviteLink, setIsCopyingInviteLink] = useState(false);
  const [isRotatingInviteLink, setIsRotatingInviteLink] = useState(false);
  const [clanDepositMethod, setClanDepositMethod] = useState<"ONCHAIN" | "MPESA">("ONCHAIN");
  const [stablecoinBalances, setStablecoinBalances] = useState<TokenBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [selectedDepositToken, setSelectedDepositToken] = useState<TokenBalance | null>(null);
  const inviteInFlightRef = useRef(false);
  const [goalMembers, setGoalMembers] = useState<GroupGoalMembersResponse | null>(null);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "members">("overview");
  const isOnchainDeposit = clanDepositMethod === "ONCHAIN";
  const walletAddress = activeAccount?.address || account?.address;

  // Determine if any modal/overlay is currently active
  const isAnyModalOpen = useMemo(() => {
    return (
      !!selectedGoal ||
      isSaveActionsOpen ||
      isAmountModalOpen ||
      isDepositModalOpen ||
      isInviteModalOpen ||
      showOnrampModal
    );
  }, [selectedGoal, isSaveActionsOpen, isAmountModalOpen, isDepositModalOpen, isInviteModalOpen, showOnrampModal]);

  const isLoading = groupGoalsLoading || myGroupsLoading;
  
  const selectedGoalProgress = useMemo(
    () => (selectedGoal ? getGoalProgress(selectedGoal) : null),
    [selectedGoal]
  );

  useEffect(() => {
    if (!selectedGoal?.metaGoalId) {
      setGoalMembers(null);
      return;
    }
    let isActive = true;
    setIsMembersLoading(true);
    backendApiClient.getGroupGoalMembers(selectedGoal.metaGoalId)
      .then((data) => { if (isActive) setGoalMembers(data); })
      .catch(() => { if (isActive) setGoalMembers(null); })
      .finally(() => { if (isActive) setIsMembersLoading(false); });
    return () => { isActive = false; };
  }, [selectedGoal?.metaGoalId]);

  const memberRows = useMemo(() => {
    if (!selectedGoal) return [];
    const entries = new Map<string, { address: string; isOwner: boolean }>();
    const addAddress = (address?: string, isOwner = false) => {
      if (!address) return;
      const normalized = address.toLowerCase();
      const existing = entries.get(normalized);
      entries.set(normalized, { address, isOwner: existing?.isOwner || isOwner });
    };
    addAddress(selectedGoal.creatorAddress, true);
    const memberAddresses = goalMembers?.members?.map((member) => member.address) ?? selectedGoal.participants ?? [];
    memberAddresses.forEach((address) => addAddress(address, false));
    (selectedGoal.invitedUsers || []).forEach((address) => addAddress(address, false));
    return Array.from(entries.values());
  }, [goalMembers, selectedGoal]);

  const allGoals = useMemo(() => [
    ...(myGroups?.public?.goals || []),
    ...(myGroups?.private?.goals || [])
  ], [myGroups]);

  const handleDepositClick = () => setIsSaveActionsOpen(true);
  const handleInvite = () => {
    setInviteAddress("");
    setIsInviteModalOpen(true);
  };

  const resetDepositFlow = useCallback(() => {
    onResetDepositState();
  }, [onResetDepositState]);

  useEffect(() => {
    if (!isDepositModalOpen && !isDepositLoading) {
      if (depositSuccess) {
        toast.success("Deposit complete.");
      } else if (depositError) {
        toast.error(depositError);
      }
      resetDepositFlow();
    }
  }, [
    isDepositModalOpen,
    isDepositLoading,
    depositSuccess,
    depositError,
    resetDepositFlow,
  ]);

  useEffect(() => {
    resetDepositFlow();
  }, [selectedGoal?.metaGoalId, resetDepositFlow]);

  const pickDefaultToken = useCallback((balances: TokenBalance[]) => {
    const priorityOrder = ["USDC", "USDT", "CUSD"];
    const sorted = [...balances].sort((a, b) => {
      if (a.balance !== b.balance) {
        return b.balance - a.balance;
      }
      const aPriority = priorityOrder.indexOf(a.symbol.toUpperCase());
      const bPriority = priorityOrder.indexOf(b.symbol.toUpperCase());
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      return 0;
    });
    return sorted[0] || null;
  }, []);

  useEffect(() => {
    if (!isOnchainDeposit) {
      setStablecoinBalances([]);
      setBalancesLoading(false);
      setSelectedDepositToken(null);
    }
  }, [isOnchainDeposit]);

  useEffect(() => {
    if (!isOnchainDeposit || !isAmountModalOpen || !walletAddress || !chain?.id) {
      return;
    }
    let isActive = true;
    setBalancesLoading(true);
    getStablecoinBalances(walletAddress, chain.id)
      .then((balances) => {
        if (!isActive) return;
        setStablecoinBalances(balances);
      })
      .catch(() => {
        if (!isActive) return;
        setStablecoinBalances([]);
      })
      .finally(() => {
        if (!isActive) return;
        setBalancesLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [isOnchainDeposit, isAmountModalOpen, walletAddress, chain?.id]);

  useEffect(() => {
    if (!stablecoinBalances.length) {
      setSelectedDepositToken(null);
      return;
    }
    setSelectedDepositToken((prev) => {
      if (prev && stablecoinBalances.some((token) => token.address === prev.address)) {
        return prev;
      }
      return pickDefaultToken(stablecoinBalances);
    });
  }, [stablecoinBalances, pickDefaultToken]);

  const handleSendInvite = async () => {
    if (inviteInFlightRef.current || !selectedGoal || !activeAccount?.address) return;
    inviteInFlightRef.current = true;
    setIsInviting(true);
    try {
      const trimmedInvite = inviteAddress.trim();
      if (!isWalletAddress(trimmedInvite)) {
        toast.error("Enter a valid wallet address.");
        return;
      }
      const challenge = await backendApiClient.getGroupGoalInviteChallenge(
        selectedGoal.metaGoalId,
        trimmedInvite.toLowerCase(),
        activeAccount.address.toLowerCase()
      );
      
      const message = `Invite to goal\nmetaGoalId: ${selectedGoal.metaGoalId}\ninvitedAddress: ${trimmedInvite.toLowerCase()}\ninviterAddress: ${activeAccount.address.toLowerCase()}\nnonce: ${challenge.nonce}\nissuedAt: ${challenge.issuedAt}`;
      const signature = await activeAccount.signMessage({ message });
      
      await backendApiClient.sendGroupGoalInvite({
        metaGoalId: selectedGoal.metaGoalId,
        inviterAddress: activeAccount.address.toLowerCase(),
        invitedAddress: trimmedInvite.toLowerCase(),
        nonce: challenge.nonce,
        issuedAt: challenge.issuedAt,
        signature,
      });

      toast.success("Invite sent.");
      setIsInviteModalOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Invite failed");
    } finally {
      setIsInviting(false);
      inviteInFlightRef.current = false;
    }
  };

  const handleCopyInviteLink = async () => {
    if (inviteInFlightRef.current || !selectedGoal || !activeAccount?.address) return;
    inviteInFlightRef.current = true;
    setIsCopyingInviteLink(true);
    try {
      const response = await backendApiClient.createGroupGoalInviteLink(
        selectedGoal.metaGoalId,
        activeAccount.address.toLowerCase()
      );
      const shareLink =
        response.shareLink ||
        (typeof window !== "undefined"
          ? `${window.location.origin}/goals/${selectedGoal.metaGoalId}?invite=${response.inviteToken}`
          : "");
      if (!shareLink) {
        throw new Error("Failed to generate invite link.");
      }
      await navigator.clipboard.writeText(shareLink);
      toast.success(
        selectedGoal.isPublic === false
          ? "Private invite link copied."
          : "Invite link copied."
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to copy invite link");
    } finally {
      setIsCopyingInviteLink(false);
      inviteInFlightRef.current = false;
    }
  };

  const handleRotateInviteLink = async () => {
    if (inviteInFlightRef.current || !selectedGoal || !activeAccount?.address) return;
    inviteInFlightRef.current = true;
    setIsRotatingInviteLink(true);
    try {
      const response = await backendApiClient.rotateGroupGoalInviteLink(
        selectedGoal.metaGoalId,
        activeAccount.address.toLowerCase()
      );
      const shareLink =
        response.shareLink ||
        (typeof window !== "undefined"
          ? `${window.location.origin}/goals/${selectedGoal.metaGoalId}?invite=${response.inviteToken}`
          : "");
      if (!shareLink) {
        throw new Error("Failed to rotate invite link.");
      }
      await navigator.clipboard.writeText(shareLink);
      toast.success("New invite link copied.");
    } catch (e: any) {
      toast.error(e.message || "Failed to rotate invite link");
    } finally {
      setIsRotatingInviteLink(false);
      inviteInFlightRef.current = false;
    }
  };

  if (!account?.address) return (
    <div className="p-6 text-center bg-black/20 rounded-[40px] border border-white/5 my-8">
      <Lock className="mx-auto mb-4 text-white/10" size={20} />
      <h3 className="text-m font-black text-white">Wallet Locked</h3>
      <p className="text-white/30 mt-2 font-bold text-base">Connect wallet to view clans.</p>
    </div>
  );

  const portalTarget = typeof document === "undefined" ? null : document.body;
  
  const clanModals = (
    <>
      <BottomSheet
        isOpen={
          !!selectedGoal &&
          !isDepositModalOpen &&
          !isAmountModalOpen &&
          !isSaveActionsOpen &&
          !isInviteModalOpen &&
          !showOnrampModal
        }
        onClose={() => setSelectedGoal(null)}
      >
        {selectedGoal && (
          <div className="p-6 pt-0 pb-12">
            <ModalHeader title={selectedGoal.name} onClose={() => setSelectedGoal(null)} />
            <div className="grid grid-cols-2 gap-3 mt-4 mb-8">
              <button onClick={handleDepositClick} className="flex flex-col items-center justify-center gap-2 py-6 rounded-[28px] bg-white text-black font-black active:scale-95 transition-all shadow-xl">
                <ArrowUpRight size={24} strokeWidth={3} />
                <span className="text-base">Deposit</span>
              </button>
              <div className="relative flex flex-col items-center justify-center gap-2 py-6 rounded-[28px] bg-black/40 text-white/10 font-black border border-white/5">
                <MessageCircle size={24} />
                <span className="text-base">Chat</span>
                <div className="absolute top-4 right-4"><Badge variant="soon">Soon</Badge></div>
              </div>
            </div>

            <div className="flex gap-1 p-1.5 bg-black/40 rounded-[20px] mb-4 border border-white/5">
              {["overview", "members"].map((t) => (
                <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-3 rounded-[14px] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === t ? "bg-white text-black shadow-md" : "text-white/40"}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="min-h-[200px]">
              {activeTab === "overview" ? (
                <div className="space-y-3">
                  <div className="bg-black/40 p-6 rounded-[32px] border border-white/5">
                    <p className="text-white/30 font-black uppercase text-[10px] tracking-widest mb-2">Total Progress</p>
                    <span className="text-2xl font-black text-white">{formatCurrency(selectedGoalProgress?.progressUsd || 0, exchangeRate)}</span>
                    <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mt-4">
                      <div className="h-full bg-emerald-400" style={{ width: `${Math.min(selectedGoalProgress?.progressPercent || 0, 100)}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleInvite} className="flex items-center justify-center gap-2 py-4 bg-white/5 rounded-[20px] border border-white/5 text-white/60 font-black text-[10px] uppercase tracking-widest active:bg-white active:text-black transition-all">
                      <Share2 size={16} /> Invite
                    </button>
                    <button onClick={handleCopyInviteLink} disabled={isCopyingInviteLink} className="flex items-center justify-center gap-2 py-4 bg-white/5 rounded-[20px] border border-white/5 text-white/60 font-black text-[10px] uppercase tracking-widest active:bg-white active:text-black transition-all disabled:opacity-40">
                      <Globe size={16} /> {isCopyingInviteLink ? "Copying..." : "Share link"}
                    </button>
                  </div>
                  <button onClick={() => { onOpenWithdrawActions?.(); setSelectedGoal(null); }} className="w-full flex items-center justify-center gap-2 py-4 bg-white/5 rounded-[20px] border border-white/5 text-white/60 font-black text-[10px] uppercase tracking-widest active:bg-white active:text-black transition-all">
                    <ArrowDownLeft size={16} /> Withdraw
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {isMembersLoading ? <div className="p-4 text-xs font-bold text-white/40">Loading members...</div> :
                    memberRows.map((member, i) => (
                      <div key={i} className="flex justify-between items-center p-4 bg-black/20 rounded-[20px] border border-white/5">
                        <span className="text-xs font-black text-white/80 font-mono">{member.address.substring(0, 8)}...{member.address.substring(member.address.length-4)}</span>
                        <Badge variant={member.isOwner ? "soon" : "active"}>{member.isOwner ? "Owner" : "Member"}</Badge>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)}>
        {selectedGoal && (
          <div className="p-6 pt-0 pb-12 text-white space-y-5">
            <ModalHeader title="Invite member" onClose={() => setIsInviteModalOpen(false)} />
            {selectedGoal.isPublic === false && (
              <div className="rounded-[24px] border border-emerald-400/30 bg-emerald-500/10 p-4 space-y-3">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200">Private goal link</div>
                <p className="text-sm text-emerald-100/80">
                  Share this link with trusted members. Anyone with the link can join.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCopyInviteLink}
                    disabled={isCopyingInviteLink}
                    className="rounded-[16px] bg-white py-3 text-sm font-black text-black disabled:opacity-40"
                  >
                    {isCopyingInviteLink ? "Copying..." : "Copy link"}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRotateInviteLink}
                    disabled={isRotatingInviteLink}
                    className="rounded-[16px] border border-white/30 bg-transparent py-3 text-sm font-black text-white/90 disabled:opacity-40"
                  >
                    {isRotatingInviteLink ? "Rotating..." : "Rotate link"}
                  </motion.button>
                </div>
              </div>
            )}
            <div className="rounded-[28px] border border-white/5 bg-black/40 p-4 space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Wallet address</label>
              <div className="rounded-[18px] border border-white/10 bg-black/60 px-4 py-3">
                <input type="text" placeholder="0x..." value={inviteAddress} onChange={(e) => setInviteAddress(e.target.value)} className="w-full bg-transparent text-base font-mono text-white focus:outline-none" />
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.98 }} onClick={handleSendInvite} disabled={isInviting || !inviteAddress.trim()} className="w-full rounded-[20px] bg-white py-4 text-base font-black text-black disabled:opacity-30">
              {isInviting ? "Sending..." : "Send invite"}
            </motion.button>
            {selectedGoal.isPublic !== false && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCopyInviteLink}
                disabled={isCopyingInviteLink}
                className="w-full rounded-[20px] border border-white/20 bg-transparent py-4 text-base font-black text-white/80 disabled:opacity-30"
              >
                {isCopyingInviteLink ? "Copying..." : "Copy invite link"}
              </motion.button>
            )}
          </div>
        )}
      </BottomSheet>

      <SaveActionsModal
        isOpen={isSaveActionsOpen}
        onClose={() => setIsSaveActionsOpen(false)}
        onActionSelect={(id) => {
          setIsSaveActionsOpen(false);
          if (id === "onramp") {
            const targetGoalId =
              selectedGoal?.onChainGoals?.USDC || selectedGoal?.goalIds?.USDC || null;
            setClanDepositMethod("MPESA");
            setDepositAmount("100");
            setDepositMethod("MPESA");
            setOnrampTargetGoalId(targetGoalId);
            setShowOnrampModal(true);
          } else {
            setClanDepositMethod("ONCHAIN");
            setDepositAmount("0");
            setDepositMethod("ONCHAIN");
            setOnrampTargetGoalId(null);
            setIsAmountModalOpen(true);
          }
        }}
      />

      {selectedGoal && (
        <>
          <AmountInputModal
            isOpen={isAmountModalOpen}
            onClose={() => setIsAmountModalOpen(false)}
            onContinue={(amt) => {
              setDepositAmount(amt);
              setIsAmountModalOpen(false);
              setIsDepositModalOpen(true);
            }}
            title="Add to clan"
            initialAmount={depositAmount}
            currency={isOnchainDeposit ? "USD" : "KES"}
            allowDecimal={isOnchainDeposit}
            tokenBalances={isOnchainDeposit ? stablecoinBalances : []}
            selectedToken={isOnchainDeposit ? selectedDepositToken : null}
            onTokenSelect={isOnchainDeposit ? setSelectedDepositToken : undefined}
            balancesLoading={isOnchainDeposit ? balancesLoading : false}
          />
          <DepositConfirmationModal
            isOpen={isDepositModalOpen}
            onClose={() => {
              setIsDepositModalOpen(false);
            }}
            amount={depositAmount}
            onDeposit={() => {
              resetDepositFlow();
              onJoinGroupGoalWithAmount(selectedGoal, depositAmount, {
                depositMethod: clanDepositMethod,
                token: selectedDepositToken || undefined,
                context: "deposit",
              });
            }}
            isLoading={isDepositLoading}
            error={depositError}
            transactionStatus={transactionStatus}
            depositSuccess={depositSuccess}
            goalTitle={selectedGoal.name}
            depositMethod={clanDepositMethod}
            currencyLabel={isOnchainDeposit ? "USD" : "KES"}
            minFractionDigits={isOnchainDeposit ? 2 : 0}
            maxFractionDigits={isOnchainDeposit ? 6 : 0}
          />
        </>
      )}
    </>
  );

  return (
    <>
      <div className={`max-w-2xl mx-auto py-8 px-4 space-y-10 transition-all duration-500 ease-in-out ${
        isAnyModalOpen ? "opacity-30 pointer-events-none scale-[0.96] blur-[2px]" : "opacity-100 scale-100 blur-0"
      }`}>
        <div className="flex justify-between items-end px-2">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">Clans</h1>
            <p className="bg-emerald-500/10 text-emerald-400 font-bold mt-2 uppercase text-[10px] px-2 py-0.5 rounded-md inline-block">Save with friends and family</p>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onCreateGroupGoal} className="h-12 w-12 rounded-full bg-white flex items-center justify-center text-black shadow-2xl">
            <Plus size={28} strokeWidth={3} />
          </motion.button>
        </div>

        <div className="grid gap-4">
          {isLoading ? (
            [1, 2].map((i) => <div key={i} className="h-48 rounded-[32px] bg-white/5 animate-pulse" />)
          ) : allGoals.length > 0 ? (
            allGoals.map((goal) => {
              const { progressUsd, progressPercent } = getGoalProgress(goal);
              return (
                <motion.div key={goal.metaGoalId} onClick={() => { setSelectedGoal(goal); setActiveTab("overview"); }} className="group relative overflow-hidden rounded-[32px] border border-emerald-500/10 bg-[#1e2923]/80 p-6 cursor-pointer active:scale-[0.98] transition-all">
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
                  <p className="text-white/20 text-base mb-8 font-bold line-clamp-1">{goal.description || "Active Savings Clan"}</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Total Vault</p>
                      <p className="text-2xl font-black text-white tracking-tight">{formatCurrency(progressUsd, exchangeRate)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-emerald-400 mb-2">{progressPercent.toFixed(0)}%</p>
                      <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="p-12 text-center bg-[#1e2923]/60 rounded-[32px] border border-emerald-500/10">
              <p className="text-white/30 font-bold text-base">Create a clan to get started.</p>
            </div>
          )}
        </div>
      </div>
      {portalTarget ? createPortal(clanModals, portalTarget) : clanModals}
    </>
  );
};

export default ClanTab;
