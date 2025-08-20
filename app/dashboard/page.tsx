"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, ArrowDownLeft, Shield, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatAmount, formatAddress } from "@/lib/utils";
import { WithdrawModal } from "@/components/WithdrawModal";
import { OracleRatesCard } from "@/components/OracleRatesCard";
import { oracleService } from "@/lib/services/oracleService";
import { useActiveAccount } from "thirdweb/react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useWithdraw } from "@/hooks/useWithdraw";

const SUPPORTED_STABLECOINS = [
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
  "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", // cREAL
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", // cKES
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3", // USDGLO
];

const SUPPORTED_COLLATERAL = SUPPORTED_STABLECOINS;

const TOKEN_INFO: Record<string, { symbol: string; decimals: number }> = {
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": { symbol: "USDC", decimals: 6 },
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": { symbol: "cUSD", decimals: 18 },
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": { symbol: "cEUR", decimals: 18 },
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": { symbol: "cREAL", decimals: 18 },
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": { symbol: "USDT", decimals: 6 },
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": { symbol: "cKES", decimals: 18 },
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": { symbol: "USDGLO", decimals: 18 },
};

export default function DashboardPage() {
  const account = useActiveAccount();
  const isConnected = !!account;
  const address = account?.address;
  
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const { deposits, borrows, collateral, lockEnds, poolData, loading } = useDashboardData(address);
  const { withdraw, isLoading: withdrawLoading } = useWithdraw();



  const handleWithdraw = async (token: string, amount: string): Promise<void> => {
    try {
      // Validate Oracle price before withdrawal
      const isOracleValid = await oracleService.validatePriceData(token);
      if (!isOracleValid) {
        throw new Error("Unable to get current market prices. Please try again in a moment.");
      }
      
      await withdraw(token, amount);
    } catch (error) {
      console.error("Error withdrawing:", error);
      throw error;
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
            <OracleRatesCard />
          </div>
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
        userDeposits={deposits}
        depositLockEnds={lockEnds}
        tokenInfos={TOKEN_INFO}
        loading={loading || withdrawLoading}
      />
    </div>
  );
}