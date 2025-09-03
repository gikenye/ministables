"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, AlertCircle, CreditCard, CheckCircle2, RefreshCw } from "lucide-react"
import { formatAmount } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { parseUnits } from "viem"
import { OnrampDepositModal } from "./OnrampDepositModal"
import { onrampService } from "@/lib/services/onrampService"
import { generateDivviReferralTag, reportTransactionToDivvi } from "@/lib/services/divviService"
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService"
import { getTokenIcon } from "@/lib/utils/tokenIcons"
import { 
  getContract, 
  prepareContractCall, 
  sendTransaction,
  waitForReceipt
} from "thirdweb"
import { client } from "@/lib/thirdweb/client"
import { celo } from "thirdweb/chains"
import { calculateRequiredCollateral } from "@/lib/oracles/priceService"
import { useRouter } from "next/navigation"

import { 
  useActiveAccount, 
  useReadContract, 
  useWalletBalance 
} from "thirdweb/react"

interface BorrowMoneyModalProps {
  isOpen: boolean
  onClose: () => void
  onBorrow: (token: string, amount: string, collateralToken: string) => Promise<void>
  onDepositCollateral: (token: string, amount: string) => Promise<void>
  userBalances: Record<string, string>
  userCollaterals: Record<string, string>
  tokenInfos: Record<string, { symbol: string; decimals: number }>
  loading: boolean
  requiresAuth?: boolean
}

enum BorrowStep {
  SELECT_TOKEN = 1,
  ENTER_AMOUNT = 2,
  CHOOSE_SECURITY = 3,
  CONFIRM = 4,
}

export function BorrowMoneyModal({
  isOpen,
  onClose,
  onBorrow,
  onDepositCollateral,
  userBalances,
  userCollaterals,
  tokenInfos,
  loading,
  requiresAuth = false,
}: BorrowMoneyModalProps) {
  const { toast } = useToast()
  const account = useActiveAccount()
  const router = useRouter()

  const contract = getContract({
    client,
    chain: celo,
    address: MINILEND_ADDRESS,
  })

  // Valid collateral assets from deployment config
  const SUPPORTED_COLLATERAL = useMemo(
    () => [
      "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
      "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
      "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
    ],
    [],
  )

  // cKES and cNGN available for borrowing
  const SUPPORTED_STABLECOINS = useMemo(() => {
    return [
      "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", // cKES
      "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71", // cNGN
    ]
  }, [])

  const [currentStep, setCurrentStep] = useState<BorrowStep>(BorrowStep.SELECT_TOKEN)
  const [form, setForm] = useState({
    token: "",
    collateralToken: "",
    amount: "",
  })

  const [requiredCollateral, setRequiredCollateral] = useState<string | null>(null)
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)
  const [fetchingRate, setFetchingRate] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showOnrampModal, setShowOnrampModal] = useState(false)

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(BorrowStep.SELECT_TOKEN)
      setForm({ token: "", collateralToken: "", amount: "" })
      setRequiredCollateral(null)
      setExchangeRate(null)
      setTransactionStatus(null)
    }
  }, [isOpen])

  // Calculate required collateral using oracle price data when amount/tokens change
  useEffect(() => {
    const updateCollateralRequirement = async () => {
      if (form.token && form.collateralToken && form.amount && Number(form.amount) > 0) {
        setFetchingRate(true)
        try {
          const result = await calculateRequiredCollateral(
            form.token,
            form.collateralToken,
            form.amount,
            1.5 // 150% collateralization ratio
          )
          
          if (result) {
            setRequiredCollateral(result.amount)
            setExchangeRate(result.rate)
          } else {
            // Fallback to fixed ratio if oracle data is unavailable
            const amountValue = Number(form.amount)
            setRequiredCollateral((amountValue * 1.5).toFixed(4))
            setExchangeRate(null)
          }
        } catch (error) {
          console.error("Error calculating collateral:", error)
          // Fallback to fixed ratio
          const amountValue = Number(form.amount)
          setRequiredCollateral((amountValue * 1.5).toFixed(4))
          setExchangeRate(null)
        } finally {
          setFetchingRate(false)
        }
      } else {
        setRequiredCollateral(null)
        setExchangeRate(null)
      }
    }

    updateCollateralRequirement()
  }, [form.token, form.collateralToken, form.amount])

  const hasCollateral = (token: string) => {
    const collateral = userCollaterals[token]
    return collateral && collateral !== "0"
  }

  const hasSufficientCollateral = (token: string, required: string) => {
    if (!hasCollateral(token)) return false
    const available = Number.parseFloat(formatAmount(userCollaterals[token], tokenInfos[token]?.decimals || 18))
    return available >= Number.parseFloat(required)
  }

  // Check if borrowing is paused for token
  const { data: isBorrowingPaused, isPending: checkingBorrowingStatus } = useReadContract({
    contract,
    method: "function isBorrowingPaused(address) view returns (bool)",
    params: [form.token || "0x0000000000000000000000000000000000000000"],
    queryOptions: {
      enabled: !!form.token,
      retry: 2,
    },
  })

  // Get total supply to check liquidity
  const { data: totalSupply, isPending: checkingLiquidity } = useReadContract({
    contract,
    method: "function totalSupply(address) view returns (uint256)",
    params: [form.token || "0x0000000000000000000000000000000000000000"],
    queryOptions: {
      enabled: !!form.token,
      retry: 2,
    },
  })

  // Get total borrows to calculate available liquidity
  const { data: totalBorrows, isPending: checkingBorrows } = useReadContract({
    contract, 
    method: "function totalBorrows(address) view returns (uint256)",
    params: [form.token || "0x0000000000000000000000000000000000000000"],
    queryOptions: {
      enabled: !!form.token,
      retry: 2,
    },
  })

  // Calculate available liquidity
  const selectedTokenLiquidity = useMemo(() => {
    if (!form.token || checkingLiquidity || checkingBorrows) return null
    if (!totalSupply) return "0"
    
    const borrowsAmount = totalBorrows || BigInt(0)
    const availableLiquidity = totalSupply > borrowsAmount ? totalSupply - borrowsAmount : BigInt(0)
    
    if (availableLiquidity <= 0) return "0"
    
    const decimals = tokenInfos[form.token]?.decimals || 18
    return formatAmount(availableLiquidity.toString(), decimals)
  }, [form.token, totalSupply, totalBorrows, tokenInfos, checkingLiquidity, checkingBorrows])

  // Balances for auto-wrap support when depositing collateral in CELO
  const { data: collateralTokenBalance } = useWalletBalance({
    client,
    chain: celo,
    address: account?.address,
    tokenAddress: form.collateralToken || undefined,
  })
  
  const { data: nativeBalanceData } = useWalletBalance({
    client,
    chain: celo,
    address: account?.address,
  })

  // Force refresh of rates
  const refreshExchangeRate = async () => {
    if (form.token && form.collateralToken && form.amount && Number(form.amount) > 0) {
      setFetchingRate(true)
      try {
        const result = await calculateRequiredCollateral(
          form.token,
          form.collateralToken, 
          form.amount,
          1.5
        )
        
                  if (result) {
            setRequiredCollateral(result.amount)
            setExchangeRate(result.rate)
          }
      } catch (error) {
        console.error("Failed to refresh rates:", error instanceof Error ? error.message.replace(/[\r\n]/g, ' ') : 'Unknown error')
        setTransactionStatus("Could not update market rates. Using previous values.")
      } finally {
        setFetchingRate(false)
      }
    }
  }

  const handleBorrowWithCollateral = async () => {
    if (!form.token || !form.collateralToken || !form.amount || !requiredCollateral) return
    
    if (requiresAuth) {
      alert('Please sign in to complete this transaction')
      return
    }
    
    if (!account) return

    if (isBorrowingPaused) {
      setTransactionStatus(`Borrowing ${tokenInfos[form.token]?.symbol} is currently paused. Please try again later or select another token.`)
      return
    }

    if (selectedTokenLiquidity === "0") {
      setTransactionStatus(`There are no funds available for ${tokenInfos[form.token]?.symbol}. Please try again later.`)
      return
    }

    setIsProcessing(true)
    setTransactionStatus("Processing your request...")

    try {
      // Check if user has sufficient collateral
      if (!hasSufficientCollateral(form.collateralToken, requiredCollateral)) {
        setTransactionStatus("Securing your loan...")
        const decimals = tokenInfos[form.collateralToken]?.decimals || 18
        const walletBalance = Number.parseFloat(formatAmount(userBalances[form.collateralToken] || "0", decimals))
        const CELO_ERC20 = "0x471EcE3750Da237f93B8E339c536989b8978a438"
        const required = Number.parseFloat(requiredCollateral)

        // Auto-wrap native CELO to ERC-20 if collateral is CELO and ERC-20 balance is short
        if (form.collateralToken === CELO_ERC20 && walletBalance < required) {
          const nativeBal = Number.parseFloat(nativeBalanceData?.displayValue || "0")
          const amountToWrap = Math.min(required - walletBalance, nativeBal)
          if (amountToWrap > 0) {
            setTransactionStatus("Converting CELO for collateral...")
            const celoContract = getContract({ client, chain: celo, address: CELO_ERC20 })
            const wrapTx = prepareContractCall({
              contract: celoContract,
              method: "function deposit()",
              params: [],
              value: parseUnits(amountToWrap.toString(), 18),
            })
            
            const wrapResult = await sendTransaction({ transaction: wrapTx, account })
            if (wrapResult?.transactionHash) {
              setTransactionStatus("Waiting for CELO conversion...")
              await waitForReceipt({ client, chain: celo, transactionHash: wrapResult.transactionHash })
              setTransactionStatus("CELO converted successfully ✓")
            }
          }
        }

        // Re-check balance after potential wrap
        const updatedBalance = Number.parseFloat(formatAmount(userBalances[form.collateralToken] || "0", decimals))
        if (updatedBalance < required) {
          throw new Error(
            `You need ${requiredCollateral} ${tokenInfos[form.collateralToken]?.symbol} but only have ${updatedBalance.toFixed(4)}.`,
          )
        }

        // Deposit collateral using thirdweb contract call
        setTransactionStatus("Adding security...")
        const amount = parseUnits(requiredCollateral, tokenInfos[form.collateralToken]?.decimals || 18)
        
        // Prepare ERC20 approval
        const tokenContract = getContract({
          client,
          chain: celo,
          address: form.collateralToken
        })
        
        const allowanceTx = prepareContractCall({
          contract: tokenContract,
          method: "function approve(address spender, uint256 amount)",
          params: [MINILEND_ADDRESS, amount]
        })
        
        // Execute approval transaction
        setTransactionStatus("Approving collateral use...")
        const allowanceResult = await sendTransaction({ transaction: allowanceTx, account })
        if (allowanceResult?.transactionHash) {
          await waitForReceipt({ client, chain: celo, transactionHash: allowanceResult.transactionHash })
        }
        
        // Prepare deposit collateral transaction
        const depositTx = prepareContractCall({
          contract,
          method: "function depositCollateral(address token, uint256 amount)",
          params: [form.collateralToken, amount],
        })
        
        // Execute deposit transaction
        setTransactionStatus("Depositing your security...")
        const depositResult = await sendTransaction({ transaction: depositTx, account })
        if (depositResult?.transactionHash) {
          await waitForReceipt({ client, chain: celo, transactionHash: depositResult.transactionHash })
          
          // Report collateral deposit transaction to Divvi
          reportTransactionToDivvi(depositResult.transactionHash, celo.id)
            .then(() => console.log("[BorrowMoneyModal] Reported collateral deposit to Divvi:", depositResult.transactionHash))
            .catch(error => console.error("[BorrowMoneyModal] Error reporting to Divvi:", error))
        }
        
        setTransactionStatus("Security added ✓")
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      // Execute borrow transaction
      setTransactionStatus("Getting your cash...")
      const borrowAmount = parseUnits(form.amount, tokenInfos[form.token]?.decimals || 18)
      

      const borrowTx = prepareContractCall({
        contract,
        method: "function borrow(address token, uint256 amount, address collateralToken)",
        params: [form.token, borrowAmount, form.collateralToken],
      })
      
      const borrowResult = await sendTransaction({ transaction: borrowTx, account })
      if (borrowResult?.transactionHash) {
        setTransactionStatus("Processing transaction...")
        await waitForReceipt({ client, chain: celo, transactionHash: borrowResult.transactionHash })
        
        // Report borrow transaction to Divvi
        reportTransactionToDivvi(borrowResult.transactionHash, celo.id)
          .then(() => console.log("[BorrowMoneyModal] Reported borrow transaction to Divvi:", borrowResult.transactionHash))
          .catch(error => console.error("[BorrowMoneyModal] Error reporting to Divvi:", error))
      }

      setTransactionStatus("Cash sent to your wallet ✓")
      
      // Instead of automatically closing, update status with instructions
      setTimeout(() => {
        setTransactionStatus(
          `${form.amount} ${tokenInfos[form.token]?.symbol} has been sent to your wallet.\n\nPlease check your wallet to confirm receipt and visit the dashboard to view your outstanding loans.`
        )
        
        // Don't automatically close - let the user close the modal when ready
      }, 2000)
    } catch (error: any) {
      setTransactionStatus("Something went wrong")

      if (error.message?.includes("insufficient reserves") || error.message?.includes("E5")) {
        setTransactionStatus("Not enough funds available. Please try a smaller amount.")
      } else {
        setTransactionStatus(error.message || "Failed to process your request")
      }

      setTimeout(() => setTransactionStatus(null), 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  const goToNextStep = () => {
    if (currentStep < BorrowStep.CONFIRM) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goToPreviousStep = () => {
    if (currentStep > BorrowStep.SELECT_TOKEN) {
      setCurrentStep(currentStep - 1)
    }
  }

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case BorrowStep.SELECT_TOKEN:
        return !!form.token && selectedTokenLiquidity !== "0" && !isBorrowingPaused
      case BorrowStep.ENTER_AMOUNT:
        return !!form.amount && Number.parseFloat(form.amount) > 0
      case BorrowStep.CHOOSE_SECURITY:
        return !!form.collateralToken
      case BorrowStep.CONFIRM:
        return !!requiredCollateral && !fetchingRate
      default:
        return false
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case BorrowStep.SELECT_TOKEN:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-white">What do you need?</h3>
              <p className="text-sm text-[#a2c398]">Choose the currency you'd like to borrow</p>
            </div>

            <div className="space-y-3">
              {SUPPORTED_STABLECOINS.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-[#a2c398] mx-auto mb-3" />
                  <p className="text-[#a2c398]">No currencies available right now</p>
                </div>
              ) : (
                SUPPORTED_STABLECOINS.map((token) => {
                  const tokenInfo = tokenInfos[token]
                  const symbol = tokenInfo?.symbol || token.slice(0, 6) + "..."
                  const isSelected = form.token === token

                  return (
                    <button
                      key={token}
                      onClick={() => setForm({ ...form, token: token })}
                      className={`w-full p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-[#54d22d] bg-[#21301c]"
                          : "border-[#426039] bg-[#2e4328] hover:border-[#54d22d]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {getTokenIcon(symbol).startsWith("http") || getTokenIcon(symbol).startsWith("/") ? (
                          <img
                            src={getTokenIcon(symbol) || "/placeholder.svg"}
                            alt={symbol}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#54d22d] flex items-center justify-center text-[#162013] font-bold">
                            {symbol.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-white">{symbol}</div>
                          {checkingLiquidity || checkingBorrows ? (
                            <div className="text-xs text-[#a2c398]">Checking availability...</div>
                          ) : isBorrowingPaused ? (
                            <div className="text-xs text-red-400">Currently paused</div>
                          ) : selectedTokenLiquidity === "0" ? (
                            <div className="text-xs text-red-400">Not available</div>
                          ) : selectedTokenLiquidity && isSelected ? (
                            <div className="text-xs text-[#54d22d]">Available: {selectedTokenLiquidity}</div>
                          ) : (
                            <div className="text-xs text-[#a2c398]">Tap to select</div>
                          )}
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-[#54d22d]" />}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )

      case BorrowStep.ENTER_AMOUNT:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-white">How much do you need?</h3>
              <p className="text-sm text-[#a2c398]">Enter the amount you'd like to borrow</p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="h-16 text-2xl text-center bg-[#2e4328] border-[#426039] text-white placeholder:text-[#a2c398] focus:border-[#54d22d]"
                  min="0.01"
                  step="0.01"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a2c398] font-medium">
                  {tokenInfos[form.token]?.symbol}
                </div>
              </div>

              {selectedTokenLiquidity && (
                <div className="text-center text-sm text-[#a2c398]">
                  Available to borrow: {selectedTokenLiquidity} {tokenInfos[form.token]?.symbol}
                </div>
              )}
            </div>
          </div>
        )

      case BorrowStep.CHOOSE_SECURITY:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-white">Choose your security</h3>
              <p className="text-sm text-[#a2c398]">Select what you'll use to secure this loan</p>
            </div>

            <div className="space-y-3">
              {SUPPORTED_COLLATERAL.map((token) => {
                const tokenInfo = tokenInfos[token]
                const symbol = tokenInfo?.symbol || token.slice(0, 6) + "..."
                const isSelected = form.collateralToken === token
                const balance = formatAmount(userBalances[token] || "0", tokenInfo?.decimals || 18)

                return (
                  <button
                    key={token}
                    onClick={() => setForm({ ...form, collateralToken: token })}
                    className={`w-full p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-[#54d22d] bg-[#21301c]"
                        : "border-[#426039] bg-[#2e4328] hover:border-[#54d22d]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {getTokenIcon(symbol).startsWith("http") || getTokenIcon(symbol).startsWith("/") ? (
                        <img
                          src={getTokenIcon(symbol) || "/placeholder.svg"}
                          alt={symbol}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#54d22d] flex items-center justify-center text-[#162013] font-bold">
                          {symbol.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-white">{symbol}</div>
                        <div className="text-xs text-[#a2c398]">
                          Balance: {balance} {symbol}
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-[#54d22d]" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )

      case BorrowStep.CONFIRM:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-white">Confirm your loan</h3>
              <p className="text-sm text-[#a2c398]">Review the details before proceeding</p>
            </div>

            <div className="space-y-4">
              <div className="bg-[#2e4328] rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#a2c398]">You'll receive</span>
                  <span className="text-white font-semibold">
                    {form.amount} {tokenInfos[form.token]?.symbol}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#a2c398]">Security required</span>
                  <div className="text-right">
                    <span className="text-white font-semibold">
                      {fetchingRate ? "Calculating..." : requiredCollateral} {tokenInfos[form.collateralToken]?.symbol}
                    </span>
                    <button 
                      onClick={refreshExchangeRate}
                      disabled={fetchingRate || !form.token || !form.collateralToken || !form.amount}
                      className="ml-2 p-1 rounded-full hover:bg-[#426039] text-[#a2c398] hover:text-white"
                    >
                      <RefreshCw className={`w-4 h-4 ${fetchingRate ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>
                
                {exchangeRate && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#a2c398]">Current exchange rate</span>
                    <span className="text-[#a2c398]">
                      1 {tokenInfos[form.collateralToken]?.symbol} = {(1/exchangeRate).toFixed(4)} {tokenInfos[form.token]?.symbol}
                    </span>
                  </div>
                )}

                {form.collateralToken &&
                  requiredCollateral &&
                  (() => {
                    // Check wallet balance and compare against required collateral
                    const decimals = tokenInfos[form.collateralToken]?.decimals || 18;
                    const walletBalance = Number.parseFloat(formatAmount(userBalances[form.collateralToken] || "0", decimals));
                    const requiredAmount = Number.parseFloat(requiredCollateral);
                    
                    // Only show the "Get more" section if wallet balance is insufficient
                    return walletBalance < requiredAmount ? (
                      <div className="border-t border-[#426039] pt-3">
                        <div className="text-xs text-[#a2c398] mb-2">
                          You need more {tokenInfos[form.collateralToken]?.symbol}
                        </div>
                        {onrampService.isAssetSupportedForOnramp(tokenInfos[form.collateralToken]?.symbol || "") && (
                          <Button
                            onClick={() => setShowOnrampModal(true)}
                            variant="outline"
                            size="sm"
                            className="w-full bg-[#54d22d] text-[#162013] border-[#54d22d] hover:bg-[#4bc226]"
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            Get {tokenInfos[form.collateralToken]?.symbol}
                          </Button>
                        )}
                      </div>
                    ) : null;
                  })()}
              </div>

              {transactionStatus && (
                <div className="bg-[#21301c] border border-[#54d22d] rounded-xl p-4">
                  <div className="text-sm text-[#54d22d] font-medium text-center" style={{ whiteSpace: 'pre-line' }}>{transactionStatus}</div>
                  
                  {/* Show a "View Dashboard" button if transaction is complete */}
                  {transactionStatus.includes("check your wallet") && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        onClick={() => {
                          // Reset the form and close the modal
                          setForm({ token: "", collateralToken: "", amount: "" })
                          setTransactionStatus(null)
                          setCurrentStep(BorrowStep.SELECT_TOKEN)
                          onClose()
                          
                          // Use Next.js router to navigate to dashboard without page reload
                          // Make sure to leave some time for wallet to persist
                          setTimeout(() => router.push("/dashboard"), 300);
                        }}
                        className="bg-[#54d22d] text-[#162013] hover:bg-[#4bc226] font-semibold px-4 py-2 rounded"
                      >
                        View Dashboard
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-md mx-auto bg-[#162013] border-[#426039] shadow-2xl">
        <DialogHeader className="pb-6">
          <DialogTitle className="sr-only">Borrow Money</DialogTitle>
          <DialogDescription className="sr-only">
            Borrow stablecoins using your assets as collateral through a multi-step process.
          </DialogDescription>
          <div className="flex items-center gap-3">
            {currentStep > BorrowStep.SELECT_TOKEN && (
              <Button
                onClick={goToPreviousStep}
                variant="ghost"
                size="sm"
                className="p-2 text-[#a2c398] hover:text-white hover:bg-[#2e4328]"
                disabled={isProcessing}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-white">Get Cash</DialogTitle>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-1 flex-1 rounded-full ${step <= currentStep ? "bg-[#54d22d]" : "bg-[#426039]"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {renderStepContent()}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 bg-transparent border-[#426039] text-[#a2c398] hover:bg-[#2e4328] hover:text-white"
              disabled={isProcessing}
            >
              Cancel
            </Button>

            {currentStep < BorrowStep.CONFIRM ? (
              <Button
                onClick={goToNextStep}
                disabled={!canProceedToNextStep() || isProcessing}
                className="flex-1 bg-[#54d22d] text-[#162013] hover:bg-[#4bc226] font-semibold"
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleBorrowWithCollateral}
                disabled={
                  isProcessing ||
                  !form.token ||
                  !form.collateralToken ||
                  !form.amount ||
                  !requiredCollateral ||
                  selectedTokenLiquidity === "0" ||
                  checkingLiquidity ||
                  isBorrowingPaused ||
                  fetchingRate ||
                  // Disable button if transaction is complete and showing final message
                  transactionStatus?.includes("check your wallet")
                }
                className="flex-1 bg-[#54d22d] text-[#162013] hover:bg-[#4bc226] font-semibold"
              >
                {isProcessing ? "Processing..." : "Get Cash"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {showOnrampModal && (
        <OnrampDepositModal
          isOpen={showOnrampModal}
          onClose={() => setShowOnrampModal(false)}
          selectedAsset={tokenInfos[form.collateralToken]?.symbol || ""}
          assetSymbol={tokenInfos[form.collateralToken]?.symbol || ""}
          onSuccess={(transactionCode, amount) => {
            setTransactionStatus(`${tokenInfos[form.collateralToken]?.symbol} deposit initiated. Funds will appear in your wallet soon.`)
            setShowOnrampModal(false)
            
            // Clear message after a few seconds
            setTimeout(() => {
              setTransactionStatus(null)
            }, 4000)
          }}
        />
      )}
    </Dialog>
  )
}

// This helper function is no longer needed as we're using transaction status directly