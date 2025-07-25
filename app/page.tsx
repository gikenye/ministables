"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Sparkles,
  WifiOff,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { useContract } from "@/lib/contract";
import { useSession } from "next-auth/react";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { TransactionModal } from "@/components/TransactionModal";
import { SaveMoneyModal } from "@/components/SaveMoneyModal";
import { BorrowMoneyModal } from "@/components/BorrowMoneyModal";
import { PayBackModal } from "@/components/PayBackModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { formatAddress } from "@/lib/utils";
import {
  LoadingIndicator,
  DataAwareRender,
  OptimizedImage,
} from "@/components/ui/loading-indicator";
import { isDataSaverEnabled, enableDataSaver } from "@/lib/serviceWorker";

export default function HomePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { isConnected, address, connect, disconnect, isConnecting, error } =
    useWallet();

  const {
    supportedStablecoins,
    supportedCollateral,
    deposit,
    depositCollateral,
    borrow,
    repay,
    withdraw,
    getTokenBalance,
    getTokenInfo,
    getUserCollateral,
    getUserDeposits,
    getDepositLockEnd,
    loading,
  } = useContract();

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    message: string;
    txHash?: string;
  }>({
    isOpen: false,
    type: "success",
    message: "",
  });
  const [needsVerification, setNeedsVerification] = useState(false);

  const [userBalances, setUserBalances] = useState<Record<string, string>>({});
  const [userCollaterals, setUserCollaterals] = useState<
    Record<string, string>
  >({});
  const [userDeposits, setUserDeposits] = useState<Record<string, string>>({});
  const [depositLockEnds, setDepositLockEnds] = useState<
    Record<string, number>
  >({});
  const [tokenInfos, setTokenInfos] = useState<
    Record<string, { symbol: string; decimals: number }>
  >({});
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [dataSaverEnabled, setDataSaverEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (isConnected && address && supportedStablecoins.length > 0) {
      loadUserData();
    }
  }, [isConnected, address, supportedStablecoins]);

  // Check if user needs verification
  useEffect(() => {
    if (isConnected && !session?.user?.verified) {
      setNeedsVerification(true);
    } else {
      setNeedsVerification(false);
    }
  }, [isConnected, session]);

  // Redirect to verification page if needed
  useEffect(() => {
    if (needsVerification && isConnected) {
      const timer = setTimeout(() => {
        router.push("/self");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [needsVerification, isConnected, router]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener("online", handleOnlineStatus);
    window.addEventListener("offline", handleOnlineStatus);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnlineStatus);
      window.removeEventListener("offline", handleOnlineStatus);
    };
  }, []);

  // Check data saver status
  useEffect(() => {
    setDataSaverEnabled(isDataSaverEnabled());
  }, []);

  // Toggle data saver mode
  const toggleDataSaver = () => {
    const newState = !dataSaverEnabled;
    setDataSaverEnabled(newState);
    enableDataSaver(newState);
  };

  const loadUserData = async () => {
    if (!address) return;

    try {
      const balances: Record<string, string> = {};
      const collaterals: Record<string, string> = {};
      const deposits: Record<string, string> = {};
      const lockEnds: Record<string, number> = {};
      const infos: Record<string, { symbol: string; decimals: number }> = {};

      // Load stablecoin data
      for (const tokenAddress of supportedStablecoins) {
        const info = await getTokenInfo(tokenAddress);
        const balance = await getTokenBalance(tokenAddress, address);
        const deposit = await getUserDeposits(address, tokenAddress);
        const lockEnd = await getDepositLockEnd(address, tokenAddress);

        infos[tokenAddress] = info;
        balances[tokenAddress] = balance;
        deposits[tokenAddress] = deposit;
        lockEnds[tokenAddress] = lockEnd;
      }

      // Load collateral data
      for (const tokenAddress of supportedCollateral) {
        if (!infos[tokenAddress]) {
          const info = await getTokenInfo(tokenAddress);
          infos[tokenAddress] = info;
        }
        const balance = await getTokenBalance(tokenAddress, address);
        const collateral = await getUserCollateral(address, tokenAddress);

        balances[tokenAddress] = balance;
        collaterals[tokenAddress] = collateral;
      }

      setTokenInfos(infos);
      setUserBalances(balances);
      setUserCollaterals(collaterals);
      setUserDeposits(deposits);
      setDepositLockEnds(lockEnds);
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const handleSaveMoney = async (
    token: string,
    amount: string,
    lockPeriod: number
  ) => {
    try {
      const txHash = await deposit(token, amount, lockPeriod);
      setTransactionModal({
        isOpen: true,
        type: "success",
        message: "Your money was saved successfully!",
        txHash,
      });
      await loadUserData();
    } catch (error: any) {
      setTransactionModal({
        isOpen: true,
        type: "error",
        message:
          error.message || "Something went wrong while saving your money.",
      });
    }
  };

  const handleDepositCollateral = async (token: string, amount: string) => {
    try {
      const txHash = await depositCollateral(token, amount);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (address) {
        const updatedCollateral = await getUserCollateral(address, token);
        setUserCollaterals((prev) => ({
          ...prev,
          [token]: updatedCollateral,
        }));
      }

      setTransactionModal({
        isOpen: true,
        type: "success",
        message: "Your collateral was deposited successfully!",
        txHash,
      });

      await loadUserData();
    } catch (error: any) {
      setTransactionModal({
        isOpen: true,
        type: "error",
        message:
          error.message || "Something went wrong while depositing collateral.",
      });
    }
  };

  const handleBorrowMoney = async (
    token: string,
    amount: string,
    collateralToken: string
  ) => {
    try {
      const txHash = await borrow(token, amount, collateralToken);
      setTransactionModal({
        isOpen: true,
        type: "success",
        message: "You have successfully borrowed money!",
        txHash,
      });
      await loadUserData();
    } catch (error: any) {
      setTransactionModal({
        isOpen: true,
        type: "error",
        message: error.message || "Something went wrong while borrowing money.",
      });
    }
  };

  const handlePayBack = async (token: string, amount: string) => {
    try {
      const txHash = await repay(token, amount);
      setTransactionModal({
        isOpen: true,
        type: "success",
        message: "Your loan payment was successful!",
        txHash,
      });
      await loadUserData();
    } catch (error: any) {
      setTransactionModal({
        isOpen: true,
        type: "error",
        message:
          error.message || "Something went wrong while paying back your loan.",
      });
    }
  };

  const handleWithdraw = async (token: string, amount: string) => {
    try {
      const txHash = await withdraw(token, amount);
      setTransactionModal({
        isOpen: true,
        type: "success",
        message: "Your money was withdrawn successfully!",
        txHash,
      });
      await loadUserData();
    } catch (error: any) {
      setTransactionModal({
        isOpen: true,
        type: "error",
        message:
          error.message || "Something went wrong while withdrawing your money.",
      });
    }
  };

  const actionCards = [
    {
      id: "save",
      title: "Save Money",
      description: "Earn interest on your savings",
      icon: TrendingUp,
      color: "bg-gradient-to-br from-green-500 to-emerald-600",
      iconColor: "text-green-100",
    },
    {
      id: "borrow",
      title: "Borrow Money",
      description: "Get a loan with collateral",
      icon: ArrowDownLeft,
      color: "bg-gradient-to-br from-blue-500 to-cyan-600",
      iconColor: "text-blue-100",
    },
    {
      id: "withdraw",
      title: "Withdraw",
      description: "Take out your savings",
      icon: ArrowUpRight,
      color: "bg-gradient-to-br from-orange-500 to-amber-600",
      iconColor: "text-orange-100",
    },
    {
      id: "payback",
      title: "Pay Back",
      description: "Repay your loans",
      icon: ArrowUpRight,
      color: "bg-gradient-to-br from-purple-500 to-violet-600",
      iconColor: "text-purple-100",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-3 py-4 sticky top-0 z-40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-3 mb-3 sm:mb-0">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/minilend-logo.png" alt="Minilend Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-primary">
                MiniLend
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">
                Grow Your Money
              </p>
            </div>
          </div>

          {!isConnected ? (
            <div className="w-full sm:w-auto">
              <ConnectWalletButton className="w-full sm:w-auto bg-primary hover:bg-secondary text-white px-4 py-2 rounded-xl min-h-[48px] shadow-lg hover:shadow-xl transition-all duration-200" />
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </div>
          ) : (
            <div className="w-full sm:w-auto sm:text-right">
              <div className="bg-primary/10 rounded-xl px-3 py-2 mb-2">
                <p className="text-sm font-medium text-primary">
                  {formatAddress(address || "")}
                </p>
              </div>
              <Button
                onClick={disconnect}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-xs bg-transparent hover:bg-gray-100"
              >
                Disconnect
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="px-3 py-6 sm:px-4 sm:py-8 max-w-6xl mx-auto">
        {/* Data Saver Toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleDataSaver}
            className="flex items-center text-xs sm:text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md"
          >
            {dataSaverEnabled ? (
              <>
                <WifiOff className="w-3 h-3 mr-1" />
                Data Saver: ON
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 mr-1" />
                Data Saver: OFF
              </>
            )}
          </button>
        </div>
        {/* Offline Warning */}
        {!isOnline && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 mb-4 text-sm flex items-center">
            <WifiOff className="w-4 h-4 mr-2" />
            <p>You are currently offline. Some features may be limited.</p>
          </div>
        )}

        {needsVerification && isConnected && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 mb-4 text-sm flex items-center">
            <Shield className="w-4 h-4 mr-2" />
            <p>Identity verification required. Redirecting to verification page...</p>
          </div>
        )}
        {loading ? (
          <LoadingIndicator size="lg" text="Loading your account..." />
        ) : !isConnected ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl sm:shadow-2xl max-w-md w-full mx-3">
              <CardContent className="p-5 sm:p-8 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Wallet className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-primary mb-2 sm:mb-3">
                  Connect Your Wallet
                </h2>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                  Connect your wallet to start saving and borrowing money on the
                  Celo blockchain
                </p>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
                <ConnectWalletButton className="bg-primary hover:bg-secondary text-white w-full min-h-[48px] rounded-xl shadow-lg hover:shadow-xl transition-all duration-200" />
                {typeof window !== "undefined" && !window.ethereum && (
                  <p className="text-gray-500 text-xs sm:text-sm mt-4">
                    Don't have a wallet?{" "}
                    <a
                      href="https://metamask.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:text-secondary"
                    >
                      Install MetaMask
                    </a>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* Welcome Section */}
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
                Welcome to MiniLend
              </h2>
              <p className="text-gray-600 text-base sm:text-lg">
                Choose an action to get started
              </p>
              {/* Verification Badge */}
              {session?.user?.verified && (
                <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </div>
              )}
            </div>

            {/* Action Cards Grid */}
            <DataAwareRender
              lowBandwidthFallback={
                <div className="grid grid-cols-2 gap-3 max-w-4xl mx-auto px-2 sm:px-0">
                  {actionCards.map((card) => {
                    const IconComponent = card.icon;
                    return (
                      <Card
                        key={card.id}
                        className="group cursor-pointer border-0 shadow-sm bg-white/80 overflow-hidden"
                        onClick={() => {
                          if (card.id === "history") {
                            window.location.href = "/dashboard";
                          } else {
                            setActiveModal(card.id);
                          }
                        }}
                      >
                        <CardContent className="p-3 text-center">
                          <div
                            className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center mx-auto mb-2`}
                          >
                            <IconComponent
                              className={`w-5 h-5 ${card.iconColor}`}
                            />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
                              {card.title}
                            </h3>
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {card.description}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto px-2 sm:px-0">
                {actionCards.map((card) => {
                  const IconComponent = card.icon;
                  return (
                    <Card
                      key={card.id}
                      className="group cursor-pointer border-0 shadow-md sm:shadow-lg hover:shadow-xl sm:hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 sm:hover:-translate-y-2 bg-white/80 backdrop-blur-sm overflow-hidden"
                      onClick={() => {
                        if (card.id === "history") {
                          // Navigate to dashboard for history
                          window.location.href = "/dashboard";
                        } else {
                          setActiveModal(card.id);
                        }
                      }}
                    >
                      <CardContent className="p-3 sm:p-6 text-center relative">
                        <div
                          className={`w-10 h-10 sm:w-16 sm:h-16 ${card.color} rounded-lg sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-4 group-hover:scale-110 transition-transform duration-300`}
                        >
                          <IconComponent
                            className={`w-5 h-5 sm:w-8 sm:h-8 ${card.iconColor}`}
                          />
                        </div>
                        <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-0.5 sm:mb-2">
                          {card.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">
                          {card.description}
                        </p>

                        {/* Active state for touch devices */}
                        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </DataAwareRender>

            {/* Quick Stats */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-2xl mx-auto border-0 shadow-md sm:shadow-lg mx-3 sm:mx-auto">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 text-center">
                Quick Actions
              </h3>
              <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="w-full bg-white/80 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all duration-200 rounded-xl"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full bg-white/80 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all duration-200 rounded-xl"
                  onClick={() => window.open("https://celoscan.io", "_blank")}
                >
                  View on CeloScan
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <SaveMoneyModal
        isOpen={activeModal === "save"}
        onClose={() => setActiveModal(null)}
        onSave={handleSaveMoney}
        userBalances={userBalances}
        tokenInfos={tokenInfos}
        loading={loading}
      />

      <BorrowMoneyModal
        isOpen={activeModal === "borrow"}
        onClose={() => setActiveModal(null)}
        onBorrow={handleBorrowMoney}
        onDepositCollateral={handleDepositCollateral}
        userBalances={userBalances}
        userCollaterals={userCollaterals}
        tokenInfos={tokenInfos}
        loading={loading}
      />

      <PayBackModal
        isOpen={activeModal === "payback"}
        onClose={() => setActiveModal(null)}
        onPayBack={handlePayBack}
        tokenInfos={tokenInfos}
        loading={loading}
      />

      <WithdrawModal
        isOpen={activeModal === "withdraw"}
        onClose={() => setActiveModal(null)}
        onWithdraw={handleWithdraw}
        userDeposits={userDeposits}
        depositLockEnds={depositLockEnds}
        tokenInfos={tokenInfos}
        loading={loading}
      />

      <TransactionModal
        isOpen={transactionModal.isOpen}
        onClose={() =>
          setTransactionModal({ ...transactionModal, isOpen: false })
        }
        type={transactionModal.type}
        message={transactionModal.message}
        txHash={transactionModal.txHash}
      />
    </div>
  );
}
