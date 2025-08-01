"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import {
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  WifiOff,
  Shield,
} from "lucide-react";
// Keep v5 imports and replace the v4 ones
import { ConnectButton, useActiveWallet, useDisconnect } from "thirdweb/react";
import { getContract } from "thirdweb";
import { useReadContract, useSendTransaction } from "thirdweb/react";

import { client } from "@/lib/thirdweb/client";
import { MINILEND_ABI, MINILEND_ADDRESS, ORACLE_ADDRESS } from "@/lib/contract";
import { formatAddress } from "@/lib/utils";
import { isDataSaverEnabled, enableDataSaver } from "@/lib/serviceWorker";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LoadingIndicator,
  DataAwareRender,
} from "@/components/ui/loading-indicator";

import { TransactionModal } from "@/components/TransactionModal";
import { SaveMoneyModal } from "@/components/SaveMoneyModal";
import { BorrowMoneyModal } from "@/components/BorrowMoneyModal";
import { PayBackModal } from "@/components/PayBackModal";
import { WithdrawModal } from "@/components/WithdrawModal";

export default function HomePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const wallet = useActiveWallet();
  const disconnect = useDisconnect();
  const address = wallet?.address;
  const isConnected = !!wallet;

  const { contract } = useContract({
    client,
    chain: "celo",
    address: MINILEND_ADDRES,
    abi: MINILEND_ABI,
  });

  const { mutateAsync: deposit } = useContractWrite(contract, "deposit");
  const { mutateAsync: depositCollateral } = useContractWrite(
    contract,
    "depositCollateral"
  );
  const { mutateAsync: borrow } = useContractWrite(contract, "borrow");
  const { mutateAsync: repay } = useContractWrite(contract, "repay");
  const { mutateAsync: withdraw } = useContractWrite(contract, "withdraw");

  const { data: supportedStablecoins } = useContractRead(
    contract,
    "getSupportedStablecoins"
  );
  const { data: supportedCollateral } = useContractRead(
    contract,
    "getSupportedCollateral"
  );

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [transactionModal, setTransactionModal] = useState({
    isOpen: false,
    type: "success" as "success" | "error" | "pending",
    message: "",
    txHash: undefined as string | undefined,
  });
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [dataSaverEnabled, setDataSaverEnabled] = useState(false);

  useEffect(() => {
    if (isConnected && address && !session?.user?.address) {
      signIn("self-protocol", {
        address,
        verificationData: "",
        redirect: false,
      });
    }
  }, [isConnected, address, session]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (isConnected && !session?.user?.verified) {
      setNeedsVerification(true);
    } else {
      setNeedsVerification(false);
    }
  }, [isConnected, session, sessionStatus]);

  useEffect(() => {
    if (needsVerification && isConnected) {
      const timer = setTimeout(() => {
        router.push("/self");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [needsVerification, isConnected, router]);

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

  useEffect(() => {
    setDataSaverEnabled(isDataSaverEnabled());
  }, []);

  const toggleDataSaver = () => {
    const newState = !dataSaverEnabled;
    setDataSaverEnabled(newState);
    enableDataSaver(newState);
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
              <img
                src="/minilend-logo.png"
                alt="Minilend Logo"
                className="w-10 h-10 object-contain"
              />
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

          <div className="w-full sm:w-auto sm:text-right">
            {!isConnected ? (
              <ConnectButton
                client={client}
                chain="celo"
                className="w-full sm:w-auto bg-primary hover:bg-secondary text-white px-4 py-2 rounded-xl min-h-[48px] shadow-lg hover:shadow-xl transition-all duration-200"
              />
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-3 py-6 sm:px-4 sm:py-8 max-w-6xl mx-auto">
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleDataSaver}
            className="flex items-center text-xs sm:text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md"
          >
            <WifiOff className="w-3 h-3 mr-1" />
            Data Saver: {dataSaverEnabled ? "ON" : "OFF"}
          </button>
        </div>

        {!isOnline && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 mb-4 text-sm flex items-center">
            <WifiOff className="w-4 h-4 mr-2" />
            <p>You are currently offline. Some features may be limited.</p>
          </div>
        )}

        {needsVerification && isConnected && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 mb-4 text-sm flex items-center">
            <Shield className="w-4 h-4 mr-2" />
            <p>
              Identity verification required. Redirecting to verification
              page...
            </p>
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
                <ConnectButton
                  client={client}
                  chain="celo"
                  className="bg-primary hover:bg-secondary text-white w-full min-h-[48px] rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                />
                {typeof window !== "undefined" && !window.ethereum && (
                  <p className="text-gray-500 text-xs sm:text-sm mt-4">
                    Don&apos;t have a wallet?{" "}
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
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
                Welcome to MiniLend
              </h2>
              <p className="text-gray-600 text-base sm:text-lg">
                Choose an action to get started
              </p>
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
                        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </DataAwareRender>
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
