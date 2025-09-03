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
import {
  useSupportedStablecoins,
  useSupportedCollateral,
  useUserBorrows,
  useUserCollateral,
  useUserDeposits,
} from "../lib/thirdweb/minilend-contract";
import { getContract, prepareContractCall, waitForReceipt } from "thirdweb";
import { allowance, approve } from "thirdweb/extensions/erc20";
import { getWalletBalance } from "thirdweb/wallets";
import { client } from "@/lib/thirdweb/client";
import { celo } from "thirdweb/chains";
import { parseUnits } from "viem";
import { isDataSaverEnabled, enableDataSaver } from "@/lib/serviceWorker";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataAwareRender } from "@/components/ui/loading-indicator";
import { Logo } from "@/components/Logo";

// thirdweb handles transaction modals; no custom tx modal
import { SaveMoneyModal } from "@/components/SaveMoneyModal";
import { BorrowMoneyModal } from "@/components/BorrowMoneyModal";
import { PayBackModal } from "@/components/PayBackModal";
import { FundsWithdrawalModal } from "@/components/FundsWithdrawalModal";

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

  // Get contract instance
  const contract = getContract({
    client,
    chain: celo,
    address: MINILEND_ADDRESS,
  });

  // Contract functions (no longer needed with direct sendTransaction)
  // const borrowFn = useBorrow();
  // const depositFn = useDeposit();
  // const depositCollateralFn = useDepositCollateral();
  // const repayFn = useRepay();
  // const withdrawFn = useWithdraw();

  // Supported stablecoins from deployment config
  const ALL_SUPPORTED_TOKENS = [
    "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", // cKES
    // "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", // cREAL
    // "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08", // eXOF
    // "0x8A567e2aE79CA692Bd748aB832081C45de4041eA", // cCOP
    // "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313", // cGHS
    // "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B", // PUSO
    "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
    // "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
    "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
    "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
    // "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3", // USDGLO
    "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71", // cNGN
    "0x471EcE3750Da237f93B8E339c536989b8978a438", // CELO (GoldToken)
  ];

  const FALLBACK_STABLECOINS = useMemo(
    () => ALL_SUPPORTED_TOKENS.slice(0, 4),
    []
  );

  // Valid collateral assets from deployment config
  const FALLBACK_COLLATERAL = useMemo(
    () => [
      "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
      "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
      "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
      "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
      // "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3", // USDGLO
    ],
    []
  );

  // Read supported tokens from contract (first few indices)
  const stablecoin0 = useSupportedStablecoins(contract, BigInt(0));
  const stablecoin1 = useSupportedStablecoins(contract, BigInt(1));
  const stablecoin2 = useSupportedStablecoins(contract, BigInt(2));
  const collateral0 = useSupportedCollateral(contract, BigInt(0));
  const collateral1 = useSupportedCollateral(contract, BigInt(1));

  // Get supported tokens with fallback
  const supportedStablecoins = useMemo(() => {
    const tokens = [
      stablecoin0.data,
      stablecoin1.data,
      stablecoin2.data,
    ].filter(
      (token) => token && token !== "0x0000000000000000000000000000000000000000"
    );
    return tokens.length > 0 ? tokens : FALLBACK_STABLECOINS;
  }, [
    stablecoin0.data,
    stablecoin1.data,
    stablecoin2.data,
    FALLBACK_STABLECOINS,
  ]);

  const supportedCollateral = useMemo(() => {
    const tokens = [collateral0.data, collateral1.data].filter(
      (token) => token && token !== "0x0000000000000000000000000000000000000000"
    );
    return tokens.length > 0 ? tokens : FALLBACK_COLLATERAL;
  }, [collateral0.data, collateral1.data, FALLBACK_COLLATERAL]);

  // All unique tokens
  const allTokens = useMemo(() => {
    return [...new Set([...supportedStablecoins, ...supportedCollateral])];
  }, [supportedStablecoins, supportedCollateral]);

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
          // CELO native balance if token is CELO address; else ERC20 balance
          if (
            token.toLowerCase() === "0x471ece3750da237f93b8e339c536989b8978a438"
          ) {
            const native = await getWalletBalance({
              client,
              chain: celo,
              address,
            });
            balances[token] = native.value.toString();
          } else {
            const erc20 = await getWalletBalance({
              client,
              chain: celo,
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
  }, [address, isConnected, allTokens, client]);

  const userBorrow0 = useUserBorrows(
    contract,
    address || "",
    allTokens[0] || ""
  );
  const userBorrow1 = useUserBorrows(
    contract,
    address || "",
    allTokens[1] || ""
  );
  const userBorrow2 = useUserBorrows(
    contract,
    address || "",
    allTokens[2] || ""
  );

  const userCollateral0 = useUserCollateral(
    contract,
    address || "",
    allTokens[0] || ""
  );
  const userCollateral1 = useUserCollateral(
    contract,
    address || "",
    allTokens[1] || ""
  );
  const userCollateral2 = useUserCollateral(
    contract,
    address || "",
    allTokens[2] || ""
  );

  const userDeposit0 = useUserDeposits(
    contract,
    address || "",
    allTokens[0] || "",
    BigInt(0)
  );
  const userDeposit1 = useUserDeposits(
    contract,
    address || "",
    allTokens[1] || "",
    BigInt(0)
  );
  const userDeposit2 = useUserDeposits(
    contract,
    address || "",
    allTokens[2] || "",
    BigInt(0)
  );

  // Use wallet balances for SaveMoneyModal
  const userBalances = walletBalances;

  const userBorrows = useMemo(() => {
    const borrows: Record<string, string> = {};
    if (allTokens[0])
      borrows[allTokens[0]] = userBorrow0.data?.toString() || "0";
    if (allTokens[1])
      borrows[allTokens[1]] = userBorrow1.data?.toString() || "0";
    if (allTokens[2])
      borrows[allTokens[2]] = userBorrow2.data?.toString() || "0";
    return borrows;
  }, [userBorrow0.data, userBorrow1.data, userBorrow2.data, allTokens]);

  const userCollaterals = useMemo(() => {
    const collaterals: Record<string, string> = {};
    if (allTokens[0])
      collaterals[allTokens[0]] = userCollateral0.data?.toString() || "0";
    if (allTokens[1])
      collaterals[allTokens[1]] = userCollateral1.data?.toString() || "0";
    if (allTokens[2])
      collaterals[allTokens[2]] = userCollateral2.data?.toString() || "0";
    return collaterals;
  }, [
    userCollateral0.data,
    userCollateral1.data,
    userCollateral2.data,
    allTokens,
  ]);

  const userDeposits = useMemo(() => {
    const deposits: Record<string, string> = {};
    if (allTokens[0] && userDeposit0.data)
      deposits[allTokens[0]] = userDeposit0.data[0]?.toString() || "0";
    if (allTokens[1] && userDeposit1.data)
      deposits[allTokens[1]] = userDeposit1.data[0]?.toString() || "0";
    if (allTokens[2] && userDeposit2.data)
      deposits[allTokens[2]] = userDeposit2.data[0]?.toString() || "0";
    return deposits;
  }, [userDeposit0.data, userDeposit1.data, userDeposit2.data, allTokens]);

  const depositLockEnds = useMemo(() => {
    const lockEnds: Record<string, number> = {};
    if (allTokens[0] && userDeposit0.data)
      lockEnds[allTokens[0]] = Number(userDeposit0.data[1]) || 0;
    if (allTokens[1] && userDeposit1.data)
      lockEnds[allTokens[1]] = Number(userDeposit1.data[1]) || 0;
    if (allTokens[2] && userDeposit2.data)
      lockEnds[allTokens[2]] = Number(userDeposit2.data[1]) || 0;
    return lockEnds;
  }, [userDeposit0.data, userDeposit1.data, userDeposit2.data, allTokens]);

  // Token info mapping
  const tokenInfos = useMemo((): Record<string, TokenInfo> => {
    const tokenMap: Record<string, TokenInfo> = {
      "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": {
        symbol: "USDC",
        decimals: 6,
      },
      "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": {
        symbol: "USDT",
        decimals: 6,
      },
      "0x765DE816845861e75A25fCA122bb6898B8B1282a": {
        symbol: "cUSD",
        decimals: 18,
      },
      "0x471EcE3750Da237f93B8E339c536989b8978a438": {
        symbol: "CELO",
        decimals: 18,
      },
      "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": {
        symbol: "cKES",
        decimals: 18,
      },
      "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71": {
        symbol: "cNGN",
        decimals: 18,
      },

      // "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": { symbol: "cEUR", decimals: 18 },
      // "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": { symbol: "cREAL", decimals: 18 },
      // "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": { symbol: "eXOF", decimals: 18 },
      // "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": { symbol: "PUSO", decimals: 18 },
      // "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": { symbol: "cCOP", decimals: 18 },
      // "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": { symbol: "cGHS", decimals: 18 },
      // "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": { symbol: "USDGLO", decimals: 18 },
    };
    return tokenMap;
  }, []);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  // removed custom tx modal state
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationSkipped, setVerificationSkipped] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [dataSaverEnabled, setDataSaverEnabled] = useState(false);

  // Check if any critical hooks are loading (only check first few to reduce loading time)
  const loading = useMemo(() => {
    return userBorrow0.isLoading || userDeposit0.isLoading;
  }, [userBorrow0.isLoading, userDeposit0.isLoading]);

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

  const getTokenInfo = (tokenAddress: string): TokenInfo => {
    return tokenInfos[tokenAddress] || { symbol: "UNKNOWN", decimals: 18 };
  };

  const handleSaveMoney = async (
    token: string,
    amount: string,
    lockPeriod: number
  ) => {
    if (!token || !amount || lockPeriod <= 0 || !account?.address) return;

    const tokenInfo = getTokenInfo(token);
    const amountWei = parseUnits(amount, tokenInfo.decimals);

    try {
      // 1. Check allowance
      const tokenContract = getContract({
        client,
        chain: celo,
        address: token,
      });
      const currentAllowance = await allowance({
        contract: tokenContract,
        owner: account.address,
        spender: MINILEND_ADDRESS,
      });

      // 2. Approve if needed and wait for receipt per v5 docs
      if (currentAllowance < amountWei) {
        const approveTx = approve({
          contract: tokenContract,
          spender: MINILEND_ADDRESS,
          amount: amountWei.toString(),
        });
        const result = await sendTransaction(approveTx);
        if (result?.transactionHash) {
          await waitForReceipt({
            client,
            chain: celo,
            transactionHash: result.transactionHash,
          });
        }
      }

      // 3. Deposit
      const depositTx = prepareContractCall({
        contract,
        method:
          "function deposit(address token, uint256 amount, uint256 lockPeriod)",
        params: [token, amountWei, BigInt(lockPeriod)],
      });
      await sendTransaction(depositTx);
    } catch (error) {
      console.error("Save money error:", error);
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
      const amountWei = parseUnits(amount, tokenInfo.decimals);

      const borrowTx = prepareContractCall({
        contract,
        method:
          "function borrow(address token, uint256 amount, address collateralToken)",
        params: [token, amountWei, collateralToken],
      });
      await sendTransaction(borrowTx);
    } catch (error) {
      console.error("Borrow money error:", error);
    }
  };

  const handleDepositCollateral = async (token: string, amount: string) => {
    if (!token || !amount || !account?.address) return;

    const tokenInfo = getTokenInfo(token);
    const amountWei = parseUnits(amount, tokenInfo.decimals);

    try {
      const tokenContract = getContract({
        client,
        chain: celo,
        address: token,
      });
      const currentAllowance = await allowance({
        contract: tokenContract,
        owner: account.address,
        spender: MINILEND_ADDRESS,
      });

      if (currentAllowance < amountWei) {
        const approveTx = approve({
          contract: tokenContract,
          spender: MINILEND_ADDRESS,
          amount: amountWei.toString(),
        });
        await sendTransaction(approveTx);
      }

      const depositTx = prepareContractCall({
        contract,
        method: "function depositCollateral(address token, uint256 amount)",
        params: [token, amountWei],
      });
      await sendTransaction(depositTx);
    } catch (error) {
      console.error("Deposit collateral error:", error);
    }
  };

  const handlePayBack = async (token: string, amount: string) => {
    if (!token || !amount || !account?.address) return;

    const tokenInfo = getTokenInfo(token);
    const amountWei = parseUnits(amount, tokenInfo.decimals);

    try {
      const tokenContract = getContract({
        client,
        chain: celo,
        address: token,
      });
      const currentAllowance = await allowance({
        contract: tokenContract,
        owner: account.address,
        spender: MINILEND_ADDRESS,
      });

      if (currentAllowance < amountWei) {
        const approveTx = approve({
          contract: tokenContract,
          spender: MINILEND_ADDRESS,
          amount: amountWei.toString(),
        });
        await sendTransaction(approveTx);
      }

      const repayTx = prepareContractCall({
        contract,
        method: "function repay(address token, uint256 amount)",
        params: [token, amountWei],
      });
      await sendTransaction(repayTx);
    } catch (error) {
      console.error("Pay back error:", error);
    }
  };

  const handleWithdraw = async (token: string, amount: string) => {
    if (!token || !amount || !account?.address) return;

    try {
      const tokenInfo = getTokenInfo(token);
      const amountWei = parseUnits(amount, tokenInfo.decimals);

      const withdrawTx = prepareContractCall({
        contract,
        method: "function withdraw(address token, uint256 amount)",
        params: [token, amountWei],
      });
      await sendTransaction(withdrawTx);
    } catch (error) {
      console.error("Withdraw error:", error);
    }
  };

  const handleCardClick = useCallback(
    (cardId: string) => {
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

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Safari Background */}
      <div className="fixed inset-0 bg-[url('/african-safari-scene-2005.jpg')] bg-cover bg-center bg-no-repeat">
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70"></div>
      </div>
      {/* Header */}
      <header className="bg-black/60 backdrop-blur-md border-b border-white/10 px-3 py-4 sticky top-0 z-40 relative">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/landing" className="flex items-center space-x-3">
            <div>
              <Logo size="md" />
              <p className="text-xs sm:text-sm text-[#a2c398]">
                Grow Your Money
              </p>
            </div>
          </Link>

          <div className="flex-shrink-0">
            <ConnectWallet size="sm" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-3 py-6 sm:px-4 sm:py-8 max-w-6xl mx-auto relative z-10">
        {!isOnline && (
          <div className="bg-red-900/60 border border-red-500/30 text-red-200 rounded-lg p-3 mb-4 text-sm flex items-center backdrop-blur-sm">
            <WifiOff className="w-4 h-4 mr-2" />
            <p>You are currently offline. Some features may be limited.</p>
          </div>
        )}

        {isConnected && (
          <div className="text-center mb-6">
            <div className="flex flex-wrap justify-center gap-2">
              {session?.user?.verified ? (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-500/30 text-green-300 backdrop-blur-sm">
                  <Shield className="w-4 h-4 mr-1" />
                  Verified Account
                </div>
              ) : (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-600/30 text-yellow-300 backdrop-blur-sm">
                  <Shield className="w-4 h-4 mr-1" />
                  Unverified Account
                </div>
              )}
              {isSDKLoaded && context && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-500/30 text-purple-300 backdrop-blur-sm">
                  🚀 Farcaster Mini App
                </div>
              )}
            </div>
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
        tokenInfos={tokenInfos}
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
        tokenInfos={tokenInfos}
        loading={loading}
        requiresAuth={!isConnected}
      />
      <PayBackModal
        isOpen={activeModal === "payback"}
        onClose={() => setActiveModal(null)}
        onPayBack={handlePayBack}
        tokenInfos={tokenInfos}
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
