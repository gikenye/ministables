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
// Use configured contracts mapping from chainConfig
import { getContract, prepareContractCall, waitForReceipt } from "thirdweb";
import { parseUnits } from "viem";
import { useActiveAccount, useReadContract, useConnect, useSendTransaction, useWalletBalance } from "thirdweb/react";
import { useUserDeposits, useUserBorrows, useAccumulatedInterest, useGetUserBalance } from "@/lib/thirdweb/minilend-contract";
import { thirdwebService } from "@/lib/services/thirdwebService";
import { client } from "@/lib/thirdweb/client";
import { useChain } from "@/components/ChainProvider";


interface UserData {
  deposits: Record<string, string>;
  borrows: Record<string, string>;
  collateral: Record<string, string>;
  lockEnds: Record<string, number>;
}


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

  const { chain: selectedChain, contract, contractAddress, tokenInfos, tokens } = useChain();

  const SUPPORTED_STABLECOINS = useMemo(() => {
    try {
      return (tokens || []).map((t: any) => t.address);
    } catch {
      return [];
    }
  }, [tokens]);

  // Log contract info for debugging wallet/contract connectivity
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("[dashboard] contract info:", {
        minilendAddress: contractAddress,
        accountAddress: address,
        contractInstance: contract,
        chainId: selectedChain.id,
      });
    }
  }, [contract, address, contractAddress, selectedChain]);

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

  // Use token info from chain config
  const tokenInfo = tokenInfos;

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
      const decimals = tokenInfo[t]?.decimals || 18;
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

  // Helper to check if user has existing savings
  const hasExistingSavings = useMemo(() => {
    return Object.values(deposits).some(amount => BigInt(amount || "0") > BigInt(0));
  }, [deposits]);

  // Normalize deposit and lock keys to match tokenInfo address casing so the modal's
  // tokenInfos lookup and the deposits object use the same keys (case-insensitive match).
  const normalizedDeposits = useMemo(() => {
    const out: Record<string, string> = {};
    const infoKeys = Object.keys(tokenInfo || {});
    for (const [k, v] of Object.entries(depositsState || {})) {
      const match = infoKeys.find((t) => t.toLowerCase() === k.toLowerCase());
      out[match || k] = v;
    }
    return out;
  }, [depositsState, tokenInfo]);

  const normalizedLockEnds = useMemo(() => {
    const out: Record<string, number> = {};
    const infoKeys = Object.keys(tokenInfo || {});
    for (const [k, v] of Object.entries(lockEndsState || {})) {
      const match = infoKeys.find((t) => t.toLowerCase() === k.toLowerCase());
      out[match || k] = Number(v || 0);
    }
    return out;
  }, [lockEndsState, tokenInfo]);

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
            <ConnectWallet/>
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
                <p className="text-xs font-normal mb-1 text-[#a2c398]">
                  Money Saved
                </p>
                <p className="text-lg font-normal text-white">
                  {!isConnected ? "--" : dashboardLoading ? "..." : `${displayCurrency === 'KES' ? 'KES' : '$'} ${convertAmount(totals.saved)}`}
                </p>
                {totals.nextUnlock && (
                  <p className="text-xs text-[#a2c398] mt-2">
                    Next unlock: {totals.nextUnlock}
                  </p>
                )}
              </div>
              <div className="text-center p-4 bg-black/30 backdrop-blur-sm rounded-xl">
                <ArrowDownLeft className="w-6 h-6 mx-auto mb-2 text-[#54d22d]" />
                <p className="text-xs font-normal mb-1 text-[#a2c398]">
                  Money Borrowed
                </p>
                <p className="text-lg font-normal text-white">
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
                  if (!hasExistingSavings) {
                    setError('No funds available to withdraw. Start saving first!');
                    return;
                  }
                  setWithdrawOpen(true);
                }}
                disabled={isProcessing || isTransactionPending || !hasExistingSavings}
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
            {performance.rows.filter(r => BigInt(r.depositWei) > 0).length === 0 ? (
              <p className="text-sm text-[#a2c398]">No deposited assets found.</p>
            ) : (
              <div className="space-y-3">
                {performance.rows
                  .filter(r => BigInt(r.depositWei) > 0)
                  .map((r) => (
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

  {/* Only show withdrawal modal if user has existing savings */}
      {hasExistingSavings && (
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
            // Use parseUnits to convert decimal string amounts (e.g. "0.10") to wei-safe bigint
            const amountWei = parseUnits(amount, decimals);

            if (process.env.NODE_ENV === 'development') {
              console.log('[dashboard] withdraw requested', { token, amount, decimals, amountWei: amountWei.toString(), account: account?.address, contractAddress });
            }

            // Check for outstanding borrows across supported stablecoins (contract will revert with E2 if any exist)
            try {
              const outstanding: string[] = [];
              for (const s of SUPPORTED_STABLECOINS) {
                try {
                  const b = await thirdwebService.getUserBorrows(account.address, s);
                  if (BigInt(b || "0") > BigInt(0)) {
                    const sym = tokenInfo[s]?.symbol || s.slice(0, 6);
                    outstanding.push(`${sym}: ${formatAmount(b || "0", tokenInfo[s]?.decimals || 18)}`);
                  }
                } catch (innerErr) {
                  console.warn('[dashboard] failed to read borrow for', s, innerErr);
                }
              }
              if (outstanding.length > 0) {
                setError(`You must repay outstanding loans before withdrawing. Outstanding: ${outstanding.join(', ')}`);
                setIsProcessing(false);
                return;
              }
            } catch (checkErr) {
              console.warn('[dashboard] borrow check failed, continuing to attempt tx', checkErr);
            }

            // Verify requested amount is withdrawable to avoid an on-chain revert during gas estimation
            try {
              const withdrawableStr = await thirdwebService.getWithdrawableAmount(account.address, token);
              const withdrawableWei = BigInt(withdrawableStr || "0");
              if (amountWei > withdrawableWei) {
                const availReadable = formatAmount(withdrawableStr || "0", decimals);
                setError(`Requested amount exceeds withdrawable balance (${availReadable} ${tokenInfo[token]?.symbol || ''})`);
                setIsProcessing(false);
                return;
              }
            } catch (checkErr) {
              console.warn('[dashboard] withdrawable check failed, continuing to attempt tx', checkErr);
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
              await waitForReceipt({ client, chain: selectedChain, transactionHash: result.transactionHash });

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
        userDeposits={normalizedDeposits}
        depositLockEnds={normalizedLockEnds}
        tokenInfos={tokenInfo}
        loading={dashboardLoading || isProcessing}
        userAddress={address}
        getWithdrawableAmount={async (token: string) => {
          try {
            if (!normalizedDeposits[token] || normalizedDeposits[token] === "0") return "0";
            if (normalizedLockEnds[token] && normalizedLockEnds[token] > Math.floor(Date.now() / 1000)) {
              return "0"; // Still locked
            }
            return normalizedDeposits[token]; // Available for withdrawal
          } catch (error) {
            console.error("Error calculating withdrawable amount:", error);
            return "0";
          }
        }}
        />
      )}
    </div>
  );
}
