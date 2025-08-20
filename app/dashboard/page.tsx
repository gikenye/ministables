"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, ArrowDownLeft, Shield, ExternalLink } from "lucide-react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatAmount, formatAddress } from "@/lib/utils";
import { extractTransactionError } from "@/lib/utils/errorMapping";
import { FundsWithdrawalModal } from "@/components/WithdrawModal";
import { OracleRatesCard } from "@/components/OracleRatesCard";
import { MINILEND_ADDRESS, thirdwebService } from "@/lib/services/thirdwebService";
import { oracleService } from "@/lib/services/oracleService";
import { useActiveAccount } from "thirdweb/react";
import {
  useWithdraw as useWithdrawContract
} from '@/lib/thirdweb/minilend-contract';
import { getContract, readContract } from "thirdweb";
import { client } from "@/lib/thirdweb/client";
import { celo } from "thirdweb/chains";


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
  "0x471EcE3750Da237f93B8E339c536989b8978a438": { symbol: "CELO", decimals: 18 },
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": { symbol: "cUSD", decimals: 18 },
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": { symbol: "cEUR", decimals: 18 },
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": { symbol: "cREAL", decimals: 18 },
  "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": { symbol: "eXOF", decimals: 18 },
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": { symbol: "cKES", decimals: 18 },
  "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": { symbol: "PUSO", decimals: 18 },
  "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": { symbol: "cCOP", decimals: 18 },
  "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": { symbol: "cGHS", decimals: 18 },
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": { symbol: "USDT", decimals: 6 },
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": { symbol: "USDC", decimals: 6 },
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": { symbol: "USDGLO", decimals: 18 },
  "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71": { symbol: "cNGN", decimals: 18 },
};



import TVLCard from "@/components/TVLCard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkStatus, RateLimitWarning } from "@/components/NetworkStatus";

// Rate limiting utility
const createRateLimiter = (maxRequests: number, windowMs: number) => {
  const requests: number[] = [];
  
  return {
    canMakeRequest: () => {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Remove old requests
      while (requests.length > 0 && requests[0] < windowStart) {
        requests.shift();
      }
      
      return requests.length < maxRequests;
    },
    recordRequest: () => {
      requests.push(Date.now());
    },
    getWaitTime: () => {
      if (requests.length === 0) return 0;
      const oldestRequest = requests[0];
      const windowStart = Date.now() - windowMs;
      return Math.max(0, oldestRequest - windowStart + 100); // Add 100ms buffer
    }
  };
};

const rateLimiter = createRateLimiter(5, 1000); // 5 requests per second

const useDashboardData = (address: string | undefined, contract: any) => {
  const [userData, setUserData] = useState<UserData>({
    deposits: {},
    borrows: {},
    collateral: {},
    lockEnds: {},
  });
  const [poolData, setPoolData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [showRateLimitWarning, setShowRateLimitWarning] = useState(false);

  const makeRateLimitedRequest = async <T>(requestFn: () => Promise<T>): Promise<T> => {
    while (!rateLimiter.canMakeRequest()) {
      const waitTime = rateLimiter.getWaitTime();
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    rateLimiter.recordRequest();
    return await requestFn();
  };

  const loadDashboardData = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const deposits: Record<string, string> = {};
      const borrows: Record<string, string> = {};
      const collateral: Record<string, string> = {};
      const lockEnds: Record<string, number> = {};
      const pools: Record<string, string> = {};
      const rates: Record<string, number> = {};

      // Process only first 3 tokens to reduce requests
      const tokensToProcess = SUPPORTED_STABLECOINS.slice(0, 3);
      
      for (const token of tokensToProcess) {
        try {
          // Add delay between token processing
          if (tokensToProcess.indexOf(token) > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          const contractCalls = await Promise.allSettled([
            makeRateLimitedRequest(() => readContract({
              contract,
              method: "function userDeposits(address, address, uint256) view returns (uint256 amount, uint256 lockEnd)",
              params: [address, token, BigInt(0)],
            })),
            makeRateLimitedRequest(() => readContract({
              contract,
              method: "function userBorrows(address, address) view returns (uint256)",
              params: [address, token],
            })),
            makeRateLimitedRequest(() => readContract({
              contract,
              method: "function userCollateral(address, address) view returns (uint256)",
              params: [address, token],
            }))
          ]);
          
          const userDeposit = contractCalls[0].status === 'fulfilled' ? contractCalls[0].value : [BigInt(0), BigInt(0)];
          const userBorrow = contractCalls[1].status === 'fulfilled' ? contractCalls[1].value : BigInt(0);
          const userCollat = contractCalls[2].status === 'fulfilled' ? contractCalls[2].value : BigInt(0);
          
          deposits[token] = userDeposit[0].toString();
          borrows[token] = userBorrow.toString();
          collateral[token] = userCollat.toString();
          lockEnds[token] = Number(userDeposit[1]);
          pools[token] = "0";
          try {
            const priceUsd = await oracleService.getTokenPrice(token);
            rates[token] = priceUsd;
          } catch {
          rates[token] = 1.0;
          }
        } catch (error: any) {
          const tokenSymbol = TOKEN_INFO[token]?.symbol || 'Unknown';
          console.warn(`Skipping ${tokenSymbol} due to contract error:`, error.code || error.message);
          
          if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
            setShowRateLimitWarning(true);
            setTimeout(() => setShowRateLimitWarning(false), 5000);
            // Wait longer on rate limit
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          deposits[token] = "0";
          borrows[token] = "0";
          collateral[token] = "0";
          lockEnds[token] = 0;
          pools[token] = "0";
          rates[token] = rates[token] ?? 1.0;
        }
      }
      
      // Set default values for remaining tokens
      SUPPORTED_STABLECOINS.slice(3).forEach(token => {
        deposits[token] = "0";
        borrows[token] = "0";
        collateral[token] = "0";
        lockEnds[token] = 0;
        pools[token] = "0";
        if (rates[token] === undefined) rates[token] = 1.0;
      });

      setUserData({ deposits, borrows, collateral, lockEnds });
      setPoolData(pools);
      setExchangeRates(rates);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      // Set empty data on error to prevent UI crashes
      setUserData({
        deposits: {},
        borrows: {},
        collateral: {},
        lockEnds: {},
      });
      setPoolData({});
      setExchangeRates({});
    } finally {
      setLoading(false);
    }
  };

  return { userData, poolData, loading, exchangeRates, loadDashboardData, showRateLimitWarning, setShowRateLimitWarning };
};

export default function DashboardPage() {
  const account = useActiveAccount();
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const address = account?.address;
  const isConnected = !!address;
  
  // Verification state
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationSkipped, setVerificationSkipped] = useState(false);
  
  const contract = getContract({
    client,
    chain: celo,
    address: MINILEND_ADDRESS,
  });

  const withdrawFn = useWithdrawContract();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  
  const { userData, poolData, loading, exchangeRates, loadDashboardData, showRateLimitWarning, setShowRateLimitWarning } = useDashboardData(address, contract);

  useEffect(() => {
    if (isConnected && address) {
      // Add delay before loading to prevent immediate rate limiting
      const timer = setTimeout(() => {
        loadDashboardData();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (isConnected && address && !session?.user?.address) {
      signIn("self-protocol", {
        address,
        verificationData: "",
        redirect: false,
      });
    }
  }, [isConnected, address, session]);

  // Check localStorage for verification skip state
  useEffect(() => {
    const skipped = localStorage.getItem('verification-skipped') === 'true';
    setVerificationSkipped(skipped);
  }, []);

  // Remove forced verification - make it optional
  useEffect(() => {
    if (sessionStatus === "loading") return;
    // Don't show verification if user has skipped it or is already verified
    setNeedsVerification(isConnected && !session?.user?.verified && !verificationSkipped);
  }, [isConnected, session, sessionStatus, verificationSkipped]);



  const getActualWithdrawableAmount = async (token: string): Promise<string> => {
    if (!address) return "0";
    
    try {
      // Use thirdweb getUserBalance function
      const balance = await thirdwebService.getUserBalance(address, token);
      return balance;
    } catch (error) {
      console.error(`Error getting user balance:`, error);
      return "0";
    }
  };

  const handleWithdraw = async (token: string, amount: string): Promise<void> => {
    try {
      // Validate Oracle price before withdrawal
      const isOracleValid = await oracleService.validatePriceData(token);
      if (!isOracleValid) {
        throw new Error("Unable to get current market prices. Please try again in a moment.");
      }
      
      const tokenInfo = TOKEN_INFO[token];
      if (!tokenInfo) throw new Error("Token not supported");
      const amountWei = BigInt(parseFloat(amount) * Math.pow(10, tokenInfo.decimals));
      
      // The contract's withdraw function will automatically calculate withdrawable amount
      // based on unlocked deposits and validate the request
      await withdrawFn(contract, token, amountWei);
      await loadDashboardData();
    } catch (error: any) {
      const errorMessage = extractTransactionError(error);
      console.error("Error withdrawing:", error);
      throw new Error(errorMessage);
    }
  };

  const handleHistoryClick = () => {
    window.open(`https://celoscan.io/address/${address}`, "_blank");
  };

  const convertToUSD = (amount: string, decimals: number): number => {
    if (!amount || amount === "0") return 0;
    return Number(formatAmount(amount, decimals));
  };

  const getTotalSavingsUSD = (): number => {
    return Object.entries(deposits).reduce((acc, [token, amount]) => {
      if (!amount || amount === "0" || !TOKEN_INFO[token]) return acc;
      const info = TOKEN_INFO[token];
      return acc + convertToUSD(amount, info.decimals);
    }, 0);
  };

  const getTotalBorrowsUSD = (): number => {
    return Object.entries(borrows).reduce((acc, [token, amount]) => {
      if (!amount || amount === "0" || !TOKEN_INFO[token]) return acc;
      const info = TOKEN_INFO[token];
      return acc + convertToUSD(amount, info.decimals);
    }, 0);
  };



  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-white border-secondary">
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold text-primary mb-4">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600 mb-4">
              Please connect your wallet to view your dashboard
            </p>
            <Link href="/">
              <Button className="bg-primary hover:bg-secondary text-white">
                Go to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NetworkStatus />
      <RateLimitWarning 
        show={showRateLimitWarning} 
        onDismiss={() => setShowRateLimitWarning(false)} 
      />
      <header className="bg-white border-b border-gray-200 px-3 py-2">
        <div className="flex items-center max-w-lg mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-2 p-1.5">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center flex-1">
            <img src="/minilend-logo.png" alt="Minilend Logo" className="w-7 h-7 object-contain mr-2" />
            <div>
              <h1 className="text-lg font-bold text-primary">Dashboard</h1>
              <div className="text-xs text-gray-600">
                {formatAddress(address || "")}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-3 py-3 max-w-lg mx-auto pb-24 space-y-3">
        {needsVerification && isConnected && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Shield className="w-4 h-4 mr-2" />
                <p>Verify you're human for enhanced security (optional)</p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  onClick={() => router.push("/self")}
                  className="bg-primary hover:bg-primary/90 text-white text-xs px-3 py-1 h-7"
                >
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    localStorage.setItem('verification-skipped', 'true');
                    setVerificationSkipped(true);
                    setNeedsVerification(false);
                  }}
                  className="text-gray-600 hover:text-gray-800 text-xs px-3 py-1 h-7"
                >
                  Skip
                </Button>
              </div>
            </div>
          </div>
        )}
        <Card className="bg-white border-secondary shadow-sm">
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold text-center text-primary mb-3">
              Financial Summary
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-xs font-medium mb-1 text-gray-600">Savings</p>
                <p className="text-lg font-bold text-primary">
                  ${getTotalSavingsUSD().toFixed(2)}
                </p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <ArrowDownLeft className="w-5 h-5 mx-auto mb-1 text-red-600" />
                <p className="text-xs font-medium mb-1 text-gray-600">Loans</p>
                <p className="text-lg font-bold text-red-600">
                  ${getTotalBorrowsUSD().toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                className="flex-1 h-10 text-sm text-white bg-primary hover:bg-primary/90"
                onClick={() => setWithdrawOpen(true)}
              >
                Withdraw
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-10 text-sm border-primary text-primary hover:bg-primary/10"
                onClick={handleHistoryClick}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                History
              </Button>
            </div>

          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-white border-secondary shadow-sm">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="flex items-center text-sm text-primary">
                <TrendingUp className="w-4 h-4 mr-1.5" />
                Savings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1.5">
                {SUPPORTED_STABLECOINS
                  .filter((token) => {
                    const deposit = deposits[token];
                    return deposit && deposit !== "0" && TOKEN_INFO[token];
                  })
                  .slice(0, 3)
                  .map((token) => {
                    const info = TOKEN_INFO[token];
                    const deposit = deposits[token];
                    return (
                      <div key={token} className="flex justify-between items-center">
                        <span className="font-medium text-xs text-gray-700">{info.symbol}</span>
                        <span className="text-primary font-semibold text-xs">
                          {formatAmount(deposit, info.decimals)}
                          <span className="text-gray-500 ml-1">
                            (${convertToUSD(deposit, info.decimals).toFixed(2)})
                          </span>
                        </span>
                      </div>
                    );
                  })}
                {Object.values(deposits).every((d) => !d || d === "0") && (
                  <p className="text-gray-500 text-center py-3 text-xs">
                    No savings yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-secondary shadow-sm">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="flex items-center text-sm text-primary">
                <ArrowDownLeft className="w-4 h-4 mr-1.5" />
                Loans
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1.5">
                {SUPPORTED_STABLECOINS
                  .filter((token) => {
                    const borrow = borrows[token];
                    return borrow && borrow !== "0" && TOKEN_INFO[token];
                  })
                  .slice(0, 3)
                  .map((token) => {
                    const info = TOKEN_INFO[token];
                    const borrow = borrows[token];
                    return (
                      <div key={token} className="flex justify-between items-center">
                        <span className="font-medium text-xs text-gray-700">{info.symbol}</span>
                        <span className="text-red-600 font-semibold text-xs">
                          {formatAmount(borrow, info.decimals)}
                          <span className="text-gray-500 ml-1">
                            (${convertToUSD(borrow, info.decimals).toFixed(2)})
                          </span>
                        </span>
                      </div>
                    );
                  })}
                {Object.values(borrows).every((b) => !b || b === "0") && (
                  <p className="text-gray-500 text-center py-3 text-xs">
                    No active loans
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-secondary shadow-sm">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="flex items-center text-sm text-primary">
                <Shield className="w-4 h-4 mr-1.5" />
                Collateral
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1.5">
                {SUPPORTED_COLLATERAL
                  .filter((token) => {
                    const collat = collateral[token];
                    return collat && collat !== "0" && TOKEN_INFO[token];
                  })
                  .slice(0, 3)
                  .map((token) => {
                    const info = TOKEN_INFO[token];
                    const collat = collateral[token];
                    return (
                      <div key={token} className="flex justify-between items-center">
                        <span className="font-medium text-xs text-gray-700">{info.symbol}</span>
                        <span className="text-primary font-semibold text-xs">
                          {formatAmount(collat, info.decimals)}
                          <span className="text-gray-500 ml-1">
                            (${convertToUSD(collat, info.decimals).toFixed(2)})
                          </span>
                        </span>
                      </div>
                    );
                  })}
                {Object.values(collateral).every((c) => !c || c === "0") && (
                  <p className="text-gray-500 text-center py-3 text-xs">
                    No collateral
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="bg-white border-secondary shadow-sm rounded-lg">
            <OracleRatesCard
              tokens={[
                "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0",
                "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
                "0x765DE816845861e75A25fCA122bb6898B8B1282a",
                "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71",
              ]}
              localTokenAddress={"0x456a3D042C0DbD3db53D5489e98dFb038553B0d0"}
            />
          </div>

          <Card className="bg-white border-secondary shadow-sm col-span-2">
            <CardContent className="p-4">
              <ErrorBoundary>
                <TVLCard 
                  contract={contract} 
                  supportedTokens={SUPPORTED_STABLECOINS}
                  tokenInfo={TOKEN_INFO}
                />
              </ErrorBoundary>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-2 fixed bottom-0 left-0 right-0 shadow-md">
        <div className="flex justify-center max-w-lg mx-auto">
          <Link href="/" className="flex flex-col items-center text-gray-400 px-8">
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link href="/dashboard" className="flex flex-col items-center text-primary px-8">
            <ArrowDownLeft className="w-5 h-5" />
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
        </div>
      </footer>

      <FundsWithdrawalModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onWithdraw={handleWithdraw}
        userDeposits={deposits}
        depositLockEnds={lockEnds}
        tokenInfos={TOKEN_INFO}
        loading={loading}
        userAddress={address}
        getWithdrawableAmount={getActualWithdrawableAmount}
      />
    </div>
  );
}