"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, AlertCircle, CreditCard, CheckCircle2 } from "lucide-react"
import { formatAmount } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { parseUnits } from "viem"
import { OnrampDepositModal } from "./OnrampDepositModal"
import { onrampService } from "@/lib/services/onrampService"
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService"
import { getTokenIcon } from "@/lib/utils/tokenIcons"
import { getContract, prepareContractCall, waitForReceipt } from "thirdweb"
import { client } from "@/lib/thirdweb/client"
import { celo } from "thirdweb/chains"

import { useActiveAccount, useSendTransaction, useReadContract, useWalletBalance } from "thirdweb/react"

interface BorrowMoneyModalProps {
  isOpen: boolean
  onClose: () => void
  onBorrow: (token: string, amount: string, collateralToken: string) => Promise<void>
  onDepositCollateral: (token: string, amount: string) => Promise<void>
  userBalances: Record<string, string>
  userCollaterals: Record<string, string>
  tokenInfos: Record<string, { symbol: string; decimals: number }>
  loading: boolean
}

// Constants
const COLLATERALIZATION_RATIO = 1.5 // 150% collateralization

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
}: BorrowMoneyModalProps) {
  const { toast } = useToast()
  const account = useActiveAccount()

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

  // Only cKES available for borrowing for now
  const SUPPORTED_STABLECOINS = useMemo(() => {
    return ["0x456a3D042C0DbD3db53D5489e98dFb038553B0d0"] // cKES only
  }, [])

  const [currentStep, setCurrentStep] = useState<BorrowStep>(BorrowStep.SELECT_TOKEN)
  const [form, setForm] = useState({
    token: "",
    collateralToken: "",
    amount: "",
  })

  const [requiredCollateral, setRequiredCollateral] = useState<string | null>(null)
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({})
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showOnrampModal, setShowOnrampModal] = useState(false)

  // Added step reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(BorrowStep.SELECT_TOKEN)
      setForm({ token: "", collateralToken: "", amount: "" })
      setTransactionStatus(null)
    }
  }, [isOpen])

  const hasCollateral = (token: string) => {
    const collateral = userCollaterals[token]
    return collateral && collateral !== "0"
  }

  const hasSufficientCollateral = (token: string, required: string) => {
    if (!hasCollateral(token)) return false
    const available = Number.parseFloat(formatAmount(userCollaterals[token], tokenInfos[token]?.decimals || 18))
    return available >= Number.parseFloat(required)
  }

  // Use same simplified logic as TVL - only fetch totalSupply to reduce requests
  const { data: totalSupply, isPending: checkingLiquidity } = useReadContract({
    contract,
    method: "function totalSupply(address) view returns (uint256)",
    params: [form.token || "0x0000000000000000000000000000000000000000"],
    queryOptions: {
      enabled: !!form.token,
      retry: 2,
    },
  })

  const selectedTokenLiquidity = useMemo(() => {
    if (!form.token || checkingLiquidity) return null
    if (!totalSupply || totalSupply <= 0) return "0"

    const decimals = tokenInfos[form.token]?.decimals || 18
    return formatAmount(totalSupply.toString(), decimals)
  }, [form.token, totalSupply, tokenInfos, checkingLiquidity])

  const { mutateAsync: sendTransaction, isPending: isTransactionPending } = useSendTransaction({ payModal: false })

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

  const handleBorrowWithCollateral = async () => {
    if (!form.token || !form.collateralToken || !form.amount || !requiredCollateral) return

    if (selectedTokenLiquidity === "0") {
      toast({
        title: "No Funds Available",
        description: `There are no funds available for ${tokenInfos[form.token]?.symbol}. Please try again later.`,
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    setTransactionStatus("Processing your request...")

    try {
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
            const celoContract = getContract({ client, chain: celo, address: CELO_ERC20 })
            const wrapTx = prepareContractCall({
              contract: celoContract,
              method: "function deposit()",
              params: [],
              value: parseUnits(amountToWrap.toString(), 18),
            })
            const wrapResult = await sendTransaction(wrapTx)
            if (wrapResult?.transactionHash) {
              await waitForReceipt({ client, chain: celo, transactionHash: wrapResult.transactionHash })
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

        setTransactionStatus("Adding security...")
        await onDepositCollateral(form.collateralToken, requiredCollateral)
        setTransactionStatus("Security added ✓")
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      setTransactionStatus("Getting your cash...")
      await onBorrow(form.token, form.amount, form.collateralToken)

      setTransactionStatus("Cash sent to your wallet ✓")
      toast({
        title: "Cash Ready!",
        description: `${form.amount} ${tokenInfos[form.token]?.symbol} is now in your wallet`,
      })

      setTimeout(() => {
        setForm({ token: "", collateralToken: "", amount: "" })
        setTransactionStatus(null)
        setCurrentStep(BorrowStep.SELECT_TOKEN)
        onClose()
      }, 2000)
    } catch (error: any) {
      setTransactionStatus("Something went wrong")

      if (error.message?.includes("insufficient reserves") || error.message?.includes("E5")) {
        toast({
          title: "Not Enough Funds",
          description: "We don't have enough funds for this amount. Please try a smaller amount.",
          variant: "destructive",
        })
      } else {
        handleTransactionError(error, toast, "Failed to process your request")
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
        return !!form.token && selectedTokenLiquidity !== "0"
      case BorrowStep.ENTER_AMOUNT:
        return !!form.amount && Number.parseFloat(form.amount) > 0
      case BorrowStep.CHOOSE_SECURITY:
        return !!form.collateralToken
      case BorrowStep.CONFIRM:
        return !!requiredCollateral
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
                          {checkingLiquidity ? (
                            <div className="text-xs text-[#a2c398]">Checking availability...</div>
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
                  <span className="text-white font-semibold">
                    {requiredCollateral} {tokenInfos[form.collateralToken]?.symbol}
                  </span>
                </div>

                {form.collateralToken &&
                  requiredCollateral &&
                  !hasSufficientCollateral(form.collateralToken, requiredCollateral) && (
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
                  )}
              </div>

              {transactionStatus && (
                <div className="bg-[#21301c] border border-[#54d22d] rounded-xl p-4">
                  <div className="text-sm text-[#54d22d] font-medium text-center">{transactionStatus}</div>
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
                  isTransactionPending ||
                  !form.token ||
                  !form.collateralToken ||
                  !form.amount ||
                  !requiredCollateral ||
                  selectedTokenLiquidity === "0" ||
                  checkingLiquidity
                }
                className="flex-1 bg-[#54d22d] text-[#162013] hover:bg-[#4bc226] font-semibold"
              >
                {isProcessing || isTransactionPending ? "Processing..." : "Get Cash"}
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
            toast({
              title: "Deposit Started",
              description: `${tokenInfos[form.collateralToken]?.symbol} is being added to your wallet`,
            })
            setShowOnrampModal(false)
          }}
        />
      )}
    </Dialog>
  )
}

// Error handling utility
const handleTransactionError = (error: any, toast: any, defaultMessage: string) => {
  console.error("Transaction error:", error)

  if (
    error.message?.includes("FILE_ERROR_NO_SPACE") ||
    error.message?.includes("QuotaExceededError") ||
    error.message?.includes("no space")
  ) {
    toast({
      title: "Storage Error",
      description: "Your device is running out of disk space. Please free up some space and try again.",
      variant: "destructive",
    })
  } else if (error.message?.includes("User rejected") || error.message?.includes("rejected the request")) {
    toast({
      title: "Transaction Cancelled",
      description: "You cancelled the transaction in your wallet.",
      variant: "default",
    })
  } else {
    toast({
      title: "Error",
      description: error.message || defaultMessage,
      variant: "destructive",
    })
  }
}
