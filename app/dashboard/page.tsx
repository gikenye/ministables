"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, ArrowDownLeft, Shield, ExternalLink, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { useContract } from "@/lib/contract";
import { formatAmount, formatAddress } from "@/lib/utils";
import { WithdrawModal } from "@/components/WithdrawModal";

interface UserData {
  deposits: Record<string, string>;
  borrows: Record<string, string>;
  collateral: Record<string, string>;
  lockEnds: Record<string, number>;
}

export default function DashboardPage() {
  const { isConnected, address } = useWallet();
  const {
    supportedStablecoins,
    supportedCollateral,
    getTokenInfo,
    getOracleRate,
    batchGetUserData,
    withdraw,
    loading,
  } = useContract();

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [userData, setUserData] = useState<UserData>({
    deposits: {},
    borrows: {},
    collateral: {},
    lockEnds: {},
  });
  const [poolData, setPoolData] = useState<Record<string, string>>({});
  const [tokenInfos, setTokenInfos] = useState<
    Record<string, { symbol: string; decimals: number }>
  >({});
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isConnected && address && supportedStablecoins.length > 0) {
      loadDashboardData();
    }
  }, [isConnected, address, supportedStablecoins]);

  const loadDashboardData = async () => {
    if (!address) return;
    try {
      const deposits: Record<string, string> = {};
      const borrows: Record<string, string> = {};
      const collateral: Record<string, string> = {};
      const lockEnds: Record<string, number> = {};
      const pools: Record<string, string> = {};
      const infos: Record<string, { symbol: string; decimals: number }> = {};
      const rates: Record<string, number> = {};

      // Get all unique tokens
      const allTokens = [...new Set([...supportedStablecoins, ...supportedCollateral])];
      
      // Batch fetch token info and oracle rates for all tokens in parallel
      const tokenDataPromises = allTokens.map(async (tokenAddress) => {
        const [info, oracleData] = await Promise.all([
          getTokenInfo(tokenAddress),
          getOracleRate(tokenAddress)
        ]);
        return { tokenAddress, info, oracleData };
      });
      
      const tokenDataResults = await Promise.all(tokenDataPromises);
      
      // Process token data
      tokenDataResults.forEach(({ tokenAddress, info, oracleData }) => {
        infos[tokenAddress] = info;
        rates[tokenAddress] = Number(oracleData.rate) / 1e18;
      });

      // Batch fetch all user data in one call
      const userDataResults = await batchGetUserData(address, allTokens);
      
      // Process user data
      userDataResults.forEach(({ token, deposits: userDeposit, borrows: userBorrow, collateral: userCollat, lockEnd, totalSupply }) => {
        deposits[token] = userDeposit;
        borrows[token] = userBorrow;
        collateral[token] = userCollat;
        lockEnds[token] = lockEnd;
        pools[token] = totalSupply;
      });

      setUserData({ deposits, borrows, collateral, lockEnds });
      setPoolData(pools);
      setTokenInfos(infos);
      setExchangeRates(rates);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  };

  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return "No lock";
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const isLocked = (timestamp: number) => {
    return timestamp > 0 && timestamp > Date.now() / 1000;
  };

  const handleWithdraw = async (token: string, amount: string): Promise<void> => {
    try {
      await withdraw(token, amount);
      await loadDashboardData();
    } catch (error) {
      console.error("Error withdrawing:", error);
      throw error; // Re-throw to let WithdrawModal handle the error display
    }
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
      if (!amount || amount === "0" || !tokenInfos[token]) return acc;
      const info = tokenInfos[token];
      return acc + convertToUSD(amount, info.decimals, token);
    }, 0);
  };

  const getTotalBorrowsUSD = (): number => {
    return Object.entries(userData.borrows).reduce((acc, [token, amount]) => {
      if (!amount || amount === "0" || !tokenInfos[token]) return acc;
      const info = tokenInfos[token];
      return acc + convertToUSD(amount, info.decimals, token);
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
                onClick={() => window.open(`https://celoscan.io/address/${address}`, "_blank")}
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
                {supportedStablecoins
                  .filter((token) => {
                    const deposit = userData.deposits[token];
                    return deposit && deposit !== "0" && tokenInfos[token];
                  })
                  .slice(0, 3)
                  .map((token) => {
                    const info = tokenInfos[token];
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
                {supportedStablecoins
                  .filter((token) => {
                    const borrow = userData.borrows[token];
                    return borrow && borrow !== "0" && tokenInfos[token];
                  })
                  .slice(0, 3)
                  .map((token) => {
                    const info = tokenInfos[token];
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
                {supportedCollateral
                  .filter((token) => {
                    const collat = userData.collateral[token];
                    return collat && collat !== "0" && tokenInfos[token];
                  })
                  .slice(0, 3)
                  .map((token) => {
                    const info = tokenInfos[token];
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

          <Card className="bg-white border-secondary shadow-sm">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="flex items-center text-sm text-primary">
                <ArrowUpRight className="w-4 h-4 mr-1.5" />
                Rates
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1.5">
                {supportedStablecoins
                  .filter((token) => tokenInfos[token])
                  .slice(4, 8)
                  .map((token) => {
                    const info = tokenInfos[token];
                    const rate = exchangeRates[token];
                    if (!rate) return null;
                    return (
                      <div key={token} className="flex justify-between items-center">
                        <span className="font-medium text-xs text-gray-700">{info.symbol}</span>
                        <span className="text-primary font-semibold text-xs">
                          ${rate.toFixed(5)}
                        </span>
                      </div>
                    );
                  })}
              </div>
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

      <WithdrawModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onWithdraw={handleWithdraw}
        userDeposits={userData.deposits}
        depositLockEnds={userData.lockEnds}
        tokenInfos={tokenInfos}
        loading={loading}
      />
    </div>
  );
}