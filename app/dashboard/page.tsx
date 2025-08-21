"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, TrendingUp, ArrowDownLeft, Shield, ExternalLink, Wallet, DollarSign } from "lucide-react"
import { useSession, signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { formatAddress } from "@/lib/utils"
import { FundsWithdrawalModal } from "@/components/FundsWithdrawalModal"
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService"
import { getContract } from "thirdweb";
import { useActiveAccount, useReadContract } from "thirdweb/react"
import { client } from "@/lib/thirdweb/client"
import { celo } from "thirdweb/chains"

interface UserData {
  deposits: Record<string, string>
  borrows: Record<string, string>
  collateral: Record<string, string>
  lockEnds: Record<string, number>
}

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
]

// Valid collateral assets from deployment config
const SUPPORTED_COLLATERAL = [
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
  "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3", // USDGLO
]

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
}

export default function DashboardPage() {
  const account = useActiveAccount()
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const address = account?.address
  const isConnected = !!address

 const contract = getContract({
   address: MINILEND_ADDRESS,
   chain: celo,
   client,
})

  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [verificationSkipped, setVerificationSkipped] = useState(false)

  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})

  const { data: userDepositsData, isLoading: depositsLoading } = useReadContract({
    contract,
    method: "function userDeposits(address, address, uint256) view returns (uint256 amount, uint256 lockEnd)",
    params: address ? [address, SUPPORTED_STABLECOINS[0], BigInt(0)] : undefined,
    queryOptions: { enabled: !!address },
  })

  const { data: userBorrowsData, isLoading: borrowsLoading } = useReadContract({
    contract,
    method: "function userBorrows(address, address) view returns (uint256)",
    params: address ? [address, SUPPORTED_STABLECOINS[0]] : undefined,
    queryOptions: { enabled: !!address },
  })

  useEffect(() => {
    if (isConnected && address && !session?.user?.address) {
      signIn("self-protocol", {
        address,
        verificationData: "",
        redirect: false,
      })
    }
  }, [isConnected, address, session])

  // Check localStorage for verification skip state
  useEffect(() => {
    const skipped = localStorage.getItem("verification-skipped") === "true"
    setVerificationSkipped(skipped)
  }, [])

  // Remove forced verification - make it optional
  useEffect(() => {
    if (sessionStatus === "loading") return
    // Don't show verification if user has skipped it or is already verified
    setNeedsVerification(isConnected && !session?.user?.verified && !verificationSkipped)
  }, [isConnected, session, sessionStatus, verificationSkipped])

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#162013] flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-[#21301c] border-[#426039]">
          <CardContent className="p-6 text-center">
            <Wallet className="w-12 h-12 mx-auto mb-4 text-[#54d22d]" />
            <h2 className="text-lg font-semibold text-white mb-4">Connect Your Wallet</h2>
            <p className="text-[#a2c398] mb-6">Connect your wallet to view your financial dashboard</p>
            <Link href="/">
              <Button className="bg-[#54d22d] hover:bg-[#426039] text-[#162013] font-medium w-full">Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#162013]">
      <header className="bg-[#21301c] border-b border-[#426039] px-4 py-3">
        <div className="flex items-center max-w-lg mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-3 p-2 text-[#a2c398] hover:text-white hover:bg-[#2e4328]">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center flex-1">
            <div className="w-8 h-8 bg-[#54d22d] rounded-full flex items-center justify-center mr-3">
              <DollarSign className="w-5 h-5 text-[#162013]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Your Money</h1>
              <div className="text-xs text-[#a2c398]">{formatAddress(address || "")}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto pb-24 space-y-6">
        {needsVerification && isConnected && (
          <div className="bg-[#2e4328] border border-[#426039] text-[#a2c398] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Shield className="w-5 h-5 mr-3 text-[#54d22d]" />
                <p className="text-sm">Verify your identity for enhanced security</p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  onClick={() => router.push("/self")}
                  className="bg-[#54d22d] hover:bg-[#426039] text-[#162013] text-xs px-4 py-2"
                >
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    localStorage.setItem("verification-skipped", "true")
                    setVerificationSkipped(true)
                    setNeedsVerification(false)
                  }}
                  className="text-[#a2c398] hover:text-white hover:bg-[#2e4328] text-xs px-4 py-2"
                >
                  Skip
                </Button>
              </div>
            </div>
          </div>
        )}

        <Card className="bg-[#21301c] border-[#426039]">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-center text-white mb-6">Your Money Overview</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-[#2e4328] rounded-xl">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-[#54d22d]" />
                <p className="text-sm font-medium mb-1 text-[#a2c398]">Money Saved</p>
                <p className="text-2xl font-bold text-white">${depositsLoading ? "..." : "0.00"}</p>
              </div>
              <div className="text-center p-4 bg-[#2e4328] rounded-xl">
                <ArrowDownLeft className="w-6 h-6 mx-auto mb-2 text-[#54d22d]" />
                <p className="text-sm font-medium mb-1 text-[#a2c398]">Money Borrowed</p>
                <p className="text-2xl font-bold text-white">${borrowsLoading ? "..." : "0.00"}</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button
                className="flex-1 h-12 text-sm font-medium bg-[#54d22d] hover:bg-[#426039] text-[#162013]"
                onClick={() => setWithdrawOpen(true)}
              >
                Cash Out
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 text-sm font-medium border-[#426039] text-[#54d22d] hover:bg-[#2e4328] bg-transparent"
                onClick={() => window.open(`https://celoscan.io/address/${address}`, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                History
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#21301c] border-[#426039]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center justify-center text-lg text-white">
              <Wallet className="w-5 h-5 mr-2 text-[#54d22d]" />
              Your Wallet Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-[#2e4328] rounded-xl">
                <div className="w-8 h-8 bg-[#54d22d] rounded-full flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="w-4 h-4 text-[#162013]" />
                </div>
                <p className="text-xs font-medium mb-1 text-[#a2c398]">Savings</p>
                {depositsLoading ? (
                  <div className="animate-spin w-4 h-4 border border-[#54d22d] border-t-transparent rounded-full mx-auto"></div>
                ) : (
                  <p className="text-sm font-bold text-white">$0.00</p>
                )}
              </div>
              
              <div className="text-center p-4 bg-[#2e4328] rounded-xl">
                <div className="w-8 h-8 bg-[#54d22d] rounded-full flex items-center justify-center mx-auto mb-2">
                  <ArrowDownLeft className="w-4 h-4 text-[#162013]" />
                </div>
                <p className="text-xs font-medium mb-1 text-[#a2c398]">Loans</p>
                {borrowsLoading ? (
                  <div className="animate-spin w-4 h-4 border border-[#54d22d] border-t-transparent rounded-full mx-auto"></div>
                ) : (
                  <p className="text-sm font-bold text-white">$0.00</p>
                )}
              </div>
              
              <div className="text-center p-4 bg-[#2e4328] rounded-xl">
                <div className="w-8 h-8 bg-[#54d22d] rounded-full flex items-center justify-center mx-auto mb-2">
                  <Shield className="w-4 h-4 text-[#162013]" />
                </div>
                <p className="text-xs font-medium mb-1 text-[#a2c398]">Security</p>
                <p className="text-sm font-bold text-white">$0.00</p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-[#426039]">
              <div className="text-center">
                <p className="text-xs text-[#a2c398] mb-2">Quick Actions</p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-[#54d22d] hover:bg-[#426039] text-[#162013] text-xs">
                    Save Money
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 border-[#426039] text-[#54d22d] hover:bg-[#2e4328] text-xs">
                    Borrow
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="bg-[#21301c] border-t border-[#426039] py-3 fixed bottom-0 left-0 right-0">
        <div className="flex justify-center max-w-lg mx-auto">
          <Link href="/" className="flex flex-col items-center text-[#a2c398] hover:text-white px-8">
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link href="/dashboard" className="flex flex-col items-center text-[#54d22d] px-8">
            <ArrowDownLeft className="w-5 h-5" />
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
        </div>
      </footer>

      <FundsWithdrawalModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onWithdraw={async () => {}}
        userDeposits={{}}
        depositLockEnds={{}}
        tokenInfos={TOKEN_INFO}
        loading={false}
        userAddress={address}
        getWithdrawableAmount={async () => "0"}
      />
    </div>
  )
}
