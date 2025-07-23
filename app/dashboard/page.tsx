"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, TrendingUp, ArrowDownLeft, Shield, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useWallet } from "@/lib/wallet"
import { useContract } from "@/lib/contract"
import { formatAmount, formatAddress } from "@/lib/utils"
import { OracleRatesCard } from "@/components/OracleRatesCard"

interface UserData {
  deposits: Record<string, string>
  borrows: Record<string, string>
  collateral: Record<string, string>
  lockEnds: Record<string, number>
}

export default function DashboardPage() {
  const { isConnected, address } = useWallet()
  const {
    supportedStablecoins,
    supportedCollateral,
    getTotalSupply,
    getUserDeposits,
    getUserBorrows,
    getUserCollateral,
    getDepositLockEnd,
    getTokenInfo,
    loading,
  } = useContract()

  const [userData, setUserData] = useState<UserData>({
    deposits: {},
    borrows: {},
    collateral: {},
    lockEnds: {},
  })

  const [poolData, setPoolData] = useState<Record<string, string>>({})
  const [tokenInfos, setTokenInfos] = useState<Record<string, { symbol: string; decimals: number }>>({})

  useEffect(() => {
    if (isConnected && address && supportedStablecoins.length > 0) {
      loadDashboardData()
    }
  }, [isConnected, address, supportedStablecoins])

  const loadDashboardData = async () => {
    if (!address) return

    try {
      const deposits: Record<string, string> = {}
      const borrows: Record<string, string> = {}
      const collateral: Record<string, string> = {}
      const lockEnds: Record<string, number> = {}
      const pools: Record<string, string> = {}
      const infos: Record<string, { symbol: string; decimals: number }> = {}

      // Load data for all supported stablecoins
      for (const tokenAddress of supportedStablecoins) {
        const info = await getTokenInfo(tokenAddress)
        const userDeposit = await getUserDeposits(address, tokenAddress)
        const userBorrow = await getUserBorrows(address, tokenAddress)
        const lockEnd = await getDepositLockEnd(address, tokenAddress)
        const totalSupply = await getTotalSupply(tokenAddress)

        infos[tokenAddress] = info
        deposits[tokenAddress] = userDeposit
        borrows[tokenAddress] = userBorrow
        lockEnds[tokenAddress] = lockEnd
        pools[tokenAddress] = totalSupply
      }

      // Load collateral data
      for (const tokenAddress of supportedCollateral) {
        if (!infos[tokenAddress]) {
          const info = await getTokenInfo(tokenAddress)
          infos[tokenAddress] = info
        }
        const userCollat = await getUserCollateral(address, tokenAddress)
        collateral[tokenAddress] = userCollat
      }

      setUserData({ deposits, borrows, collateral, lockEnds })
      setPoolData(pools)
      setTokenInfos(infos)
    } catch (error) {
      console.error("Error loading dashboard data:", error)
    }
  }

  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return "No lock"
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const isLocked = (timestamp: number) => {
    return timestamp > 0 && timestamp > Date.now() / 1000
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-white border-secondary">
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold text-primary mb-4">Connect Your Wallet</h2>
            <p className="text-gray-600 mb-4">Please connect your wallet to view your dashboard</p>
            <Link href="/">
              <Button className="bg-primary hover:bg-secondary text-white">Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center max-w-4xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-3">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary">Pool Dashboard</h1>
            <p className="text-sm text-gray-600">{formatAddress(address || "")}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Total Pool Money */}
            <Card className="bg-white border-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="text-primary">Total Money in Pool</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {supportedStablecoins.slice(0, 5).map((token) => {
                  const info = tokenInfos[token]
                  const total = poolData[token]

                  if (!info || !total || total === "0") return null

                  return (
                    <div key={token} className="flex justify-between items-center">
                      <span className="font-medium">{info.symbol}</span>
                      <span className="text-primary font-semibold">
                        {formatAmount(total, info.decimals)} {info.symbol}
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Your Savings */}
            <Card className="bg-white border-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-primary">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Your Savings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {supportedStablecoins.map((token) => {
                  const info = tokenInfos[token]
                  const deposit = userData.deposits[token]
                  const lockEnd = userData.lockEnds[token]

                  if (!info || !deposit || deposit === "0") return null

                  return (
                    <div key={token} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">{info.symbol}</span>
                        <span className="text-primary font-semibold">
                          {formatAmount(deposit, info.decimals)} {info.symbol}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>
                          Lock Status:{" "}
                          {isLocked(lockEnd) ? `Locked until ${formatDate(lockEnd)}` : "Available to withdraw"}
                        </p>
                      </div>
                    </div>
                  )
                })}

                {Object.values(userData.deposits).every((d) => !d || d === "0") && (
                  <p className="text-gray-500 text-center py-4">
                    No savings yet. Start saving to see your progress here.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Your Loans */}
            <Card className="bg-white border-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-primary">
                  <ArrowDownLeft className="w-5 h-5 mr-2" />
                  Your Loans
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {supportedStablecoins.map((token) => {
                  const info = tokenInfos[token]
                  const borrow = userData.borrows[token]

                  if (!info || !borrow || borrow === "0") return null

                  return (
                    <div key={token} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">{info.symbol}</span>
                        <span className="text-red-600 font-semibold">
                          {formatAmount(borrow, info.decimals)} {info.symbol}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Amount owed (including interest)</p>
                      </div>
                    </div>
                  )
                })}

                {Object.values(userData.borrows).every((b) => !b || b === "0") && (
                  <p className="text-gray-500 text-center py-4">
                    No active loans. Your borrowing history will appear here.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Oracle Rates */}
            <OracleRatesCard />

            {/* Your Collateral */}
            <Card className="bg-white border-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-primary">
                  <Shield className="w-5 h-5 mr-2" />
                  Your Guarantee
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {supportedCollateral.map((token) => {
                  const info = tokenInfos[token]
                  const collat = userData.collateral[token]

                  if (!info || !collat || collat === "0") return null

                  return (
                    <div key={token} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">{info.symbol}</span>
                        <span className="text-primary font-semibold">
                          {formatAmount(collat, info.decimals)} {info.symbol}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Used as loan guarantee</p>
                      </div>
                    </div>
                  )
                })}

                {Object.values(userData.collateral).every((c) => !c || c === "0") && (
                  <p className="text-gray-500 text-center py-4">
                    No collateral deposited. Add collateral to borrow money.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* View Transactions */}
            <Card className="bg-white border-secondary">
              <CardContent className="p-4">
                <Button
                  variant="outline"
                  className="w-full border-secondary text-primary hover:bg-secondary hover:text-white min-h-[48px] bg-transparent"
                  onClick={() => window.open(`https://celoscan.io/address/${address}`, "_blank")}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View All Transactions on CeloScan
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="bg-white border-t border-gray-200 px-4 py-4 mt-8">
        <div className="flex justify-center space-x-8 max-w-md mx-auto">
          <Link href="/" className="flex flex-col items-center text-gray-400">
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link href="/dashboard" className="flex flex-col items-center text-primary">
            <ArrowDownLeft className="w-6 h-6" />
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
        </div>
      </footer>
    </div>
  )
}
