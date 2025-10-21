"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { useMiniApp } from "@/hooks/useMiniApp";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  WifiOff,
  Shield,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
// import FooterNavigation from "@/components/Footer"
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { ConnectWallet } from "@/components/ConnectWallet";

import { getContract, prepareContractCall, waitForReceipt } from "thirdweb";
import { allowance, approve } from "thirdweb/extensions/erc20";
import { getWalletBalance } from "thirdweb/wallets";
import { client } from "@/lib/thirdweb/client";
import { parseUnits } from "viem";
import { isDataSaverEnabled, enableDataSaver } from "@/lib/serviceWorker";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataAwareRender } from "@/components/ui/loading-indicator";
import { Logo } from "@/components/Logo";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// thirdweb handles transaction modals; no custom tx modal
import { SaveMoneyModal } from "@/components/SaveMoneyModal";
import { BorrowMoneyModal } from "@/components/BorrowMoneyModal";
import { PayBackModal } from "@/components/PayBackModal";
import { FundsWithdrawalModal } from "@/components/FundsWithdrawalModal";
import { useChain } from "@/components/ChainProvider";
import { ChainDebug } from "@/components/ChainDebug";
import {
  getTransactionUrl,
  getTokens,
  getTokenInfo as getChainTokenInfo,
} from "@/config/chainConfig";

// Types
interface ActionCard {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
}

interface TokenInfo {
  symbol: string;
  decimals: number;
}

// Action Cards Grid Component
const ActionCardsGrid = ({
  actionCards,
  onCardClick,
}: {
  actionCards: ActionCard[];
  onCardClick: (id: string) => void;
}) => {
  const renderCard = useCallback(
    (card: ActionCard) => {
      const IconComponent = card.icon;
      const handleClick = () => onCardClick(card.id);

      return (
        <Card
          key={card.id}
          className="group cursor-pointer border border-[#2e4328] shadow-md sm:shadow-lg hover:shadow-xl sm:hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 sm:hover:-translate-y-2 bg-[#21301c]/80 backdrop-blur-sm overflow-hidden"
          onClick={handleClick}
        >
          <CardContent className="p-3 sm:p-6 text-center relative">
            <div
              className={`w-10 h-10 sm:w-16 sm:h-16 ${card.color} rounded-lg sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-4 group-hover:scale-110 transition-transform duration-300`}
            >
              <IconComponent
                className={`w-5 h-5 sm:w-8 sm:h-8 ${card.iconColor}`}
              />
            </div>
            <h3 className="text-sm sm:text-lg font-semibold text-white mb-0.5 sm:mb-2">
              {card.title}
            </h3>
            <p className="text-xs sm:text-sm text-[#a2c398] line-clamp-2">
              {card.description}
            </p>
            <div className="absolute inset-0 bg-gradient-to-t from-[#54d22d]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
          </CardContent>
        </Card>
      );
    },
    [onCardClick]
  );

  return (
    <DataAwareRender
      lowBandwidthFallback={
        <div className="grid grid-cols-2 gap-3 max-w-4xl mx-auto px-2 sm:px-0">
          {actionCards.map(renderCard)}
        </div>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto px-2 sm:px-0">
        {actionCards.map(renderCard)}
      </div>
    </DataAwareRender>
  );
};

export default function AppPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const account = useActiveAccount();
  const address = account?.address;
  const isConnected = !!account;
  const { mutateAsync: sendTransaction } = useSendTransaction({
    payModal: false,
  });
  const { isSDKLoaded, context } = useMiniApp();
  const { chain, tokens, tokenInfos } = useChain();

  // Validate chain configuration
  const chainConfigValid = useMemo(() => {
    return (
      chain && tokens && tokens.length > 0 && tokenInfos
    );
  }, [chain, tokens, tokenInfos]);

  // Contract functions (no longer needed with direct sendTransaction)
  // const borrowFn = useBorrow();
  // const depositFn = useDeposit();
  // const depositCollateralFn = useDepositCollateral();
  // const repayFn = useRepay();
  // const withdrawFn = useWithdraw();

  // All supported token addresses for the active chain from config
  const allTokenAddresses = useMemo(
    () => tokens.map((t) => t.address),
    [tokens]
  );

  // Use all tokens from chain config
  const allTokens = allTokenAddresses;

  // Get actual wallet balances from ERC20 contracts
  const [walletBalances, setWalletBalances] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    const fetchWalletBalances = async () => {
      if (!address || !isConnected) return;

      const balances: Record<string, string> = {};

      for (const token of allTokens) {
        if (!token) continue;
        try {
          // Check if this token is the native wrapped token for this chain
          const tokenInfo = tokens.find(
            (t) => t.address.toLowerCase() === token.toLowerCase()
          );
          // Check if this is a native wrapped token (WETH, WCELO, etc.)
          const isNativeWrapped =
            tokenInfo &&
            tokenInfo.symbol.toUpperCase().startsWith("W") &&
            (tokenInfo.symbol.toUpperCase().includes("ETH") ||
              tokenInfo.symbol.toUpperCase().includes("CELO"));

          if (isNativeWrapped) {
            const native = await getWalletBalance({
              client,
              chain: chain,
              address,
            });
            balances[token] = native.value.toString();
          } else {
            const erc20 = await getWalletBalance({
              client,
              chain: chain,
              address,
              tokenAddress: token,
            });
            balances[token] = erc20.value.toString();
          }
        } catch (error: unknown) {
          console.error(`Error fetching balance for ${token}:`, error);
          balances[token] = "0";
        }
      }

      setWalletBalances(balances);
    };

    fetchWalletBalances();
  }, [address, isConnected, allTokens, chain, tokens, client]);



  // Use wallet balances for SaveMoneyModal
  const userBalances = walletBalances;

  const userBorrows = useMemo(() => {
    const borrows: Record<string, string> = {};
    allTokens.forEach(token => { borrows[token] = "0"; });
    return borrows;
  }, [allTokens]);

  const userCollaterals = useMemo(() => {
    const collaterals: Record<string, string> = {};
    allTokens.forEach(token => { collaterals[token] = "0"; });
    return collaterals;
  }, [allTokens]);

  const userDeposits = useMemo(() => {
    const deposits: Record<string, string> = {};
    allTokens.forEach(token => { deposits[token] = "0"; });
    return deposits;
  }, [allTokens]);

  const depositLockEnds = useMemo(() => {
    const lockEnds: Record<string, number> = {};
    allTokens.forEach(token => { lockEnds[token] = 0; });
    return lockEnds;
  }, [allTokens]);

  // Token info from chain context

  const [activeModal, setActiveModal] = useState<string | null>(null);
  // removed custom tx modal state
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationSkipped, setVerificationSkipped] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [dataSaverEnabled, setDataSaverEnabled] = useState(false);

  const loading = false;

  // Check localStorage for verification skip state
  useEffect(() => {
    const skipped = localStorage.getItem("verification-skipped") === "true";
    setVerificationSkipped(skipped);
  }, []);

  // Make verification completely optional
  useEffect(() => {
    if (sessionStatus === "loading") return;
    // Only show verification prompt if user is connected and hasn't skipped it
    setNeedsVerification(false); // Disable verification prompts for better UX
  }, [isConnected, session, sessionStatus, verificationSkipped]);

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

  const getTokenInfo = useCallback(
    (tokenAddress: string): TokenInfo => {
      // Use chain config token info with proper fallback
      const info = tokenInfos[tokenAddress];
      if (info) {
        return { symbol: info.symbol, decimals: info.decimals };
      }

      // Try to find token by address in the chain config tokens array
      const token = tokens.find(
        (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
      );

      if (token) {
        return { symbol: token.symbol, decimals: token.decimals };
      }

      // Log when token is not found in chain config (for debugging)
      console.warn(
        `[getTokenInfo] Token ${tokenAddress} not found in chain config for ${chain.name}. Using fallback.`
      );
      return { symbol: "UNKNOWN", decimals: 18 };
    },
    [tokenInfos, tokens, chain.name]
  );

  const handleSaveMoney = async (
    token: string,
    amount: string,
    lockPeriod: number
  ) => {
    if (!token || !amount || lockPeriod <= 0 || !account?.address) return;

    const tokenInfo = getTokenInfo(token);
    const amountWei = parseUnits(amount, tokenInfo.decimals);

    try {
      console.log(`[SaveMoney] Vault operations not yet implemented for ${tokenInfo.symbol}`);
      // TODO: Implement vault deposit logic
    } catch (error) {
      console.error(`[SaveMoney] Error on ${chain.name}:`, error);
    }
  };

  const handleBorrowMoney = async (
    token: string,
    amount: string,
    collateralToken: string
  ) => {
    if (!token || !amount || !collateralToken || !account?.address) return;

    try {
      const tokenInfo = getTokenInfo(token);
      console.log(`[BorrowMoney] Vault operations not yet implemented for ${tokenInfo.symbol}`);
      // TODO: Implement vault borrow logic
    } catch (error) {
      console.error(`[BorrowMoney] Error on ${chain.name}:`, error);
    }
  };

  const handleDepositCollateral = async (token: string, amount: string) => {
    if (!token || !amount || !account?.address) return;

    const tokenInfo = getTokenInfo(token);
    try {
      console.log(`[DepositCollateral] Vault operations not yet implemented for ${tokenInfo.symbol}`);
      // TODO: Implement vault collateral deposit logic
    } catch (error) {
      console.error(`[DepositCollateral] Error on ${chain.name}:`, error);
    }
  };

  const handlePayBack = async (token: string, amount: string) => {
    if (!token || !amount || !account?.address) return;

    const tokenInfo = getTokenInfo(token);
    try {
      console.log(`[PayBack] Vault operations not yet implemented for ${tokenInfo.symbol}`);
      // TODO: Implement vault repay logic
    } catch (error) {
      console.error(`[PayBack] Error on ${chain.name}:`, error);
    }
  };

  const handleWithdraw = async (token: string, amount: string) => {
    if (!token || !amount || !account?.address) return;

    try {
      const tokenInfo = getTokenInfo(token);
      console.log(`[Withdraw] Vault operations not yet implemented for ${tokenInfo.symbol}`);
      // TODO: Implement vault withdraw logic
    } catch (error) {
      console.error(`[Withdraw] Error on ${chain.name}:`, error);
    }
  };

  const handleCardClick = useCallback(
    (cardId: string) => {
      // Only route "history" to the dashboard
      if (cardId === "history") {
        router.push("/dashboard");
      } else {
        setActiveModal(cardId);
      }
    },
    [router]
  );

  const actionCards = useMemo(
    (): ActionCard[] => [
      {
        id: "save",
        title: "Start Saving",
        description: "From as low as 100KES or 2000NGN",
        icon: TrendingUp,
        color: "bg-[#54d22d]",
        iconColor: "text-[#162013]",
      },
      {
        id: "borrow",
        title: "Borrow Cash",
        description: "using your savings as security",
        icon: ArrowDownLeft,
        color: "bg-[#426039]",
        iconColor: "text-white",
      },
      {
        id: "withdraw",
        title: "Withdraw",
        description: "directly to your mobile money wallet",
        icon: ArrowUpRight,
        color: "bg-[#2e4328]",
        iconColor: "text-white",
      },
      {
        id: "payback",
        title: "Repay Loans",
        description: "directly from your M-Pesa or Airtel Money",
        icon: ArrowUpRight,
        color: "bg-[#21301c]",
        iconColor: "text-white",
      },
    ],
    []
  );

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
    <div className="min-h-screen relative overflow-hidden">
      {/* Safari Background */}
      <div className="fixed inset-0 bg-[url('/african-safari-scene-2005.jpg')] bg-cover bg-center bg-no-repeat">
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70"></div>
      </div>
      {/* Header */}
      <header className="bg-black/60 backdrop-blur-md border-b border-white/10 px-3 py-4 sticky top-0 z-40 relative">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <Link
            href="https://minilend.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-3"
          >
            {/* Container for the logo with relative positioning */}
            <div className="relative flex-shrink-0">
              <img
                src="/new-logo.png"
                alt="Minilend Logo"
                className="absolute-centered-logo"
              />
            </div>
          </Link>

          <div className="flex items-center space-x-3 flex-shrink-0">
            {/* Chain indicator */}
            {/* <div className="hidden sm:flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#54d22d]/20 text-[#54d22d] border border-[#54d22d]/30">
              <div className="w-2 h-2 rounded-full bg-[#54d22d] mr-2"></div>
              {chain.name}
            </div> */}
            <ConnectWallet />
          </div>
        </div>
      </header>

      <style jsx>{`
        .absolute-centered-logo {
          height: 100px; /* Adjust this to your desired size */
          width: auto;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
      `}</style>

      {/* Main Content */}
      <main className="px-3 py-6 sm:px-4 sm:py-8 max-w-6xl mx-auto relative z-10">
        {!isOnline && (
          <div className="bg-red-900/60 border border-red-500/30 text-red-200 rounded-lg p-3 mb-4 text-sm flex items-center backdrop-blur-sm">
            <WifiOff className="w-4 h-4 mr-2" />
            <p>You are currently offline. Some features may be limited.</p>
          </div>
        )}

        {process.env.NODE_ENV === "development" && (
          <div className="mb-4">
            <ChainDebug />
          </div>
        )}

        {isConnected && (
          <div className="text-center mb-6">
            {/* <div className="flex flex-wrap justify-center gap-2">
              {session?.user?.verified ? (
                // <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-500/30 text-green-300 backdrop-blur-sm">
                //   <Shield className="w-4 h-4 mr-1" />
                //   Verified Account
                // </div>
              ) : (
                // <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-600/30 text-yellow-300 backdrop-blur-sm">
                  
                //   <Button
                //   onClick={() => router.push("/self")}
                // >
                //   <Shield className="w-4 h-4 mr-1" />
                //   Unverified Account
                // </Button>
                // </div>
              )}
              {isSDKLoaded && context && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-500/30 text-purple-300 backdrop-blur-sm">
                  🚀 Farcaster Mini App
                </div>
              )}
            </div> */}
          </div>
        )}
        <div className="mb-8">
          <ActionCardsGrid
            actionCards={actionCards}
            onCardClick={handleCardClick}
          />
        </div>
        <div className="bg-black/40 backdrop-blur-md rounded-xl p-4 border border-white/20 shadow-2xl">
          <h3 className="text-lg font-semibold text-white mb-4 text-center">
            Quick Actions
          </h3>
          <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full bg-[#54d22d] border-[#426039] text-[#162013] hover:bg-[#54d22d] hover:text-[#162013] transition-all duration-200 rounded-xl"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* <div className="bg-[#21301c]/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-2x3 mx-auto border border-[#2e4328] shadow-lg">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 text-center">Quick Actions</h3>
              <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="w-full bg-[#54d22d] border-[#426039] text-[#162013] hover:bg-[#54d22d] hover:text-[#162013] transition-all duration-200 rounded-xl"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Dashboard
                  </Button>
                </Link>
              </div>
            </div> */}

        {/* <FooterNavigation currentPath="/" /> */}
      </main>

      {/* Modals - Always available for exploration */}
      <SaveMoneyModal
        isOpen={activeModal === "save"}
        onClose={() => setActiveModal(null)}
        loading={loading}
        requiresAuth={!isConnected}
      />
      <BorrowMoneyModal
        isOpen={activeModal === "borrow"}
        onClose={() => setActiveModal(null)}
        onBorrow={handleBorrowMoney}
        onDepositCollateral={handleDepositCollateral}
        userBalances={userBalances}
        userCollaterals={userCollaterals}
        loading={loading}
        requiresAuth={!isConnected}
      />
      <PayBackModal
        isOpen={activeModal === "payback"}
        onClose={() => setActiveModal(null)}
        onPayBack={handlePayBack}
        loading={loading}
        userBalances={userBalances}
        requiresAuth={!isConnected}
      />
      <FundsWithdrawalModal
        isOpen={activeModal === "withdraw"}
        onClose={() => setActiveModal(null)}
        onWithdraw={handleWithdraw}
        userDeposits={userDeposits}
        depositLockEnds={depositLockEnds}
        tokenInfos={tokenInfos}
        loading={loading}
        requiresAuth={!isConnected}
      />
    </div>
  );
}
