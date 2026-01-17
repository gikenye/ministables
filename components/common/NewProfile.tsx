"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getUserEmail } from "thirdweb/wallets/in-app";
import { client } from "@/lib/thirdweb/client";
import { theme } from "@/lib/theme"; // Assuming your theme is exported here
import { motion, AnimatePresence } from "framer-motion";
import { generateUsernameFromAddress } from "@/lib/utils/profileUtils";

import { ProfileHero } from "./ProfileHero";
import { useGoals } from "@/hooks/useGoals";
import { useUser } from "@/hooks/useUser";
import {
  LogOut,
  Shield,
  ExternalLink,
  ChevronRight,
  Trophy,
  Activity,
  QrCode,
  ArrowUpRight,
  User as UserIcon,
} from "lucide-react";
import { ConnectWallet } from "../ConnectWallet";
import {
  SelfQRcodeWrapper,
  SelfAppBuilder,
  type SelfApp,
  countries,
  getUniversalLink,
} from "@selfxyz/qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

interface NewProfileProps {
  showBalance: boolean;
  onToggleBalance: () => void;
  className?: string;
}

export const NewProfile = ({
  showBalance,
  onToggleBalance,
  className = "",
}: NewProfileProps) => {
  const account = useActiveAccount();
  const address = account?.address;

  // --- LOGIC STATE ---
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [universalLink, setUniversalLink] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [encryptedUserId, setEncryptedUserId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [nationality, setNationality] = useState<string | undefined>(undefined);
  const [useridLoading, setUseridLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [qrSize, setQrSize] = useState(220);

  // --- DATA HOOKS ---
  const { user, loading: userLoading } = useUser();
  const { stats, loading: goalsLoading } = useGoals();
  const [xpData, setXpData] = useState<{
    totalXP: number;
    xpHistory: any[];
  } | null>(null);
  const [xpLoading, setXpLoading] = useState(false);

  const excludedCountries = useMemo(() => [countries.NORTH_KOREA], []);
  const username = address ? generateUsernameFromAddress(address) : "";

  // --- EFFECTS (Existing Logic Maintained) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "true") {
      const storedSelfId = sessionStorage.getItem("pendingSelfVerification");
      if (storedSelfId) {
        (async () => {
          try {
            displayToast("Processing verification...");
            const response = await fetch("/api/self/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ selfId: storedSelfId }),
            });
            if (response.ok) {
              sessionStorage.removeItem("pendingSelfVerification");
              displayToast("Verification successful!");
              const verifyResponse = await fetch(
                `/api/self/verify?selfId=${encodeURIComponent(storedSelfId)}`
              );
              if (verifyResponse.ok) {
                const data = await verifyResponse.json();
                setIsVerified(true);
                setNationality(data.nationality);
              }
            }
          } catch (error) {
            console.error(error);
          }
        })();
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!address || !isVerificationModalOpen || !encryptedUserId) return;
    const initSelfApp = async () => {
      try {
        const endpoint =
          process.env.NEXT_PUBLIC_SELF_ENDPOINT ||
          "0x4ea3a08de3d5cc74a5b2e20ba813af1ab3765956";
        const encoder = new TextEncoder();
        const data = encoder.encode(encryptedUserId);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(
          12,
          15
        )}-${((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16)}${hash.slice(
          17,
          20
        )}-${hash.slice(20, 32)}`;
        const callbackUrl = `${window.location.origin}${window.location.pathname}?verified=true`;
        const app = new SelfAppBuilder({
          version: 2,
          appName: process.env.NEXT_PUBLIC_SELF_APP_NAME || "Minilend",
          scope: process.env.NEXT_PUBLIC_SELF_SCOPE || "minilend-app",
          endpoint: endpoint,
          logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
          userId: uuid,
          endpointType: "celo",
          userIdType: "uuid",
          userDefinedData: "Enjoy saving together with Minilend!",
          deeplinkCallback: callbackUrl,
          disclosures: {
            minimumAge: 18,
            ofac: true,
            excludedCountries: excludedCountries,
            nationality: true,
          },
        }).build();
        setSelfApp(app);
        setUniversalLink(getUniversalLink(app));
      } catch (error) {
        console.error(error);
      }
    };
    initSelfApp();
  }, [excludedCountries, address, isVerificationModalOpen, encryptedUserId]);

  useEffect(() => {
    if (!address) return;
    const fetchUserId = async () => {
      setUseridLoading(true);
      try {
        const response = await fetch("/api/self/userid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: address }),
        });
        if (response.ok) {
          const data = await response.json();
          setEncryptedUserId(data.selfId);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setUseridLoading(false);
      }
    };
    fetchUserId();
  }, [address]);

  useEffect(() => {
    if (!address) return;
    const fetchXpData = async () => {
      setXpLoading(true);
      try {
        const response = await fetch(`/api/xp?userAddress=${address}`);
        if (response.ok) {
          const data = await response.json();
          setXpData(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setXpLoading(false);
      }
    };
    fetchXpData();
  }, [address]);

  useEffect(() => {
    if (!encryptedUserId) return;
    const checkVerification = async () => {
      setVerificationLoading(true);
      try {
        const response = await fetch(
          `/api/self/verify?selfId=${encodeURIComponent(encryptedUserId)}`
        );
        if (response.ok) {
          const data = await response.json();
          setIsVerified(true);
          setNationality(data.nationality);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setVerificationLoading(false);
      }
    };
    checkVerification();
  }, [encryptedUserId]);

  useEffect(() => {
    if (!isVerificationModalOpen) return;
    const updateQrSize = () => {
      const viewportWidth =
        typeof window === "undefined" ? 360 : window.innerWidth;
      const nextSize = Math.min(
        240,
        Math.max(180, Math.floor(viewportWidth * 0.6))
      );
      setQrSize(nextSize);
    };
    updateQrSize();
    window.addEventListener("resize", updateQrSize);
    return () => window.removeEventListener("resize", updateQrSize);
  }, [isVerificationModalOpen]);

  // --- ACTIONS ---
  const displayToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const copyToClipboard = () => {
    if (!universalLink) return;
    navigator.clipboard.writeText(universalLink).then(() => {
      setLinkCopied(true);
      displayToast("Link copied!");
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const openSelfApp = () => {
    if (!universalLink || !encryptedUserId) return;
    sessionStorage.setItem("pendingSelfVerification", encryptedUserId);
    window.open(universalLink, "_blank");
    displayToast("Opening Self App...");
  };

  const handleSuccessfulVerification = async () => {
    if (isVerifying || !address) return;
    setIsVerifying(true);
    try {
      const response = await fetch("/api/self/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfId: encryptedUserId }),
      });
      if (response.ok) {
        sessionStorage.removeItem("pendingSelfVerification");
        displayToast("Verified!");
        setIsVerificationModalOpen(false);
        setIsVerified(true);
      }
    } catch (error) {
      displayToast("Verification error");
    } finally {
      setIsVerifying(false);
    }
  };

  // --- CALCULATED VALUES ---
  const totalXP = xpData?.totalXP || 0;
  const goalsCompleted = xpData?.xpHistory
    ? new Set(xpData.xpHistory.map((item) => item.metaGoalId)).size
    : 0;

  if (!address) {
    return (
      <div
        className={`min-h-[100dvh] flex flex-col items-center justify-center px-5 ${className}`}
      >
        <div className="w-full max-w-sm rounded-[32px] border border-white/10 bg-black/40 backdrop-blur-xl p-8 text-center shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute -inset-4 bg-teal-500/20 blur-3xl rounded-full animate-pulse" />
              <div className="relative w-20 h-20 rounded-[28px] flex items-center justify-center shadow-2xl border border-white/10 bg-black/50">
                <UserIcon size={32} style={{ color: theme.colors.accent }} />
              </div>
            </div>
          </div>
          <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tight">
            Identity Required
          </h2>
          <p className="text-white/50 text-xs text-center max-w-[240px] mx-auto">
            Connect your wallet to access your protocol performance.
          </p>
          <div className="mt-6">
            <ConnectWallet className="w-full" />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div
      className={`min-h-[100dvh] flex flex-col ${className}`}
    >
      <div className="mx-auto max-w-md px-5 space-y-6">
        {/* HERO SECTION */}
        <ProfileHero
          walletAddress={address}
          username={username}
          countryCode={nationality}
          isVerified={isVerified}
        />
        {/* STATS ISLAND (Emerald Glass) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-[40px] p-7 border border-white/10 shadow-2xl"
          style={{
            background: `linear-gradient(145deg, ${theme.colors.accent}55 0%, ${theme.colors.accent}11 100%)`,
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-100/50">
                Experience Points
              </p>
              <div className="text-4xl font-black text-white tracking-tighter">
                {xpLoading ? "..." : totalXP.toFixed(0)}
              </div>
            </div>
            <div className="bg-white/10 p-3 rounded-2xl">
              <Trophy size={20} className="text-teal-300" />
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                Completed
              </p>
              <p className="text-xl font-black text-white mt-1">
                {goalsCompleted}
              </p>
            </div>
            <div className="bg-black/20 rounded-2xl p-4 border border-white/5 flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-teal-400" />
                <span className="text-[10px] font-black text-teal-400 uppercase tracking-tighter">
                  Active
                </span>
              </div>
            </div>
          </div>
        </motion.div>
        {/* VERIFICATION ACTION */}
        {(!isVerified || verificationLoading || useridLoading) && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() =>
              !verificationLoading && setIsVerificationModalOpen(true)
            }
            className="w-full flex items-center gap-5 p-5 rounded-[32px] border transition-all shadow-lg"
            style={{
              backgroundColor: theme.colors.backgroundDark,
              borderColor: `${theme.colors.accent}44`,
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${theme.colors.accent}15` }}
            >
              <QrCode
                size={24}
                style={{ color: theme.colors.accent }}
                className={verificationLoading ? "animate-pulse" : ""}
              />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-sm font-black text-white uppercase tracking-tight">
                {verificationLoading ? "Verifying..." : "Verify Humanhood"}
              </h3>
              <p className="text-[10px] text-white/30 uppercase font-bold">
                Self Protocol ID
              </p>
            </div>
            <ArrowUpRight size={18} className="text-white/20" />
          </motion.button>
        )}

        {/* SETTINGS GROUP */}
        <div
          className="rounded-[35px] border border-white/5 overflow-hidden shadow-xl"
          style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <div className="p-2 space-y-1">
            <a
              href="https://t.me/minilendxyz"
              target="_blank"
              className="flex items-center justify-between p-4 rounded-[24px] hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/10 text-blue-400">
                  <TelegramIcon className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-white/80">
                  Community
                </span>
              </div>
              <ChevronRight
                size={16}
                className="opacity-20 group-hover:opacity-100 text-white"
              />
            </a>

            <div className="h-[1px] bg-white/5 mx-6" />

            <div className="flex items-center justify-between p-4 rounded-[24px]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-white/40">
                  <LogOut size={18} />
                </div>
                <span className="text-sm font-bold text-white/80">Wallet</span>
              </div>
              <ConnectWallet />
            </div>
          </div>
        </div>

        <p className="text-center pt-8 text-[9px] font-black uppercase tracking-[0.5em] opacity-20 text-white">
          Minilend Protocol 1.0
        </p>
      </div>

      {/* VERIFICATION MODAL */}
      <Dialog
        open={isVerificationModalOpen}
        onOpenChange={setIsVerificationModalOpen}
      >
        <DialogContent
          className="
    border-none
    p-2 sm:p-3
    w-[90vw] max-w-sm
    rounded-[32px]
  "
          style={{ backgroundColor: theme.colors.backgroundSecondary }}
        >
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-black text-white uppercase tracking-tight">
              Link Self App
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-8">
            <div className="bg-white p-3 sm:p-2 rounded-[28px] sm:rounded-[32px] shadow-1xl">
              {selfApp ? (
                <SelfQRcodeWrapper
                  selfApp={selfApp}
                  type="deeplink"
                  size={qrSize}
                  onSuccess={handleSuccessfulVerification}
                  onError={() => displayToast("Verification Error")}
                />
              ) : (
                <div className="w-[180px] h-[180px] bg-zinc-100 animate-pulse rounded-2xl flex items-center justify-center text-zinc-400 text-[10px] font-bold uppercase">
                  Loading QR...
                </div>
              )}
            </div>
            <div className="flex gap-2 w-full">
              <button
                onClick={copyToClipboard}
                className="flex-1 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-white border border-white/10 active:scale-95 transition-all"
              >
                {linkCopied ? "Copied" : "Copy Link"}
              </button>
              <button
                onClick={openSelfApp}
                className="flex-1 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white active:scale-95 transition-all shadow-lg"
                style={{ backgroundColor: theme.colors.accent }}
              >
                Open App
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* TOAST SYSTEM */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-0 right-0 flex justify-center z-[100] px-6"
          >
            <div
              className="py-2 px-8 rounded-2xl shadow-2xl border text-[10px] font-black uppercase tracking-widest"
              style={{
                backgroundColor: theme.colors.backgroundDark,
                color: "white",
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              {toastMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
