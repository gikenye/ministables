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
  Star,
  Users,
  DollarSign,
  Lock,
  Zap,
  Globe,
  CheckCircle,
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

// Hero Section Component
const HeroSection = () => {
  return (
    <div className="text-center mb-12 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 animate-slide-up">
          Grow Your Money with
          <span className="text-[#54d22d] block mt-2">Minilend</span>
        </h1>
        <p className="text-lg sm:text-xl text-[#a2c398] max-w-2xl mx-auto leading-relaxed animate-slide-up-delay">
          The first decentralized lending protocol on Celo that lets you save, borrow, and earn with complete compliance and security.
        </p>
      </div>
      
      <div className="flex flex-wrap justify-center gap-4 mb-8 animate-slide-up-delay-2">
        <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
          <Shield className="w-5 h-5 text-[#54d22d] mr-2" />
          <span className="text-white text-sm font-medium">zkSelf Verified</span>
        </div>
        <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
          <Lock className="w-5 h-5 text-[#54d22d] mr-2" />
          <span className="text-white text-sm font-medium">Secure & Compliant</span>
        </div>
        <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
          <Globe className="w-5 h-5 text-[#54d22d] mr-2" />
          <span className="text-white text-sm font-medium">Multi-Currency</span>
        </div>
      </div>
    </div>
  );
};

// Features Showcase Component
const FeaturesShowcase = () => {
  const features = [
    {
      icon: DollarSign,
      title: "Multi-Stablecoin Support",
      description: "Save and borrow in USDC, cUSD, cKES, cNGN and more",
    },
    {
      icon: Shield,
      title: "Compliance First",
      description: "zkSelf integration ensures regulatory compliance",
    },
    {
      icon: Zap,
      title: "Instant Transactions",
      description: "Fast and low-cost transactions on Celo network",
    },
    {
      icon: TrendingUp,
      title: "Competitive Rates",
      description: "Earn attractive interest on your savings",
    },
  ];

  return (
    <div className="mb-12">
      <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-8 animate-fade-in">
        Why Choose Minilend?
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, index) => {
          const IconComponent = feature.icon;
          return (
            <div
              key={feature.title}
              className={`bg-black/40 backdrop-blur-md rounded-xl p-6 border border-white/20 text-center hover:border-[#54d22d]/50 transition-all duration-300 hover:-translate-y-2 animate-slide-up`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 bg-[#54d22d] rounded-lg flex items-center justify-center mx-auto mb-4">
                <IconComponent className="w-6 h-6 text-[#162013]" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-[#a2c398]">{feature.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Stats Component
const StatsSection = () => {
  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-white/20 mb-12 animate-fade-in hover-glow">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        <div className="animate-pulse-slow hover-lift">
          <div className="text-2xl sm:text-3xl font-bold text-[#54d22d] mb-2">$1M+</div>
          <div className="text-sm text-[#a2c398]">Total Value Locked</div>
        </div>
        <div className="animate-pulse-slow hover-lift" style={{ animationDelay: '0.2s' }}>
          <div className="text-2xl sm:text-3xl font-bold text-[#54d22d] mb-2">500+</div>
          <div className="text-sm text-[#a2c398]">Active Users</div>
        </div>
        <div className="animate-pulse-slow hover-lift" style={{ animationDelay: '0.4s' }}>
          <div className="text-2xl sm:text-3xl font-bold text-[#54d22d] mb-2">7</div>
          <div className="text-sm text-[#a2c398]">Supported Currencies</div>
        </div>
      </div>
    </div>
  );
};

// Testimonials Component
const TestimonialsSection = () => {
  const testimonials = [
    {
      name: "Sarah K.",
      location: "Nairobi, Kenya",
      text: "Minilend helped me save for my business while earning great returns. The mobile money integration is seamless!",
      rating: 5,
    },
    {
      name: "David O.",
      location: "Lagos, Nigeria",
      text: "Finally, a DeFi platform that understands African markets. The compliance features give me peace of mind.",
      rating: 5,
    },
    {
      name: "Amina M.",
      location: "Accra, Ghana",
      text: "I've been earning 12% APY on my savings. Much better than traditional banks!",
      rating: 5,
    },
  ];

  return (
    <div className="mb-12">
      <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-8 animate-fade-in">
        Trusted by Thousands Across Africa
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((testimonial, index) => (
          <div
            key={testimonial.name}
            className={`bg-black/40 backdrop-blur-md rounded-xl p-6 border border-white/20 hover-lift animate-slide-up`}
            style={{ animationDelay: `${index * 0.2}s` }}
          >
            <div className="flex mb-4">
              {[...Array(testimonial.rating)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-[#54d22d] fill-current" />
              ))}
            </div>
            <p className="text-[#a2c398] mb-4 italic">"{testimonial.text}"</p>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-[#54d22d] to-[#426039] rounded-full flex items-center justify-center mr-3">
                <span className="text-[#162013] font-bold text-sm">
                  {testimonial.name.charAt(0)}
                </span>
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{testimonial.name}</div>
                <div className="text-[#a2c398] text-xs">{testimonial.location}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Action Cards Grid Component
const ActionCardsGrid = ({
  actionCards,
  onCardClick,
}: {
  actionCards: ActionCard[];
  onCardClick: (id: string) => void;
}) => {
  const renderCard = useCallback(
    (card: ActionCard, index: number) => {
      const IconComponent = card.icon;
      const handleClick = () => onCardClick(card.id);

      return (
        <Card
          key={card.id}
          className={`group cursor-pointer border border-[#2e4328] shadow-md sm:shadow-lg hover:shadow-xl sm:hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 hover:scale-105 bg-[#21301c]/80 backdrop-blur-sm overflow-hidden animate-slide-up`}
          style={{ animationDelay: `${index * 0.1}s` }}
          onClick={handleClick}
        >
          <CardContent className="p-4 sm:p-6 text-center relative">
            <div
              className={`w-12 h-12 sm:w-16 sm:h-16 ${card.color} rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}
            >
              <IconComponent
                className={`w-6 h-6 sm:w-8 sm:h-8 ${card.iconColor}`}
              />
            </div>
            <h3 className="text-sm sm:text-lg font-semibold text-white mb-1 sm:mb-2 group-hover:text-[#54d22d] transition-colors duration-300">
              {card.title}
            </h3>
            <p className="text-xs sm:text-sm text-[#a2c398] line-clamp-2 group-hover:text-white transition-colors duration-300">
              {card.description}
            </p>
            <div className="absolute inset-0 bg-gradient-to-t from-[#54d22d]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
            <div className="absolute top-2 right-2 w-2 h-2 bg-[#54d22d] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-ping" />
          </CardContent>
        </Card>
      );
    },
    [onCardClick]
  );

  return (
    <div className="mb-12">
      <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-8 animate-fade-in">
        Start Your Financial Journey
      </h2>
      <DataAwareRender
        lowBandwidthFallback={
          <div className="grid grid-cols-2 gap-3 max-w-4xl mx-auto px-2 sm:px-0">
            {actionCards.map((card, index) => renderCard(card, index))}
          </div>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto px-2 sm:px-0">
          {actionCards.map((card, index) => renderCard(card, index))}
        </div>
      </DataAwareRender>
    </div>
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
        description: "Earn up to 12% APY on your stablecoins",
        icon: TrendingUp,
        color: "bg-gradient-to-br from-[#54d22d] to-[#4bc428]",
        iconColor: "text-[#162013]",
      },
      {
        id: "borrow",
        title: "Borrow Instantly",
        description: "Get loans using your crypto as collateral",
        icon: ArrowDownLeft,
        color: "bg-gradient-to-br from-[#426039] to-[#54d22d]",
        iconColor: "text-white",
      },
      {
        id: "withdraw",
        title: "Withdraw Anytime",
        description: "Access your funds when you need them",
        icon: ArrowUpRight,
        color: "bg-gradient-to-br from-[#2e4328] to-[#426039]",
        iconColor: "text-white",
      },
      {
        id: "payback",
        title: "Repay Easily",
        description: "Flexible repayment options available",
        icon: CheckCircle,
        color: "bg-gradient-to-br from-[#21301c] to-[#2e4328]",
        iconColor: "text-white",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Responsive Background */}
      <div className="fixed inset-0">
        {/* Mobile background - solid gradient */}
        <div className="sm:hidden absolute inset-0 bg-gradient-to-br from-[#162013] via-[#21301c] to-[#2e4328]"></div>
        {/* Desktop background - image with better positioning */}
        <div className="hidden sm:block absolute inset-0 bg-[url('/african-safari-scene-2005.jpg')] bg-cover bg-center bg-no-repeat sm:bg-top lg:bg-center"></div>
        {/* Overlay for all screens */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70"></div>
        {/* Animated overlay particles */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-[#54d22d] rounded-full animate-float"></div>
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-[#54d22d] rounded-full animate-float" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-[#54d22d] rounded-full animate-float" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-[#54d22d] rounded-full animate-float" style={{animationDelay: '0.5s'}}></div>
        </div>
      </div>
      {/* Header */}
      <header className="bg-black/60 backdrop-blur-md border-b border-white/10 px-3 py-4 sticky top-0 z-40 relative animate-slide-up">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <Link href="/landing" className="flex items-center space-x-3 group hover-lift">
            <div className="transition-all duration-300 group-hover:scale-105">
              <Logo size="md" />
              <p className="text-xs sm:text-sm text-[#a2c398] group-hover:text-[#54d22d] transition-colors duration-300">
                Grow Your Money
              </p>
            </div>
          </Link>

          <div className="flex items-center space-x-4">
            {!isConnected && (
              <div className="hidden sm:flex items-center space-x-2 text-sm text-[#a2c398]">
                <div className="w-2 h-2 bg-[#54d22d] rounded-full animate-pulse"></div>
                <span>Connect to start earning</span>
              </div>
            )}
            <div className="flex-shrink-0">
              <ConnectWallet size="sm" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-3 py-6 sm:px-4 sm:py-8 max-w-6xl mx-auto relative z-10 pb-16">
        {!isOnline && (
          <div className="bg-red-900/60 border border-red-500/30 text-red-200 rounded-lg p-3 mb-4 text-sm flex items-center backdrop-blur-sm">
            <WifiOff className="w-4 h-4 mr-2" />
            <p>You are currently offline. Some features may be limited.</p>
          </div>
        )}

        {/* Hero Section */}
        <HeroSection />
        
        {/* User Status */}
        {isConnected && (
          <div className="text-center mb-8 animate-fade-in">
            <div className="flex flex-wrap justify-center gap-2">
              {session?.user?.verified ? (
                <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-500/30 text-green-300 backdrop-blur-sm border border-green-500/30 animate-pulse-slow">
                  <Shield className="w-4 h-4 mr-2" />
                  Verified Account
                </div>
              ) : (
                <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-yellow-600/30 text-yellow-300 backdrop-blur-sm border border-yellow-600/30">
                  <Shield className="w-4 h-4 mr-2" />
                  Unverified Account
                </div>
              )}
              {isSDKLoaded && context && (
                <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-purple-500/30 text-purple-300 backdrop-blur-sm border border-purple-500/30">
                  🚀 Farcaster Mini App
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Stats Section */}
        <StatsSection />
        
        {/* Features Showcase */}
        <FeaturesShowcase />
        
        {/* Testimonials */}
        <TestimonialsSection />
        
        {/* Action Cards */}
        <ActionCardsGrid
          actionCards={actionCards}
          onCardClick={handleCardClick}
        />
        
        {/* Call to Action */}
        <div className="bg-gradient-to-r from-[#54d22d]/20 to-[#426039]/20 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-[#54d22d]/30 shadow-2xl animate-fade-in">
          <div className="text-center">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4">
              Ready to Start Your DeFi Journey?
            </h3>
            <p className="text-[#a2c398] mb-6 max-w-2xl mx-auto">
              Join thousands of users who trust Minilend for their decentralized finance needs. 
              Start saving, borrowing, and earning today.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button
                  className="w-full bg-[#54d22d] hover:bg-[#4bc428] text-[#162013] font-semibold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
                >
                  <BarChart3 className="w-5 h-5 mr-2" />
                  View Dashboard
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full sm:w-auto border-[#54d22d] text-[#54d22d] hover:bg-[#54d22d] hover:text-[#162013] py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105"
                onClick={() => setActiveModal('save')}
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                Start Saving Now
              </Button>
            </div>
          </div>
        </div>
        
        {/* Footer Section */}
        <footer className="mt-16 pt-12 border-t border-white/10 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <Logo size="sm" />
                <span className="text-white font-bold text-lg">Minilend</span>
              </div>
              <p className="text-[#a2c398] mb-4 max-w-md">
                The first decentralized lending protocol on Celo, enabling compliant 
                DeFi for African markets with zkSelf integration.
              </p>
              <div className="flex space-x-4">
                <div className="flex items-center text-sm text-[#a2c398]">
                  <Shield className="w-4 h-4 mr-2 text-[#54d22d]" />
                  Audited & Secure
                </div>
                <div className="flex items-center text-sm text-[#a2c398]">
                  <Globe className="w-4 h-4 mr-2 text-[#54d22d]" />
                  Built on Celo
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Protocol</h4>
              <ul className="space-y-2 text-sm text-[#a2c398]">
                <li><Link href="/dashboard" className="hover:text-[#54d22d] transition-colors">Dashboard</Link></li>
                <li><Link href="#" className="hover:text-[#54d22d] transition-colors">Documentation</Link></li>
                <li><Link href="#" className="hover:text-[#54d22d] transition-colors">Governance</Link></li>
                <li><Link href="#" className="hover:text-[#54d22d] transition-colors">Security</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-[#a2c398]">
                <li><Link href="#" className="hover:text-[#54d22d] transition-colors">Discord</Link></li>
                <li><Link href="#" className="hover:text-[#54d22d] transition-colors">Twitter</Link></li>
                <li><Link href="#" className="hover:text-[#54d22d] transition-colors">Telegram</Link></li>
                <li><Link href="#" className="hover:text-[#54d22d] transition-colors">GitHub</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center">
            <div className="text-sm text-[#a2c398] mb-4 sm:mb-0">
              © 2024 Minilend. All rights reserved.
            </div>
            <div className="flex space-x-6 text-sm text-[#a2c398]">
              <Link href="#" className="hover:text-[#54d22d] transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-[#54d22d] transition-colors">Terms of Service</Link>
              <Link href="#" className="hover:text-[#54d22d] transition-colors">Risk Disclosure</Link>
            </div>
          </div>
        </footer>
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
