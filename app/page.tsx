"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight, BarChart3, Sparkles } from "lucide-react"
import Link from "next/link"
import { useWallet } from "@/lib/wallet"
import { useContract } from "@/lib/contract"
import { TransactionModal } from "@/components/TransactionModal"
import { SaveMoneyModal } from "@/components/SaveMoneyModal"
import { BorrowMoneyModal } from "@/components/BorrowMoneyModal"
import { PayBackModal } from "@/components/PayBackModal"
import { formatAddress } from "@/lib/utils"

export default function HomePage() {
  const { isConnected, address, connect, disconnect, isConnecting, error } = useWallet()

  const {
    supportedStablecoins,
    supportedCollateral,
    deposit,
    depositCollateral,
    borrow,
    repay,
    getTokenBalance,
    getTokenInfo,
    getUserCollateral,
    loading,
  } = useContract()

  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean
    type: "success" | "error"
    message: string
    txHash?: string
  }>({
    isOpen: false,
    type: "success",
    message: "",
  })

  const [userBalances, setUserBalances] = useState<Record<string, string>>({})
  const [userCollaterals, setUserCollaterals] = useState<Record<string, string>>({})
  const [tokenInfos, setTokenInfos] = useState<Record<string, { symbol: string; decimals: number }>>({})

  useEffect(() => {
    if (isConnected && address && supportedStablecoins.length > 0) {
      loadUserData()
    }
  }, [isConnected, address, supportedStablecoins])

  const loadUserData = async () => {
    if (!address) return

    try {
      const balances: Record<string, string> = {}
      const collaterals: Record<string, string> = {}
      const infos: Record<string, { symbol: string; decimals: number }> = {}

      // Load stablecoin data
      for (const tokenAddress of supportedStablecoins) {
        const info = await getTokenInfo(tokenAddress)
        const balance = await getTokenBalance(tokenAddress, address)

        infos[tokenAddress] = info
        balances[tokenAddress] = balance
      }

      // Load collateral data
      for (const tokenAddress of supportedCollateral) {
        if (!infos[tokenAddress]) {
          const info = await getTokenInfo(tokenAddress)
          infos[tokenAddress] = info
        }
        const balance = await getTokenBalance(tokenAddress, address)
        const collateral = await getUserCollateral(address, tokenAddress)

        balances[tokenAddress] = balance
        collaterals[tokenAddress] = collateral
      }

      setTokenInfos(infos)
      setUserBalances(balances)
      setUserCollaterals(collaterals)
    } catch (error) {
      console.error("Error loading user data:", error)
    }
  }

  const handleSaveMoney = async (token: string, amount: string, lockPeriod: number) => {
    try {
      const txHash = await deposit(token, amount, lockPeriod)
      setTransactionModal({
        isOpen: true,
        type: "success",
        message: "Your money was saved successfully!",
        txHash,
      })
      await loadUserData()
    } catch (error: any) {
      setTransactionModal({
        isOpen: true,
        type: "error",
        message: error.message || "Something went wrong while saving your money.",
      })
    }
  }

  const handleDepositCollateral = async (token: string, amount: string) => {
    try {
      const txHash = await depositCollateral(token, amount)
      await new Promise((resolve) => setTimeout(resolve, 2000))

      if (address) {
        const updatedCollateral = await getUserCollateral(address, token)
        setUserCollaterals((prev) => ({
          ...prev,
          [token]: updatedCollateral,
        }))
      }

      setTransactionModal({
        isOpen: true,
        type: "success",
        message: "Your collateral was deposited successfully!",
        txHash,
      })

      await loadUserData()
    } catch (error: any) {
      setTransactionModal({
        isOpen: true,
        type: "error",
        message: error.message || "Something went wrong while depositing collateral.",
      })
    }
  }

  const handleBorrowMoney = async (token: string, amount: string, collateralToken: string) => {
    try {
      const txHash = await borrow(token, amount, collateralToken)
      setTransactionModal({
        isOpen: true,
        type: "success",
        message: "You have successfully borrowed money!",
        txHash,
      })
      await loadUserData()
    } catch (error: any) {
      setTransactionModal({
        isOpen: true,
        type: "error",
        message: error.message || "Something went wrong while borrowing money.",
      })
    }
  }

  const handlePayBack = async (token: string, amount: string) => {
    try {
      const txHash = await repay(token, amount)
      setTransactionModal({
        isOpen: true,
        type: "success",
        message: "Your loan payment was successful!",
        txHash,
      })
      await loadUserData()
    } catch (error: any) {
      setTransactionModal({
        isOpen: true,
        type: "error",
        message: error.message || "Something went wrong while paying back your loan.",
      })
    }
  }

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
      id: "payback",
      title: "Pay Back",
      description: "Repay your loans",
      icon: ArrowUpRight,
      color: "bg-gradient-to-br from-purple-500 to-violet-600",
      iconColor: "text-purple-100",
    },
    {
      id: "history",
      title: "View History",
      description: "Check your transactions",
      icon: BarChart3,
      color: "bg-gradient-to-br from-orange-500 to-red-600",
      iconColor: "text-orange-100",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-6 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">MiniLend</h1>
              <p className="text-sm text-gray-600">Grow Your Money</p>
            </div>
          </div>

          {!isConnected ? (
            <div className="text-right">
              <Button
                onClick={connect}
                disabled={isConnecting}
                className="bg-primary hover:bg-secondary text-white px-6 py-3 rounded-xl min-h-[48px] shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Wallet className="w-4 h-4 mr-2" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
              {error && <p className="text-red-500 text-xs mt-2 max-w-[200px]">{error}</p>}
            </div>
          ) : (
            <div className="text-right">
              <div className="bg-primary/10 rounded-xl px-4 py-2 mb-2">
                <p className="text-sm font-medium text-primary">{formatAddress(address || "")}</p>
              </div>
              <Button
                onClick={disconnect}
                variant="outline"
                size="sm"
                className="text-xs bg-transparent hover:bg-gray-100"
              >
                Disconnect
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-8 max-w-6xl mx-auto">
        {!isConnected ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-2xl max-w-md w-full">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                  <Wallet className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-primary mb-3">Connect Your Wallet</h2>
                <p className="text-gray-600 mb-6">
                  Connect your wallet to start saving and borrowing money on the Celo blockchain
                </p>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
                <Button
                  onClick={connect}
                  disabled={isConnecting}
                  className="bg-primary hover:bg-secondary text-white w-full min-h-[48px] rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </Button>
                {typeof window !== "undefined" && !window.ethereum && (
                  <p className="text-gray-500 text-sm mt-4">
                    Don't have a wallet?{" "}
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
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to MiniLend</h2>
              <p className="text-gray-600 text-lg">Choose an action to get started</p>
            </div>

            {/* Action Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {actionCards.map((card) => {
                const IconComponent = card.icon
                return (
                  <Card
                    key={card.id}
                    className="group cursor-pointer border-0 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-white/80 backdrop-blur-sm overflow-hidden"
                    onClick={() => {
                      if (card.id === "history") {
                        // Navigate to dashboard for history
                        window.location.href = "/dashboard"
                      } else {
                        setActiveModal(card.id)
                      }
                    }}
                  >
                    <CardContent className="p-6 text-center relative">
                      <div
                        className={`w-16 h-16 ${card.color} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}
                      >
                        <IconComponent className={`w-8 h-8 ${card.iconColor}`} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{card.title}</h3>
                      <p className="text-sm text-gray-600">{card.description}</p>

                      {/* Hover effect overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Quick Stats */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 max-w-2xl mx-auto border-0 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Quick Actions</h3>
              <div className="flex justify-center space-x-4">
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    className="bg-white/80 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all duration-200 rounded-xl"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="bg-white/80 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all duration-200 rounded-xl"
                  onClick={() => window.open("https://celoscan.io", "_blank")}
                >
                  View on CeloScan
                </Button>
              </div>
            </div>
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

      <TransactionModal
        isOpen={transactionModal.isOpen}
        onClose={() => setTransactionModal({ ...transactionModal, isOpen: false })}
        type={transactionModal.type}
        message={transactionModal.message}
        txHash={transactionModal.txHash}
      />
    </div>
  )
}
