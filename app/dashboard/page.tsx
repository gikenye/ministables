"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  TrendingUp,
  ArrowDownLeft,
  Shield,
  ExternalLink,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { useContract } from "@/lib/contract";
import { formatAmount, formatAddress } from "@/lib/utils";
import { OracleRatesCard } from "@/components/OracleRatesCard";
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
    getTotalSupply,
    getUserDeposits,
    getUserBorrows,
    getUserCollateral,
    getDepositLockEnd,
    getTokenInfo,
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

      // Load data for all supported stablecoins
      for (const tokenAddress of supportedStablecoins) {
        const info = await getTokenInfo(tokenAddress);
        const userDeposit = await getUserDeposits(address, tokenAddress);
        const userBorrow = await getUserBorrows(address, tokenAddress);
        const lockEnd = await getDepositLockEnd(address, tokenAddress);
        const totalSupply = await getTotalSupply(tokenAddress);

        infos[tokenAddress] = info;
        deposits[tokenAddress] = userDeposit;
        borrows[tokenAddress] = userBorrow;
        lockEnds[tokenAddress] = lockEnd;
        pools[tokenAddress] = totalSupply;
      }

      // Load collateral data
      for (const tokenAddress of supportedCollateral) {
        if (!infos[tokenAddress]) {
          const info = await getTokenInfo(tokenAddress);
          infos[tokenAddress] = info;
        }
        const userCollat = await getUserCollateral(address, tokenAddress);
        collateral[tokenAddress] = userCollat;
      }

      setUserData({ deposits, borrows, collateral, lockEnds });
      setPoolData(pools);
      setTokenInfos(infos);
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

  const handleWithdraw = async (
    token: string,
    amount: string
  ): Promise<void> => {
    try {
      await withdraw(token, amount);
      await loadDashboardData();
    } catch (error) {
      console.error("Error withdrawing:", error);
    }
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center max-w-lg mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-2 p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary">Pool Dashboard</h1>
            <p className="text-sm text-gray-600">
              {formatAddress(address || "")}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 max-w-lg mx-auto pb-20">
        {/* Main Summary Card - Larger */}
        <Card className="bg-white border-secondary mb-4 shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xl text-center text-primary">
              Your Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Savings Summary */}
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <TrendingUp className="w-6 h-6 mx-auto mb-1 text-primary" />
                <p className="text-sm font-medium mb-1">Savings</p>
                <p className="text-xl font-bold text-primary">
                  {Object.entries(userData.deposits)
                    .reduce((acc, [token, amount]) => {
                      if (!amount || amount === "0" || !tokenInfos[token])
                        return acc;
                      return (
                        acc +
                        Number(formatAmount(amount, tokenInfos[token].decimals))
                      );
                    }, 0)
                    .toFixed(1)}
                </p>
              </div>

              {/* Loans Summary */}
              <div className="text-center p-3 bg-red-50 rounded-xl">
                <ArrowDownLeft className="w-6 h-6 mx-auto mb-1 text-red-600" />
                <p className="text-sm font-medium mb-1">Loans</p>
                <p className="text-xl font-bold text-red-600">
                  {Object.entries(userData.borrows)
                    .reduce((acc, [token, amount]) => {
                      if (!amount || amount === "0" || !tokenInfos[token])
                        return acc;
                      return (
                        acc +
                        Number(formatAmount(amount, tokenInfos[token].decimals))
                      );
                    }, 0)
                    .toFixed(1)}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex space-x-2">
              <Button
                className="flex-1 h-12 text-white bg-primary hover:bg-primary/90"
                onClick={() => setWithdrawOpen(true)}
              >
                Withdraw Money
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 border-primary text-primary hover:bg-primary/10"
                onClick={() =>
                  window.open(
                    `https://celoscan.io/address/${address}`,
                    "_blank"
                  )
                }
              >
                View History
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Four Smaller Cards in 2x2 Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Card 1: Active Savings */}
          <Card className="bg-white border-secondary shadow-sm">
            <CardHeader className="p-3">
              <CardTitle className="flex items-center text-base text-primary">
                <TrendingUp className="w-4 h-4 mr-2" />
                Active Savings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
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
                    <div
                      key={token}
                      className="flex justify-between items-center mb-2"
                    >
                      <span className="font-medium text-sm">{info.symbol}</span>
                      <span className="text-primary font-semibold text-sm">
                        {formatAmount(deposit, info.decimals)}
                      </span>
                    </div>
                  );
                })}

              {Object.values(userData.deposits).every(
                (d) => !d || d === "0"
              ) && (
                <p className="text-gray-500 text-center py-2 text-sm">
                  No active savings
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Active Loans */}
          <Card className="bg-white border-secondary shadow-sm">
            <CardHeader className="p-3">
              <CardTitle className="flex items-center text-base text-primary">
                <ArrowDownLeft className="w-4 h-4 mr-2" />
                Active Loans
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
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
                    <div
                      key={token}
                      className="flex justify-between items-center mb-2"
                    >
                      <span className="font-medium text-sm">{info.symbol}</span>
                      <span className="text-red-600 font-semibold text-sm">
                        {formatAmount(borrow, info.decimals)}
                      </span>
                    </div>
                  );
                })}

              {Object.values(userData.borrows).every(
                (b) => !b || b === "0"
              ) && (
                <p className="text-gray-500 text-center py-2 text-sm">
                  No active loans
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Your Guarantee */}
          <Card className="bg-white border-secondary shadow-sm">
            <CardHeader className="p-3">
              <CardTitle className="flex items-center text-base text-primary">
                <Shield className="w-4 h-4 mr-2" />
                Your Guarantee
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
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
                    <div
                      key={token}
                      className="flex justify-between items-center mb-2"
                    >
                      <span className="font-medium text-sm">{info.symbol}</span>
                      <span className="text-primary font-semibold text-sm">
                        {formatAmount(collat, info.decimals)}
                      </span>
                    </div>
                  );
                })}

              {Object.values(userData.collateral).every(
                (c) => !c || c === "0"
              ) && (
                <p className="text-gray-500 text-center py-2 text-sm">
                  No active guarantee
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card 4: Exchange Rates */}
          <Card className="bg-white border-secondary shadow-sm">
            <CardHeader className="p-3">
              <CardTitle className="flex items-center text-base text-primary">
                <TrendingUp className="w-4 h-4 mr-2" />
                Exchange Rates
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {/* Show the most important currencies first */}
              {["cUSD", "cEUR", "cREAL"].map((symbol) => {
                // Find the token address for this symbol
                const token = Object.entries(tokenInfos).find(
                  ([_, info]) => info.symbol === symbol
                )?.[0];

                if (!token) return null;
                const info = tokenInfos[token];

                return (
                  <div
                    key={token}
                    className="flex justify-between items-center mb-2"
                  >
                    <span className="font-medium text-sm">{info.symbol}</span>
                    <span className="text-primary font-semibold text-sm">
                      ≈ $
                      {info.symbol === "cUSD"
                        ? "1.00"
                        : info.symbol === "cEUR"
                          ? "1.10"
                          : "0.28"}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer Navigation - Fixed at bottom on mobile */}
      <footer className="bg-white border-t border-gray-200 py-3 fixed bottom-0 left-0 right-0 shadow-md">
        <div className="flex justify-center max-w-lg mx-auto">
          <Link
            href="/"
            className="flex flex-col items-center text-gray-400 px-8"
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex flex-col items-center text-primary px-8"
          >
            <ArrowDownLeft className="w-6 h-6" />
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
        </div>
      </footer>
      {/* Modals */}
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
