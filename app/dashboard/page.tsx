"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, ArrowDownLeft, Shield, ExternalLink, ArrowUpRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatAmount, formatAddress } from "@/lib/utils";
import { extractTransactionError } from "@/lib/utils/errorMapping";
import { WithdrawModal } from "@/components/WithdrawModal";
import { OracleRatesCard } from "@/components/OracleRatesCard";
import { MINILEND_ADDRESS, ORACLE_ADDRESS, thirdwebService } from "@/lib/services/thirdwebService";
import { oracleService } from "@/lib/services/oracleService";
interface UserData {
  deposits: Record<string, string>;
  borrows: Record<string, string>;
  collateral: Record<string, string>;
  lockEnds: Record<string, number>;
}

import { useActiveAccount } from "thirdweb/react";
import {
  useWithdraw as useWithdrawContract,
  useTotalSupply
} from '@/lib/thirdweb/minilend-contract';
import { getContract, readContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { Imprima } from "next/font/google";

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



// const TVLCard = ({ contract }: { contract: any }) => {
//   const [tvlData, setTvlData] = useState<Record<string, string>>({});
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const loadTVL = async () => {
//       setLoading(true);
//       try {
//         const tvl: Record<string, string> = {};
        
//         const promises = SUPPORTED_STABLECOINS.map(async (token) => {
//           try {
//             const totalSupply = await readContract({
//               contract,
//               method: "function totalSupply(address) view returns (uint256)",
//               params: [token],
//             });
//             tvl[token] = totalSupply.toString();
//           } catch (error) {
//             tvl[token] = "0";
//           }
//         });

//         await Promise.all(promises);
//         setTvlData(tvl);
//       } catch (error) {
//         console.error("Error loading TVL:", error);
//       } finally {
//         setLoading(false);
//       }
//     };

//     loadTVL();
//   }, [contract]);

//   if (loading) {
//     return <div className="text-xs text-gray-500 text-center py-3">Loading TVL...</div>;
//   }

//   const totalTVL = Object.entries(tvlData).reduce((acc, [token, amount]) => {
//     if (!amount || amount === "0" || !TOKEN_INFO[token]) return acc;
//     const info = TOKEN_INFO[token];
//     const numericAmount = Number(formatAmount(amount, info.decimals));
//     return acc + numericAmount;
//   }, 0);

//   return (
//     <>
//       <h2 className="text-lg font-semibold text-center text-primary mb-3">
//         Total Value Locked
//       </h2>
//       <div className="text-center p-3 bg-green-50 rounded-lg mb-4">
//         <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-600" />
//         <p className="text-xs font-medium mb-1 text-gray-600">Available Liquidity</p>
//         <p className="text-lg font-bold text-green-600">
//           ${totalTVL.toFixed(2)}
//         </p>
//       </div>
//       <div className="space-y-1.5">
//         {Object.entries(tvlData)
//           .filter(([token, amount]) => amount && amount !== "0" && TOKEN_INFO[token])
//           .slice(0, 4)
//           .map(([token, amount]) => {
//             const info = TOKEN_INFO[token];
//             return (
//               <div key={token} className="flex justify-between items-center">
//                 <span className="font-medium text-xs text-gray-700">{info.symbol}</span>
//                 <span className="text-green-600 font-semibold text-xs">
//                   {formatAmount(amount, info.decimals)}
//                 </span>
//               </div>
//             );
//           })}
//       </div>
//     </>
//   );
// };

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

  const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3): Promise<any> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        if (error.message?.includes('429') && i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
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

      // Process tokens sequentially to avoid rate limiting
      for (const token of SUPPORTED_STABLECOINS) {
        try {
          // Add delay between requests to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const contractCalls = await Promise.allSettled([
            readContract({
              contract,
              method: "function userDeposits(address, address, uint256) view returns (uint256 amount, uint256 lockEnd)",
              params: [address, token, BigInt(0)],
            }),
            readContract({
              contract,
              method: "function userBorrows(address, address) view returns (uint256)",
              params: [address, token],
            }),
            readContract({
              contract,
              method: "function userCollateral(address, address) view returns (uint256)",
              params: [address, token],
            })
          ]);
          
          const userDeposit = contractCalls[0].status === 'fulfilled' ? contractCalls[0].value : [BigInt(0), BigInt(0)];
          const userBorrow = contractCalls[1].status === 'fulfilled' ? contractCalls[1].value : BigInt(0);
          const userCollat = contractCalls[2].status === 'fulfilled' ? contractCalls[2].value : BigInt(0);
          
          deposits[token] = userDeposit[0].toString();
          borrows[token] = userBorrow.toString();
          collateral[token] = userCollat.toString();
          lockEnds[token] = Number(userDeposit[1]);
          pools[token] = "0";
          rates[token] = 1.0;
        } catch (error: any) {
          const tokenSymbol = TOKEN_INFO[token]?.symbol || 'Unknown';
          console.warn(`Skipping ${tokenSymbol} due to contract error:`, error.code || error.message);
          deposits[token] = "0";
          borrows[token] = "0";
          collateral[token] = "0";
          lockEnds[token] = 0;
          pools[token] = "0";
          rates[token] = 1.0;
        }
      }

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

  return { userData, poolData, loading, exchangeRates, loadDashboardData };
};

export default function DashboardPage() {
  const account = useActiveAccount();
  const { data: session } = useSession();
  const router = useRouter();
  const address = account?.address;
  const isConnected = !!address;
  
  const contract = getContract({
    client,
    chain: celo,
    address: MINILEND_ADDRESS,
    });

  const withdrawFn = useWithdrawContract();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { userData, poolData, loading, exchangeRates, loadDashboardData } = useDashboardData(address, contract);

  useEffect(() => {
    if (isConnected && address) {
      loadDashboardData();
    }
  }, [isConnected, address]);



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

  const getExchangeRate = (tokenAddress: string): number => {
    return exchangeRates[tokenAddress] || 1.0;
  };

  const convertToUSD = (amount: string, decimals: number, tokenAddress: string): number => {
    if (!amount || amount === "0") return 0;
    const numericAmount = Number(formatAmount(amount, decimals));
    const exchangeRate = getExchangeRate(tokenAddress);
    return numericAmount * exchangeRate;
  };

  const getTotalSavingsUSD = (): number => {
    return Object.entries(userData.deposits).reduce((acc, [token, amount]) => {
      if (!amount || amount === "0" || !TOKEN_INFO[token]) return acc;
      const info = TOKEN_INFO[token];
      return acc + convertToUSD(amount, info.decimals, token);
    }, 0);
  };

  const getTotalBorrowsUSD = (): number => {
    return Object.entries(userData.borrows).reduce((acc, [token, amount]) => {
      if (!amount || amount === "0" || !TOKEN_INFO[token]) return acc;
      const info = TOKEN_INFO[token];
      return acc + convertToUSD(amount, info.decimals, token);
    }, 0);
  };

  const TokenList = ({ tokens, data, type, emptyMessage, convertToUSD }: {
    tokens: string[];
    data: Record<string, string>;
    type: string;
    emptyMessage: string;
    convertToUSD: (amount: string, decimals: number, token: string) => number;
  }) => {
    const colorClass = type === "borrows" ? "text-red-600" : "text-primary";
    return (
      <div className="space-y-1.5">
        {tokens
          .filter((token) => data[token] && data[token] !== "0" && TOKEN_INFO[token])
          .slice(0, 3)
          .map((token) => {
            const info = TOKEN_INFO[token];
            const amount = data[token];
            return (
              <div key={token} className="flex justify-between items-center">
                <span className="font-medium text-xs text-gray-700">{info.symbol}</span>
                <span className={`${colorClass} font-semibold text-xs`}>
                  {formatAmount(amount, info.decimals)}
                  <span className="text-gray-500 ml-1">
                    (${convertToUSD(amount, info.decimals, token).toFixed(2)})
                  </span>
                </span>
              </div>
            );
          })}
        {Object.values(data).every((d) => !d || d === "0") && (
          <p className="text-gray-500 text-center py-3 text-xs">
            {emptyMessage}
          </p>
        )}
      </div>
    );
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

      <main className="px-3 py-3 max-w-lg mx-auto pb-20 space-y-3">
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
            {!session?.user?.verified && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Shield className="w-4 h-4 mr-2 text-blue-600" />
                    <span className="text-sm text-blue-800">Verify your humanity for enhanced security</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => router.push("/self")}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 h-7"
                  >
                    Verify
                  </Button>
                </div>
              </div>
            )}
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
                    const deposit = userData.deposits[token];
                    return deposit && deposit !== "0" && TOKEN_INFO[token];
                  })
                  .slice(0, 3)
                  .map((token) => {
                    const info = TOKEN_INFO[token];
                    const deposit = userData.deposits[token];
                    return (
                      <div key={token} className="flex justify-between items-center">
                        <span className="font-medium text-xs text-gray-700">{info.symbol}</span>
                        <span className="text-primary font-semibold text-xs">
                          {formatAmount(deposit, info.decimals)}
                          <span className="text-gray-500 ml-1">
                            (${convertToUSD(deposit, info.decimals, token).toFixed(2)})
                          </span>
                        </span>
                      </div>
                    );
                  })}
                {Object.values(userData.deposits).every((d) => !d || d === "0") && (
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
                    const borrow = userData.borrows[token];
                    return borrow && borrow !== "0" && TOKEN_INFO[token];
                  })
                  .slice(0, 3)
                  .map((token) => {
                    const info = TOKEN_INFO[token];
                    const borrow = userData.borrows[token];
                    return (
                      <div key={token} className="flex justify-between items-center">
                        <span className="font-medium text-xs text-gray-700">{info.symbol}</span>
                        <span className="text-red-600 font-semibold text-xs">
                          {formatAmount(borrow, info.decimals)}
                          <span className="text-gray-500 ml-1">
                            (${convertToUSD(borrow, info.decimals, token).toFixed(2)})
                          </span>
                        </span>
                      </div>
                    );
                  })}
                {Object.values(userData.borrows).every((b) => !b || b === "0") && (
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
                    const collat = userData.collateral[token];
                    return collat && collat !== "0" && TOKEN_INFO[token];
                  })
                  .slice(0, 3)
                  .map((token) => {
                    const info = TOKEN_INFO[token];
                    const collat = userData.collateral[token];
                    return (
                      <div key={token} className="flex justify-between items-center">
                        <span className="font-medium text-xs text-gray-700">{info.symbol}</span>
                        <span className="text-primary font-semibold text-xs">
                          {formatAmount(collat, info.decimals)}
                          <span className="text-gray-500 ml-1">
                            (${convertToUSD(collat, info.decimals, token).toFixed(2)})
                          </span>
                        </span>
                      </div>
                    );
                  })}
                {Object.values(userData.collateral).every((c) => !c || c === "0") && (
                  <p className="text-gray-500 text-center py-3 text-xs">
                    No collateral
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="bg-white border-secondary shadow-sm rounded-lg">
            <OracleRatesCard />
          </div>

          {/* <Card className="bg-white border-secondary shadow-sm col-span-2">
            <CardContent className="p-4">
              <TVLCard contract={contract} />
            </CardContent>
          </Card> */}
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

      <WithdrawModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onWithdraw={handleWithdraw}
        userDeposits={userData.deposits}
        depositLockEnds={userData.lockEnds}
        tokenInfos={TOKEN_INFO}
        loading={loading}
        userAddress={address}
        getWithdrawableAmount={getActualWithdrawableAmount}
      />
    </div>
  );
}