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
  AlertCircle,
}
from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatAddress } from "@/lib/utils";
import { FundsWithdrawalModal } from "@/components/FundsWithdrawalModal";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";
import { getContract, prepareContractCall, waitForReceipt } from "thirdweb";
import { useActiveAccount, useReadContract, useConnect, useSendTransaction, useWalletBalance } from "thirdweb/react";
import { useUserDeposits, useUserBorrows, useAccumulatedInterest, useGetUserBalance } from "@/lib/thirdweb/minilend-contract";
import { thirdwebService } from "@/lib/services/thirdwebService";
import { client } from "@/lib/thirdweb/client";
import { celo } from "thirdweb/chains";


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
  // Use Math.pow then convert to BigInt to avoid BigInt literal syntax
  const account = useActiveAccount();
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const address = account?.address;
  const isConnected = !!address;
  
  // Debug logs to track wallet connection status (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("Dashboard mounted, wallet connection status:", { 
        address: address?.substring(0, 10) + '...',
        isConnected,
        hasAccount: !!account
      });
    }
  }, [address, isConnected, account]);

  const contract = getContract({
    address: MINILEND_ADDRESS,
    chain: celo,
    client,
  });

  // Log contract info for debugging wallet/contract connectivity
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("[dashboard] contract info:", {
        minilendAddress: MINILEND_ADDRESS,
        accountAddress: address,
        contractInstance: contract,
      });
    }
  }, [contract, address]);

  const [withdrawOpen, setWithdrawOpen] = useState(false);


  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // Default to local currency (KES) for dashboard UX
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'KES'>('KES');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

  // Use the typed hooks to read user-specific data from the contract
  const C_KES = "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0";
  const cKESUserDeposit = useUserDeposits(contract, address || "", C_KES, BigInt(0));
  // Use contract helper to get the user's total balance (deposits + yield) for the token
  const cKESUserBalance = useGetUserBalance(contract, address || "", C_KES);
  const cKESUserBorrow = useUserBorrows(contract, address || "", C_KES);

  // Local state for UI usage
  const [depositsState, setDepositsState] = useState<Record<string, string>>({ [C_KES]: "0" });
  const [borrowsState, setBorrowsState] = useState<Record<string, string>>({ [C_KES]: "0" });
  const [lockEndsState, setLockEndsState] = useState<Record<string, number>>({ [C_KES]: 0 });

  useEffect(() => {
    if (!address) return;
    // Update when hook data arrives
    if (cKESUserBalance?.data) {
      try {
        // getUserBalance returns balance + yield (contract returns uint256)
        const total = cKESUserBalance.data?.toString?.() || "0";
        setDepositsState((p) => ({ ...p, [C_KES]: total }));
      } catch (err) {
        console.error('[dashboard] parsing cKESUserBalance', err, cKESUserBalance.data);
      }
    } else if (cKESUserDeposit?.data) {
      // fallback: use first deposit entry if balance helper not available
      try {
        const amount = cKESUserDeposit.data[0]?.toString?.() || "0";
        setDepositsState((p) => ({ ...p, [C_KES]: amount }));
      } catch (err) {
        console.error('[dashboard] parsing cKESUserDeposit', err, cKESUserDeposit.data);
      }
    }

    if (cKESUserDeposit?.data) {
      // preserve lock end from the first deposit entry (best-effort)
      try {
        const lockEnd = Number(cKESUserDeposit.data[1]) || 0;
        setLockEndsState((p) => ({ ...p, [C_KES]: lockEnd }));
      } catch (err) {
        console.error('[dashboard] parsing cKESUserDeposit lockEnd', err, cKESUserDeposit.data);
      }
    }

    if (cKESUserBorrow?.data) {
      setBorrowsState((p) => ({ ...p, [C_KES]: cKESUserBorrow.data?.toString?.() || "0" }));
    }
  }, [cKESUserDeposit?.data, cKESUserBorrow?.data, address]);

  // Fetch all deposits for supported tokens and compute aggregate totals + sensible lockEnds
  useEffect(() => {
    if (!address) return;

    let mounted = true;

    const fetchAll = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        // Parallelize per-token fetches
        const promises = SUPPORTED_STABLECOINS.map(async (token) => {
          const deposits = await thirdwebService.getAllUserDeposits(address, token);
          if (!deposits || deposits.length === 0) return { token, total: "0", anyUnlocked: false, nextUnlock: 0 };

          // Sum amounts
          let total = BigInt(0);
          for (const d of deposits) {
            total += BigInt(d.amount || "0");
          }

          // Determine unlocks: if any deposit is unlocked, mark anyUnlocked true
          const anyUnlocked = deposits.some((d) => (d.lockEnd || 0) <= now);

          // If none unlocked, pick the earliest future lockEnd as nextUnlock
          const futureLockEnds = deposits.map((d) => d.lockEnd || 0).filter((t) => t > now);
          const nextUnlock = futureLockEnds.length > 0 ? Math.min(...futureLockEnds) : 0;

          return { token, total: total.toString(), anyUnlocked, nextUnlock };
        });

        const results = await Promise.all(promises);

        if (!mounted) return;

        const newDeposits: Record<string, string> = {};
        const newLockEnds: Record<string, number> = {};

        for (const r of results) {
          newDeposits[r.token] = r.total;
          // If any deposit is unlocked, set lockEnd to 0 so modal logic treats token as available
          newLockEnds[r.token] = r.anyUnlocked ? 0 : r.nextUnlock || 0;
        }

        setDepositsState((p) => ({ ...p, ...newDeposits }));
        setLockEndsState((p) => ({ ...p, ...newLockEnds }));
      } catch (err) {
        console.error('[dashboard] error fetching all deposits', err);
      }
    };

    fetchAll();

    return () => {
      mounted = false;
    };
  }, [address]);

  // Accumulated interest (protocol-level) for the user
  const accumulatedInterest = useAccumulatedInterest(contract, address || "");

  // Local token info reference (move above performance to avoid TDZ)
  const tokenInfo = TOKEN_INFO;

  const performance = useMemo(() => {
    try {
      const entries = Object.keys(depositsState || {});
  const depositWeis: Record<string, bigint> = {};
  let totalDeposits = BigInt(0);

      for (const t of entries) {
        const v = BigInt(depositsState[t] || "0");
        depositWeis[t] = v;
        totalDeposits += v;
      }

      const totalInterest = BigInt(accumulatedInterest?.data?.toString?.() || "0");

      const rows = entries.map((t) => {
  const decimals = TOKEN_INFO[t]?.decimals || 18;
  const depositWei = depositWeis[t] || BigInt(0);
  const interestWei = totalDeposits > BigInt(0) ? (totalInterest * depositWei) / totalDeposits : BigInt(0);
        const lockEnd = lockEndsState[t] || 0;
        return {
          token: t,
          symbol: tokenInfo[t]?.symbol || t.slice(0, 6),
          depositWei: depositWei.toString(),
          interestWei: interestWei.toString(),
          decimals,
          lockEnd,
        };
      });

    return { totalDeposits: totalDeposits.toString(), rows };
    } catch (err) {
      console.error('[dashboard] performance calc error', err);
      return { totalDeposits: "0", rows: [] };
    }
  }, [depositsState, lockEndsState, accumulatedInterest]);

  // Debug logs: show values returned from contract read hooks
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("[dashboard] read results:", {
        cKESUserDeposit: cKESUserDeposit?.data,
        cKESUserBorrow: cKESUserBorrow?.data,
        depositsState,
        borrowsState,
        lockEndsState,
      });
    }
  }, [cKESUserDeposit?.data, cKESUserBorrow?.data, depositsState, borrowsState, lockEndsState]);

  const formatAmount = (amountStr: string, decimals: number = 18) => {
    try {
      const amt = BigInt(amountStr || "0");
  const denom = BigInt(Math.pow(10, decimals));
      const intPart = (amt / denom).toString();
      const frac = (amt % denom).toString().padStart(decimals, "0").slice(0, 2);
      return `${intPart}.${frac}`;
    } catch {
      return "0.00";
    }
  };

  const deposits = depositsState;
  const borrows = borrowsState;
  const lockEnds = lockEndsState;
  const dashboardLoading = false;

  // Use fixed exchange rate to avoid oracle issues
  useEffect(() => {
    if (address) {
      setExchangeRates({ KES_USD: 0.0078 }); // 1 KES ≈ 0.0078 USD
    }
  }, [address]);

  // Use the working transaction hook from modals
  const { mutateAsync: sendTransaction, isPending: isTransactionPending } = useSendTransaction({ payModal: false });

  // Calculate totals with proper error handling
  const totals = useMemo(() => {
    try {
      // Sum deposits and borrows and convert to USD where applicable.
      let savedUSD = 0;
      let borrowedUSD = 0;

      const rate = exchangeRates.KES_USD || 0.0078; // KES -> USD

      for (const [token, amtStr] of Object.entries(deposits)) {
        const decimals = tokenInfo[token]?.decimals || 18;
        const tokenAmount = parseFloat(formatAmount(amtStr || "0", decimals));
        const symbol = tokenInfo[token]?.symbol || "";

        // cKES is pegged to KES (1 cKES == 1 KES) so convert to USD via rate
        if (symbol === "cKES") {
          savedUSD += tokenAmount * rate;
        } else {
          // assume token amount is USD-pegged (USDC, USDT, cUSD) or treat as USD for now
          savedUSD += tokenAmount;
        }
      }

      for (const [token, amtStr] of Object.entries(borrows)) {
        const decimals = tokenInfo[token]?.decimals || 18;
        const tokenAmount = parseFloat(formatAmount(amtStr || "0", decimals));
        const symbol = tokenInfo[token]?.symbol || "";

        if (symbol === "cKES") {
          borrowedUSD += tokenAmount * rate;
        } else {
          borrowedUSD += tokenAmount;
        }
      }

      return {
        // keep raw numeric strings with extra precision; UI formatter will present final 2-decimal values
        saved: savedUSD.toFixed(6),
        borrowed: borrowedUSD.toFixed(6),
        interest: "0.00",
        nextUnlock: null,
      };
    } catch (error) {
      console.error("Error calculating totals:", error);
      return {
        saved: "0.00",
        borrowed: "0.00",
        interest: "0.00",
        nextUnlock: null,
      };
    }
  }, [deposits, borrows]);

  // Convert amounts between USD and KES
  const convertAmount = (amount: string, fromCurrency: 'USD' | 'KES' = 'USD') => {
    const rate = exchangeRates.KES_USD || 1;
    const numAmount = parseFloat(amount);
    if (displayCurrency === 'KES' && fromCurrency === 'USD') {
      return (numAmount / rate).toFixed(2);
    }
    if (displayCurrency === 'USD' && fromCurrency === 'KES') {
      return (numAmount * rate).toFixed(2);
    }
    return amount;
  };

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




  // Allow dashboard exploration without connection

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Safari Background */}
      <div className="fixed inset-0 bg-[url('/african-safari-scene-2005.jpg')] bg-cover bg-center bg-no-repeat">
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70"></div>
      </div>
      <header className="bg-black/60 backdrop-blur-md border-b border-white/10 px-4 py-3 relative z-40">
        <div className="flex items-center justify-between max-w-lg mx-auto">
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
          <div className="flex-shrink-0 ml-3">
            {/* Render the ConnectWallet button so thirdweb can rehydrate/persist the user's session on reload */}
            <ConnectWallet size="sm" />
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto pb-24 space-y-6 relative z-10">
        {/* Error display */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 text-red-300 p-3 rounded-xl text-sm mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-300 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Optional verification banner - only show if user wants to verify */}
        {isConnected && !session?.user?.verified && (
          <div className="bg-yellow-600/30 backdrop-blur-sm border border-yellow-500/30 text-yellow-200 rounded-xl p-4">
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

        <Card className="bg-black/40 backdrop-blur-md border-white/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                Your Account Overview
              </h2>
              <button
                onClick={() => setDisplayCurrency(displayCurrency === 'USD' ? 'KES' : 'USD')}
                className="px-3 py-1 bg-[#54d22d] text-[#162013] rounded-lg text-sm font-medium"
              >
                {displayCurrency}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-black/30 backdrop-blur-sm rounded-xl">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-[#54d22d]" />
                <p className="text-sm font-medium mb-1 text-[#a2c398]">
                  Money Saved
                </p>
                <p className="text-2xl font-bold text-white">
                  {!isConnected ? "--" : dashboardLoading ? "..." : `${displayCurrency === 'KES' ? 'KES' : '$'}${convertAmount(totals.saved)}`}
                </p>
                {totals.nextUnlock && (
                  <p className="text-xs text-[#a2c398] mt-2">
                    Next unlock: {totals.nextUnlock}
                  </p>
                )}
              </div>
              <div className="text-center p-4 bg-black/30 backdrop-blur-sm rounded-xl">
                <ArrowDownLeft className="w-6 h-6 mx-auto mb-2 text-[#54d22d]" />
                <p className="text-sm font-medium mb-1 text-[#a2c398]">
                  Money Borrowed
                </p>
                <p className="text-2xl font-bold text-white">
                  {!isConnected ? "--" : dashboardLoading ? "..." : `${displayCurrency === 'KES' ? 'KES' : '$'}${convertAmount(totals.borrowed)}`}
                </p>
                {parseFloat(totals.interest) > 0 && (
                  <p className="text-xs text-[#a2c398] mt-2">
                    Interest: {displayCurrency === 'KES' ? 'KSh' : '$'}{convertAmount(totals.interest)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex space-x-3">
              <Button
                className="flex-1 h-12 text-sm font-medium bg-[#54d22d] hover:bg-[#426039] text-[#162013]"
                onClick={() => {
                  if (!isConnected) {
                    setError('Please connect your wallet to use this feature');
                    return;
                  }
                  setWithdrawOpen(true);
                }}
                disabled={isProcessing || isTransactionPending}
              >
                {isProcessing || isTransactionPending ? "Processing..." : "Cash Out"}
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

        {/* Assets performance */}
        <Card className="bg-black/40 backdrop-blur-md border-white/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-lg text-white">Locked Savings</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {performance.rows.length === 0 ? (
              <p className="text-sm text-[#a2c398]">No deposited assets found.</p>
            ) : (
              <div className="space-y-3">
                {performance.rows.map((r) => (
                  <div key={r.token} className="flex items-center justify-between p-3 bg-black/30 rounded-xl">
                    <div>
                      <div className="text-sm text-[#a2c398]">{r.symbol}</div>
                      <div className="text-xs text-[#cfe6c8]">{formatAddress(r.token)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">{formatAmount(r.depositWei, r.decimals)} {r.symbol}</div>
                      <div className="text-xs text-[#a2c398]">Accrued: {formatAmount(r.interestWei, r.decimals)} {r.symbol}</div>
                      <div className="text-xs text-[#a2c398]">{r.lockEnd && r.lockEnd > Math.floor(Date.now()/1000) ? `Unlocks: ${new Date(r.lockEnd*1000).toLocaleString()}` : "Available"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="bg-black/60 backdrop-blur-md border-t border-white/10 py-3 fixed bottom-0 left-0 right-0 z-40">
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
        onWithdraw={async (token: string, amount: string) => {
          if (!account || !token || !amount) {
            setError("Missing required parameters for withdrawal");
            return;
          }

          setIsProcessing(true);
          setError(null);

          try {
            const decimals = tokenInfo[token]?.decimals || 18;
            const amountWei = BigInt(amount) * BigInt(Math.pow(10, decimals));

            if (process.env.NODE_ENV === 'development') {
              console.log('[dashboard] withdraw requested', { token, amount, decimals, amountWei: amountWei.toString(), account: account?.address, contractAddress: MINILEND_ADDRESS });
            }

            // Prepare withdrawal transaction
            const withdrawTx = prepareContractCall({
              contract,
              method: "function withdraw(address token, uint256 amount)",
              params: [token, amountWei],
            });

            if (process.env.NODE_ENV === 'development') {
              console.log('[dashboard] prepared withdrawTx', withdrawTx);
            }

            // Execute transaction
            const result = await sendTransaction(withdrawTx);
            
            if (result?.transactionHash) {
              await waitForReceipt({
                client,
                chain: celo,
                transactionHash: result.transactionHash,
              });
              
              // Close modal on success
              setWithdrawOpen(false);
            }
          } catch (error: any) {
            console.error("Withdrawal error:", error);
            setError(error.message || "Failed to process withdrawal");
          } finally {
            setIsProcessing(false);
          }
        }}
        userDeposits={deposits}
        depositLockEnds={lockEnds}
        tokenInfos={tokenInfo}
        loading={dashboardLoading || isProcessing}
        userAddress={address}
        getWithdrawableAmount={async (token: string) => {
          try {
            if (!deposits[token] || deposits[token] === "0") return "0";
            if (lockEnds[token] && lockEnds[token] > Math.floor(Date.now() / 1000)) {
              return "0"; // Still locked
            }
            return deposits[token]; // Available for withdrawal
          } catch (error) {
            console.error("Error calculating withdrawable amount:", error);
            return "0";
          }
        }}
      />
    </div>
  );
}
