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
} from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatAddress } from "@/lib/utils";
import { FundsWithdrawalModal } from "@/components/FundsWithdrawalModal";
// Use configured contracts mapping from chainConfig
import { getContract, prepareContractCall, waitForReceipt } from "thirdweb";
import { parseUnits } from "viem";
import { getVaultAddress } from "@/config/chainConfig";
import {
  useActiveAccount,
  useReadContract,
  useConnect,
  useSendTransaction,
  useWalletBalance,
} from "thirdweb/react";
import { vaultService, VaultPosition } from "@/lib/services/vaultService";
import { VAULT_CONTRACTS } from "@/config/chainConfig";
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
    if (process.env.NODE_ENV === "development") {
      console.log("Dashboard mounted, wallet connection status:", {
        address: address?.substring(0, 10) + "...",
        isConnected,
        hasAccount: !!account,
      });
    }
  }, [address, isConnected, account]);

  const {
    chain: selectedChain,
    contract,
    contractAddress,
    tokenInfos,
    tokens,
  } = useChain();

  const VAULT_TOKENS = useMemo(() => {
    const vaults = VAULT_CONTRACTS[selectedChain.id];
    return vaults ? Object.keys(vaults) : [];
  }, [selectedChain.id]);

  // Vault positions state
  const [vaultPositions, setVaultPositions] = useState<VaultPosition[]>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "KES">("KES");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(
    {}
  );

  // Fetch vault positions
  useEffect(() => {
    if (!address || VAULT_TOKENS.length === 0) return;

    let mounted = true;
    setIsLoadingPositions(true);

    const fetchPositions = async () => {
      try {
        const positions = await vaultService.getAllVaultPositions(
          selectedChain,
          address,
          VAULT_TOKENS
        );

        if (mounted) {
          setVaultPositions(positions);
        }
      } catch (err) {
        console.error("[dashboard] error fetching vault positions", err);
      } finally {
        if (mounted) {
          setIsLoadingPositions(false);
        }
      }
    };

    fetchPositions();

    return () => {
      mounted = false;
    };
  }, [address, selectedChain, VAULT_TOKENS]);

  const performance = useMemo(() => {
    return vaultPositions.map((pos) => ({
      token: pos.tokenAddress,
      symbol: pos.tokenSymbol,
      depositWei: pos.totalPrincipal,
      currentValueWei: pos.totalCurrentValue,
      interestWei: pos.totalYield,
      decimals: pos.decimals,
      deposits: pos.deposits,
      aaveDeployed: pos.aaveDeployed,
      aaveHarvested: pos.aaveHarvested,
    }));
  }, [vaultPositions]);

  const formatAmount = (amountStr: string, decimals: number = 18) => {
    try {
      const amt = BigInt(amountStr || "0");
      const divisor = BigInt(10 ** decimals);
      const value = Number(amt) / Number(divisor);
      return value.toFixed(6);
    } catch {
      return "0.000000";
    }
  };

  const dashboardLoading = isLoadingPositions;

  const normalizedDeposits = useMemo(() => {
    const out: Record<string, string> = {};
    vaultPositions.forEach((pos) => {
      out[pos.tokenAddress] = pos.totalCurrentValue;
    });
    return out;
  }, [vaultPositions]);

  const normalizedLockEnds = useMemo(() => {
    const out: Record<string, number> = {};
    const now = Math.floor(Date.now() / 1000);
    vaultPositions.forEach((pos) => {
      const anyUnlocked = pos.deposits.some((d) => d.canWithdraw);
      const futureLocks = pos.deposits
        .filter((d) => !d.canWithdraw)
        .map((d) => d.lockEnd);
      out[pos.tokenAddress] = anyUnlocked
        ? 0
        : futureLocks.length > 0
          ? Math.min(...futureLocks)
          : 0;
    });
    return out;
  }, [vaultPositions]);

  useEffect(() => {
    setExchangeRates({ KES_USD: 0.0078 });
  }, []);

  const { mutateAsync: sendTransaction, isPending: isTransactionPending } =
    useSendTransaction({ payModal: false });

  const totals = useMemo(() => {
    try {
      let savedUSD = 0;
      let totalYieldUSD = 0;

      vaultPositions.forEach((pos) => {
        const valueBigInt = BigInt(pos.totalCurrentValue);
        const yieldBigInt = BigInt(pos.totalYield);
        const divisor = BigInt(10 ** pos.decimals);

        const value = Number(valueBigInt) / Number(divisor);
        const yield_ = Number(yieldBigInt) / Number(divisor);

        savedUSD += value;
        totalYieldUSD += yield_;
      });

      return {
        saved: savedUSD.toFixed(6),
        borrowed: "0.00",
        interest: totalYieldUSD.toFixed(6),
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
  }, [vaultPositions]);

  // Convert amounts between USD and KES
  const convertAmount = (
    amount: string,
    fromCurrency: "USD" | "KES" = "USD"
  ) => {
    const rate = exchangeRates.KES_USD || 1;
    const numAmount = parseFloat(amount);
    if (displayCurrency === "KES" && fromCurrency === "USD") {
      return (numAmount / rate).toFixed(2);
    }
    if (displayCurrency === "USD" && fromCurrency === "KES") {
      return (numAmount * rate).toFixed(2);
    }
    return amount;
  };

  useEffect(() => {
    // Only auto-sign in if wallet is connected and user hasn't explicitly signed out
    if (
      isConnected &&
      address &&
      !session?.user?.address &&
      sessionStatus !== "loading"
    ) {
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
              className="mr-3 p-2 text-muted-foreground hover:text-foreground hover:bg-card"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center flex-1">
            {/* <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-3">
              <DollarSign className="w-5 h-5 text-primary-foreground" />
            </div> */}
            <div>
              {/* <h1 className="text-lg font-bold text-foreground">Your Money</h1> */}
              <div className="text-xs text-muted-foreground">
                {formatAddress(address || "")}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 ml-3">
            {/* Render the ConnectWallet button so thirdweb can rehydrate/persist the user's session on reload */}
            <ConnectWallet />
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto pb-24 space-y-6 relative z-10">
        {/* Error display */}
        {error && (
          <div className="bg-destructive/20 border border-destructive text-destructive-foreground p-3 rounded-xl text-sm mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-destructive-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
        )}

        {/* Optional verification banner - only show if user wants to verify */}
        {isConnected && !session?.user?.verified && (
          <div className="bg-warning/30 backdrop-blur-sm border border-warning/50 text-foreground rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Shield className="w-5 h-5 mr-3 text-primary" />
                <p className="text-sm">
                  Optional: Verify your identity for enhanced features
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  onClick={() => router.push("/self")}
                  className="bg-primary hover:bg-muted text-primary-foreground text-xs px-4 py-2"
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
              <h2 className="text-xl font-bold text-foreground">
                Your Account Overview
              </h2>
              <button
                onClick={() =>
                  setDisplayCurrency(displayCurrency === "USD" ? "KES" : "USD")
                }
                className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
              >
                {displayCurrency}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-black/30 backdrop-blur-sm rounded-xl">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-xs font-normal mb-1 text-muted-foreground">
                  Money Saved
                </p>
                <p className="text-lg font-normal text-foreground">
                  {!isConnected
                    ? "--"
                    : dashboardLoading
                      ? "..."
                      : `${displayCurrency === "KES" ? "KES" : "$"} ${convertAmount(totals.saved)}`}
                </p>
              </div>
              <div className="text-center p-4 bg-black/30 backdrop-blur-sm rounded-xl">
                <ArrowDownLeft className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-xs font-normal mb-1 text-muted-foreground">
                  Interest Earned
                </p>
                <p className="text-lg font-normal text-foreground">
                  {!isConnected
                    ? "--"
                    : dashboardLoading
                      ? "..."
                      : `${displayCurrency === "KES" ? "KES" : "$"} ${convertAmount(totals.interest)}`}
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button
                className="flex-1 h-12 text-sm font-medium bg-primary hover:bg-muted text-primary-foreground"
                onClick={() => {
                  if (!isConnected) {
                    setError("Please connect your wallet to use this feature");
                    return;
                  }
                  setWithdrawOpen(true);
                }}
                disabled={isProcessing || isTransactionPending}
              >
                {isProcessing || isTransactionPending
                  ? "Processing..."
                  : "Cash Out"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 text-sm font-medium border-border text-primary hover:bg-card bg-transparent"
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
            <CardTitle className="text-lg text-foreground">
              Locked Savings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {performance.filter((p) => BigInt(p.depositWei) > 0).length ===
            0 ? (
              <p className="text-sm text-muted-foreground">
                No deposited assets found.
              </p>
            ) : (
              <div className="space-y-3">
                {performance
                  .filter((p) => BigInt(p.depositWei) > 0)
                  .map((p) => (
                    <div
                      key={p.token}
                      className="flex items-center justify-between p-3 bg-black/30 rounded-xl"
                    >
                      <div>
                        <div className="text-sm text-muted-foreground">
                          {p.symbol}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatAddress(p.token)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-foreground">
                          {formatAmount(p.currentValueWei, p.decimals)}{" "}
                          {p.symbol}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Yield: {formatAmount(p.interestWei, p.decimals)}{" "}
                          {p.symbol}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.deposits.some((d) => d.canWithdraw)
                            ? "Available"
                            : "Locked"}
                        </div>
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
            className="flex flex-col items-center text-muted-foreground hover:text-foreground px-8"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex flex-col items-center text-primary px-8"
          >
            <ArrowDownLeft className="w-5 h-5" />
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
        </div>
      </footer>

      <FundsWithdrawalModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        vaultPositions={vaultPositions}
        onWithdraw={async (tokenSymbol: string, depositIds: number[]) => {
          if (!account || !tokenSymbol || depositIds.length === 0) {
            setError("Missing required parameters for withdrawal");
            return;
          }

          setIsProcessing(true);
          setError(null);

          try {
            const vaultAddress = getVaultAddress(selectedChain.id, tokenSymbol);
            const vaultContract = getContract({
              client,
              chain: selectedChain,
              address: vaultAddress,
            });

            // Withdraw each deposit by ID
            for (const depositId of depositIds) {
              if (depositId === undefined || depositId === null) {
                console.error("Invalid depositId:", depositId);
                continue;
              }
              const withdrawTx = prepareContractCall({
                contract: vaultContract,
                method:
                  "function withdraw(uint256 depositId) returns (uint256)",
                params: [BigInt(depositId)],
              });

              const result = await sendTransaction(withdrawTx);
              if (result?.transactionHash) {
                await waitForReceipt({
                  client,
                  chain: selectedChain,
                  transactionHash: result.transactionHash,
                });
              }
            }

            setWithdrawOpen(false);
          } catch (error: any) {
            console.error("Withdrawal error:", error);
            setError(error.message || "Failed to process withdrawal");
          } finally {
            setIsProcessing(false);
          }
        }}
        tokenInfos={tokenInfos}
        loading={dashboardLoading || isProcessing}
      />
    </div>
  );
}
