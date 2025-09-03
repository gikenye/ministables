"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  TrendingUp,
  ArrowDownLeft,
  Shield,
  ExternalLink,
  Wallet,
  DollarSign,
}
from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatAddress } from "@/lib/utils";
import { FundsWithdrawalModal } from "@/components/FundsWithdrawalModal";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";
import { getContract } from "thirdweb";
import { useActiveAccount, useReadContract, useConnect } from "thirdweb/react";
import { client } from "@/lib/thirdweb/client";
import { celo } from "thirdweb/chains";
import { useEnhancedDashboard } from "@/hooks/useEnhancedDashboard";

interface UserData {
  deposits: Record<string, string>;
  borrows: Record<string, string>;
  collateral: Record<string, string>;
  lockEnds: Record<string, number>;
}

// Supported stablecoins from deployment config
const SUPPORTED_STABLECOINS = [
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", // cKES
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", // cREAL
  "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08", // eXOF
  "0x8A567e2aE79CA692Bd748aB832081C45de4041eA", // cCOP
  "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313", // cGHS
  "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B", // PUSO
  "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3", // USDGLO
  "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71", // cNGN
];

// Valid collateral assets from deployment config
const SUPPORTED_COLLATERAL = [
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
  "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3", // USDGLO
];

const TOKEN_INFO: Record<string, { symbol: string; decimals: number }> = {
  "0x471EcE3750Da237f93B8E339c536989b8978a438": {
    symbol: "CELO",
    decimals: 18,
  },
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": {
    symbol: "cUSD",
    decimals: 18,
  },
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": {
    symbol: "cEUR",
    decimals: 18,
  },
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": {
    symbol: "cREAL",
    decimals: 18,
  },
  "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": {
    symbol: "eXOF",
    decimals: 18,
  },
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": {
    symbol: "cKES",
    decimals: 18,
  },
  "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": {
    symbol: "PUSO",
    decimals: 18,
  },
  "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": {
    symbol: "cCOP",
    decimals: 18,
  },
  "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": {
    symbol: "cGHS",
    decimals: 18,
  },
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": { symbol: "USDT", decimals: 6 },
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": { symbol: "USDC", decimals: 6 },
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": {
    symbol: "USDGLO",
    decimals: 18,
  },
  "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71": {
    symbol: "cNGN",
    decimals: 18,
  },
};

export default function DashboardPage() {
  const account = useActiveAccount();
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { connect } = useConnect();
  const address = account?.address;
  const isConnected = !!address;
  
  // Debug logs to track wallet connection status
  useEffect(() => {
    console.log("Dashboard mounted, wallet connection status:", { 
      address,
      isConnected,
      account
    });
  }, [address, isConnected, account]);

  const contract = getContract({
    address: MINILEND_ADDRESS,
    chain: celo,
    client,
  });

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationSkipped, setVerificationSkipped] = useState(false);

  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(
    {}
  );

  const {
    deposits,
    depositValue,
    borrows,
    borrowValue,
    interest,
    interestUsd,
    totalInterestUsd,
    lockEnds,
    nearestUnlockTime,
    loading: dashboardLoading,
    tokenInfo,
  } = useEnhancedDashboard(address);

  const bigIntPow10 = (n: number) => {
    let result = BigInt(1);
    for (let i = 0; i < n; i++) result *= BigInt(10);
    return result;
  };

  const formatAmount = (amountStr: string, token: string) => {
    const info = TOKEN_INFO[token];
    const decimals = info?.decimals ?? 18;
    try {
      const amt = BigInt(amountStr || "0");
      // scale to a number string with decimals
      const denom = bigIntPow10(decimals);
      const intPart = (amt / denom).toString();
      const frac = (amt % denom).toString().padStart(decimals, "0").slice(0, 2);
      return `${intPart}.${frac}`;
    } catch {
      return "0.00";
    }
  };

  const totals = useMemo(() => {
    const saved = parseFloat(depositValue || "0");
    const borrowed = parseFloat(borrowValue || "0");
    const interest = parseFloat(totalInterestUsd || "0");
    
    return {
      saved: saved.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      borrowed: borrowed.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      interest: interest.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      nextUnlock: nearestUnlockTime ? new Date(nearestUnlockTime * 1000).toLocaleDateString() : null,
    };
  }, [depositValue, borrowValue, totalInterestUsd, nearestUnlockTime]);

  useEffect(() => {
    // Only auto-sign in if wallet is connected and user hasn't explicitly signed out
    if (isConnected && address && !session?.user?.address && sessionStatus !== "loading") {
      signIn("self-protocol", {
        address,
        verificationData: "",
        redirect: false,
      });
    }
  }, [isConnected, address, session, sessionStatus]);

  // Remove verification skip state tracking
  useEffect(() => {
    setVerificationSkipped(true); // Always consider verification as skipped for better UX
  }, []);

  // Make verification completely optional
  useEffect(() => {
    if (sessionStatus === "loading") return;
    // Disable verification prompts for better UX
    setNeedsVerification(false);
  }, [isConnected, session, sessionStatus, verificationSkipped]);

  // Show connect wallet prompt if not connected
  const renderConnectWallet = () => (
    <div className="min-h-screen bg-[#162013] flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-[#21301c] border-[#426039]">
        <CardContent className="p-6 text-center">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-[#54d22d]" />
          <h2 className="text-lg font-semibold text-white mb-4">
            Connect Your Wallet
          </h2>
          <p className="text-[#a2c398] mb-6">
            Connect your wallet to view your financial dashboard
          </p>
          <div className="flex flex-col space-y-3">
            <div className="w-full">
              <ConnectWallet 
                size="lg"
                className="w-full" 
              />
            </div>
            <Link href="/" className="w-full">
              <Button className="bg-transparent border border-[#426039] hover:bg-[#2e4328] text-[#a2c398] font-medium w-full">
                Go to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Allow dashboard exploration without connection

  return (
    <div className="min-h-screen bg-[#162013]">
      <header className="bg-[#21301c] border-b border-[#426039] px-4 py-3">
        <div className="flex items-center max-w-lg mx-auto">
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="mr-3 p-2 text-[#a2c398] hover:text-white hover:bg-[#2e4328]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center flex-1">
            {/* <div className="w-8 h-8 bg-[#54d22d] rounded-full flex items-center justify-center mr-3">
              <DollarSign className="w-5 h-5 text-[#162013]" />
            </div> */}
            <div>
              {/* <h1 className="text-lg font-bold text-white">Your Money</h1> */}
              <div className="text-xs text-[#a2c398]">
                {formatAddress(address || "")}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto pb-24 space-y-6">
        {/* Optional verification banner - only show if user wants to verify */}
        {isConnected && !session?.user?.verified && (
          <div className="bg-[#2e4328]/50 border border-[#426039] text-[#a2c398] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Shield className="w-5 h-5 mr-3 text-[#54d22d]" />
                <p className="text-sm">
                  Optional: Verify your identity for enhanced features
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  onClick={() => router.push("/self")}
                  className="bg-[#54d22d] hover:bg-[#426039] text-[#162013] text-xs px-4 py-2"
                >
                  Verify
                </Button>
              </div>
            </div>
          </div>
        )}

        <Card className="bg-[#21301c] border-[#426039]">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-center text-white mb-6">
              Your Account Overview
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-[#2e4328] rounded-xl">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-[#54d22d]" />
                <p className="text-sm font-medium mb-1 text-[#a2c398]">
                  Money Saved
                </p>
                <p className="text-2xl font-bold text-white">
                  {!isConnected ? "--" : dashboardLoading ? "..." : `$${totals.saved}`}
                </p>
                {totals.nextUnlock && (
                  <p className="text-xs text-[#a2c398] mt-2">
                    Next unlock: {totals.nextUnlock}
                  </p>
                )}
              </div>
              <div className="text-center p-4 bg-[#2e4328] rounded-xl">
                <ArrowDownLeft className="w-6 h-6 mx-auto mb-2 text-[#54d22d]" />
                <p className="text-sm font-medium mb-1 text-[#a2c398]">
                  Money Borrowed
                </p>
                <p className="text-2xl font-bold text-white">
                  {!isConnected ? "--" : dashboardLoading ? "..." : `$${totals.borrowed}`}
                </p>
                {parseFloat(totals.interest) > 0 && (
                  <p className="text-xs text-[#a2c398] mt-2">
                    Interest: ${totals.interest}
                  </p>
                )}
              </div>
            </div>
            <div className="flex space-x-3">
              <Button
                className="flex-1 h-12 text-sm font-medium bg-[#54d22d] hover:bg-[#426039] text-[#162013]"
                onClick={() => {
                  if (!isConnected) {
                    alert('Please sign in to use this feature');
                    return;
                  }
                  setWithdrawOpen(true);
                }}
              >
                Cash Out
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 text-sm font-medium border-[#426039] text-[#54d22d] hover:bg-[#2e4328] bg-transparent"
                onClick={() =>
                  window.open(
                    `https://celoscan.io/address/${address}`,
                    "_blank"
                  )
                }
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                History
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#21301c] border-[#426039]">
          <CardHeader className="p-4 pb-2">
            {/* <CardTitle className="flex items-center justify-center text-lg text-white">
              <Wallet className="w-5 h-5 mr-2 text-[#54d22d]" />
              Your Wallet Details
            </CardTitle> */}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-[#2e4328] rounded-xl">
                <div className="w-8 h-8 bg-[#54d22d] rounded-full flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="w-4 h-4 text-[#162013]" />
                </div>
                <p className="text-xs font-medium mb-1 text-[#a2c398]">
                  Savings
                </p>
                {dashboardLoading ? (
                  <div className="animate-spin w-4 h-4 border border-[#54d22d] border-t-transparent rounded-full mx-auto"></div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-white">
                      ${totals.saved}
                    </p>
                    {totals.nextUnlock && (
                      <p className="text-[10px] text-[#a2c398] mt-1">
                        Unlock: {totals.nextUnlock}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="text-center p-4 bg-[#2e4328] rounded-xl">
                <div className="w-8 h-8 bg-[#54d22d] rounded-full flex items-center justify-center mx-auto mb-2">
                  <ArrowDownLeft className="w-4 h-4 text-[#162013]" />
                </div>
                <p className="text-xs font-medium mb-1 text-[#a2c398]">Loans</p>
                {dashboardLoading ? (
                  <div className="animate-spin w-4 h-4 border border-[#54d22d] border-t-transparent rounded-full mx-auto"></div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-white">
                      ${totals.borrowed}
                    </p>
                    {parseFloat(totals.interest) > 0 && (
                      <p className="text-[10px] text-[#a2c398] mt-1">
                        Int: ${totals.interest}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="text-center p-4 bg-[#2e4328] rounded-xl">
                <div className="w-8 h-8 bg-[#54d22d] rounded-full flex items-center justify-center mx-auto mb-2">
                  <Shield className="w-4 h-4 text-[#162013]" />
                </div>
                <p className="text-xs font-medium mb-1 text-[#a2c398]">
                  Assets
                </p>
                {dashboardLoading ? (
                  <div className="animate-spin w-4 h-4 border border-[#54d22d] border-t-transparent rounded-full mx-auto"></div>
                ) : (
                  <p className="text-sm font-bold text-white">
                    {Object.keys(deposits).filter(token => 
                      deposits[token] !== "0"
                    ).length || 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="bg-[#21301c] border-t border-[#426039] py-3 fixed bottom-0 left-0 right-0">
        <div className="flex justify-center max-w-lg mx-auto">
          <Link
            href="/"
            className="flex flex-col items-center text-[#a2c398] hover:text-white px-8"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex flex-col items-center text-[#54d22d] px-8"
          >
            <ArrowDownLeft className="w-5 h-5" />
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
        </div>
      </footer>

      <FundsWithdrawalModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onWithdraw={async () => {}}
        userDeposits={deposits}
        depositLockEnds={lockEnds}
        tokenInfos={tokenInfo}
        loading={dashboardLoading}
        userAddress={address}
        getWithdrawableAmount={async (token: string) => {
          if (!deposits[token] || deposits[token] === "0") return "0";
          if (lockEnds[token] && lockEnds[token] > Math.floor(Date.now() / 1000)) {
            return "0"; // Still locked
          }
          return deposits[token]; // Available for withdrawal
        }}
      />
    </div>
  );
}
