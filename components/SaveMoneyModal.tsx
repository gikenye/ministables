"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ArrowLeft, Check, AlertCircle, Loader2, Plus } from "lucide-react"
import { useActiveAccount, useSendTransaction, useWalletBalance } from "thirdweb/react"
import { OnrampDepositModal } from "./OnrampDepositModal"
import { onrampService } from "@/lib/services/onrampService"

// Define the minilend contract ABI for deposit function
export const minilendABI = [
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "lockPeriod", type: "uint256" },
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const

import { getContract, prepareContractCall, type PreparedTransaction, waitForReceipt } from "thirdweb"
import { getApprovalForTransaction } from "thirdweb/extensions/erc20"
import { client } from "@/lib/thirdweb/client"
import { celo } from "thirdweb/chains"
import { getTokenIcon } from "@/lib/utils/tokenIcons"
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService"
import { parseUnits } from "viem"

interface SaveMoneyModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (token: string, amount: string, lockPeriod: number) => Promise<void>
  userBalances?: Record<string, string>
  tokenInfos: Record<string, { symbol: string; decimals: number }>
  loading?: boolean
}

export function SaveMoneyModal({
  isOpen,
  onClose,
  onSave,
  userBalances,
  tokenInfos,
  loading = false,
}: SaveMoneyModalProps) {
  const account = useActiveAccount()

  const supportedStablecoins = Object.keys(tokenInfos)
  const [currentStep, setCurrentStep] = useState(1)
  const [form, setForm] = useState({
    token: "",
    amount: "",
    lockPeriod: "2592000", // 30 days default
  })

  const [error, setError] = useState<string | null>(null)
  const [showOnrampModal, setShowOnrampModal] = useState(false)
  const [selectedTokenForOnramp, setSelectedTokenForOnramp] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Use the working setup's wallet balance hook
  const { data: walletBalanceData, isLoading: isBalanceLoading } = useWalletBalance({
    client,
    chain: celo,
    address: account?.address,
    tokenAddress: form.token || undefined,
  })

  // Use the working setup's transaction hook
  const { mutateAsync: sendTransaction, isPending: isTransactionPending } = useSendTransaction({ payModal: false })

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setError(null)
      setIsSaving(false)
    }
  }, [isOpen])

  const prepareDepositTransaction = async () => {
    if (!form.token || !form.amount || !form.lockPeriod || !account) {
      throw new Error("Missing required parameters")
    }

    console.log("[SaveMoneyModal] Starting save with params:", {
      tokenAddress: form.token,
      tokenSymbol: tokenInfos[form.token]?.symbol,
      amount: form.amount,
      lockPeriod: form.lockPeriod,
      MINILEND_ADDRESS
    })

    const decimals = tokenInfos[form.token]?.decimals || 18
    const amountWei = parseUnits(form.amount, decimals)

    console.log("[SaveMoneyModal] Calculated wei amount:", {
      inputAmount: form.amount,
      decimals,
      amountWei: amountWei.toString()
    })

    // Create Minilend contract instance
    console.log("[SaveMoneyModal] Creating Minilend contract instance with address:", MINILEND_ADDRESS)
    const minilendContract = getContract({
      client,
      chain: celo,
      address: MINILEND_ADDRESS,
      abi: minilendABI,
    })

    // Prepare deposit transaction
    console.log("[SaveMoneyModal] Preparing deposit transaction with params:", {
      token: form.token,
      amount: amountWei.toString(),
      lockPeriod: form.lockPeriod
    })

    const depositTx = prepareContractCall({
      contract: minilendContract,
      method: "deposit",
      params: [
        form.token,
        amountWei,
        BigInt(parseInt(form.lockPeriod)),
      ],
      erc20Value: {
        tokenAddress: form.token,
        amountWei,
      },
    })

    return depositTx
  }

  const handleTransactionError = (error: Error) => {
    console.error("[SaveMoneyModal] Transaction error:", error)

    let userMessage = "Transaction failed. Please try again."

    if (error.message.includes("TransactionError: Error - E3")) {
      const currentSymbol = tokenInfos[form.token]?.symbol || "selected asset"
      userMessage = `There was an issue processing ${currentSymbol}. Please select a different deposit asset and try again.`
      setCurrentStep(1)
    } else if (error.message.includes("receipt not found")) {
      userMessage =
        "Transaction is taking longer than expected. It may still complete successfully. Please check your wallet or try again."
    } else if (error.message.includes("user rejected") || error.message.includes("User rejected")) {
      userMessage = "Transaction was cancelled."
    } else if (error.message.includes("insufficient funds")) {
      userMessage = "Insufficient funds for this transaction."
    } else if (error.message.includes("transfer amount exceeds allowance")) {
      userMessage = "Token approval failed. Please try again."
    } else if (error.message.includes("network")) {
      userMessage = "Network error. Please check your connection and try again."
    }

    setError(userMessage)
  }

  const handleTransactionSuccess = (receipt: any, isApproval: boolean = false) => {
    console.log("[SaveMoneyModal] Transaction successful:", receipt)

    if (!isApproval) {
      setForm({
        token: "",
        amount: "",
        lockPeriod: "2592000",
      })
      onClose()
    }
  }

  const handleTransactionSent = (result: any, isApproval: boolean = false) => {
    console.log("[SaveMoneyModal] Transaction sent:", result)
  }

  const handleSave = async () => {
    if (!form.token || !form.amount || !form.lockPeriod) return
    if (!account) {
      setError("Please connect your wallet first")
      return
    }

    // Validate balance
    const erc20Balance = parseFloat(walletBalanceData?.displayValue || "0")
    const inputAmount = parseFloat(form.amount)
    if (inputAmount > erc20Balance) {
      setError(`Amount exceeds available balance of ${erc20Balance} ${walletBalanceData?.symbol || ""}`)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const depositTx = await prepareDepositTransaction()
      
      // Check if approval is needed and handle it
      console.log("[SaveMoneyModal] Checking if approval is needed for deposit transaction")
      const approveTx = await getApprovalForTransaction({
        transaction: depositTx as PreparedTransaction,
        account,
      })
      
      if (approveTx) {
        console.log("[SaveMoneyModal] Approval required, sending approval transaction")
        const approveResult = await sendTransaction(approveTx)
        console.log("[SaveMoneyModal] Approval transaction submitted:", approveResult?.transactionHash)
        
        handleTransactionSent(approveResult, true)
        
        if (approveResult?.transactionHash) {
          console.log("[SaveMoneyModal] Waiting for approval confirmation...")
          const approvalReceipt = await waitForReceipt({
            client,
            chain: celo,
            transactionHash: approveResult.transactionHash,
          })
          handleTransactionSuccess(approvalReceipt, true)
        }
      } else {
        console.log("[SaveMoneyModal] No approval needed, proceeding with deposit")
      }
      
      // Execute deposit transaction
      console.log("[SaveMoneyModal] Sending deposit transaction")
      const depositResult = await sendTransaction(depositTx)
      console.log("[SaveMoneyModal] Deposit result:", depositResult)
      
      handleTransactionSent(depositResult, false)
      
      if (depositResult?.transactionHash) {
        console.log("[SaveMoneyModal] Deposit transaction submitted with hash:", depositResult.transactionHash)
        // Wait for deposit confirmation
        const depositReceipt = await waitForReceipt({
          client,
          chain: celo,
          transactionHash: depositResult.transactionHash,
        })
        handleTransactionSuccess(depositReceipt, false)
      }

    } catch (err: any) {
      handleTransactionError(err)
    } finally {
      setIsSaving(false)
    }
  }

  const getLockPeriodText = (seconds: string) => {
    const totalSeconds = Number.parseInt(seconds)
    if (totalSeconds < 3600) {
      return `${totalSeconds} seconds`
    } else if (totalSeconds < 86400) {
      const hours = Math.floor(totalSeconds / 3600)
      return `${hours} hours`
    } else {
      const days = totalSeconds / 86400
      return `${days} days`
    }
  }

  const defaultLockPeriods = ["604800", "2592000", "7776000", "15552000"] // 7 days, 30, 90, 180 days

  const walletBalance = parseFloat(walletBalanceData?.displayValue || "0")

  const formatDisplayNumber = (value: number): string => {
    if (!isFinite(value)) return "0.0000"
    return value.toFixed(4)
  }

  const setAmountByPercent = (ratio: number) => {
    if (!walletBalance || walletBalance <= 0) return
    const raw = walletBalance * ratio
    const value = formatDisplayNumber(raw)
    setForm({ ...form, amount: value })
  }

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 2:
        return form.token !== ""
      case 3:
        return form.token !== "" && form.amount !== ""
      case 4:
        return form.token !== "" && form.amount !== "" && form.lockPeriod !== ""
      default:
        return true
    }
  }

  const nextStep = () => {
    if (currentStep < 4 && canProceedToStep(currentStep + 1)) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const getAPY = (period: string) => {
    switch (period) {
      case "604800":
        return "2%"
      case "2592000":
        return "5%"
      case "7776000":
        return "8%"
      case "15552000":
        return "12%"
      default:
        return "5%"
    }
  }

  const handleOnrampSuccess = (transactionCode: string, amount: number) => {
    setShowOnrampModal(false)
    // Optionally set the token and continue to amount step
    setForm((prev) => ({ ...prev, token: selectedTokenForOnramp }))
    setCurrentStep(2)
  }

  const hasZeroBalance = () => {
    if (isBalanceLoading || !form.token) return false
    return walletBalance === 0
  }

  const isAssetSupportedForOnramp = (tokenAddress: string) => {
    try {
      const tokenSymbol = tokenInfos[tokenAddress]?.symbol
      if (!tokenSymbol) return false

      const chainName = "CELO" // Chain name string, not chain object
      return onrampService.isAssetSupportedForOnramp(tokenSymbol, chainName)
    } catch (error) {
      console.error("Error checking onramp support:", error)
      return false
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md mx-auto bg-[#162013] border-0 shadow-lg p-0 overflow-hidden">
        <div className="flex h-5 w-full items-center justify-center bg-[#162013]">
          <div className="h-1 w-9 rounded-full bg-[#426039]"></div>
        </div>

        <div className="px-4 pb-5">
          <DialogTitle className="sr-only">Start Earning</DialogTitle>
          <DialogDescription className="sr-only">
            Start earning by choosing a token, entering an amount, selecting a lock period, and confirming your deposit.
          </DialogDescription>
          <div className="flex items-center justify-between pt-5 pb-3">
            {currentStep > 1 && (
              <button onClick={prevStep} className="p-1 text-[#a2c398] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 text-center">
              <h1 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">Select Asset</h1>
              <div className="flex justify-center gap-2 mt-2">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`min-w-8 h-7 px-2 inline-flex items-center justify-center rounded-md text-sm font-semibold transition-colors ${
                      step === currentStep
                        ? "bg-[#54d22d] text-[#162013]"
                        : step < currentStep
                        ? "bg-[#2e4328] text-white"
                        : "bg-[#21301c] text-[#a2c398] border border-[#426039]"
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
            {currentStep > 1 && <div className="w-7" />}
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-700 text-red-300 p-3 rounded-xl text-sm mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!account && (
            <div className="bg-yellow-900/20 border border-yellow-700 text-yellow-300 p-3 rounded-xl text-sm mb-4">
              Connect wallet to continue
            </div>
          )}

          <div className="min-h-[300px]">
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">Choose your token</h3>
                  <p className="text-[#a2c398] text-sm">Select which token you'd like to deposit</p>
                </div>

                <div className="space-y-2">
                  {supportedStablecoins.map((token) => {
                    const symbol = tokenInfos[token]?.symbol || "Unknown"
                    const isSelected = form.token === token
                    const showBalance = isSelected && !isBalanceLoading
                    const zeroBalance = isSelected && hasZeroBalance()

                    const onrampSupported = isAssetSupportedForOnramp(token)

                    return (
                      <div key={token} className="w-full">
                        <div
                          className={`w-full rounded-xl border transition-all ${
                            isSelected
                              ? "bg-[#54d22d] text-[#162013] border-[#54d22d]"
                              : "bg-[#21301c] text-white border-[#426039] hover:border-[#54d22d] hover:bg-[#2a3d24]"
                          }`}
                        >
                          <div className="flex items-center gap-3 p-3">
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, token })}
                              className="flex items-center gap-3 flex-1 text-left"
                            >
                              {getTokenIcon(symbol).startsWith("http") ? (
                                <img
                                  src={getTokenIcon(symbol) || "/placeholder.svg"}
                                  alt={symbol}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <span className="text-2xl">{getTokenIcon(symbol)}</span>
                              )}
                              <div className="flex-1">
                                <div className="font-medium">{symbol}</div>
                                {isSelected && (
                                  <div className={`text-sm ${isSelected ? "text-[#162013]/70" : "text-[#a2c398]"}`}>
                                    {isBalanceLoading ? (
                                      <span className="flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Loading...
                                      </span>
                                    ) : (
                                      `Balance: ${formatDisplayNumber(walletBalance)}`
                                    )}
                                  </div>
                                )}
                              </div>
                              {isSelected && <Check className="w-5 h-5 ml-auto" />}
                            </button>
                          </div>

                          {isSelected && (
                            <div className={`px-3 pb-3 ${isSelected ? "text-[#162013]" : "text-white"}`}>
                              {zeroBalance ? (
                                onrampSupported ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setSelectedTokenForOnramp(token)
                                        setShowOnrampModal(true)
                                      }}
                                      className="flex-1 h-9 bg-[#162013] text-white text-xs font-medium rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-1 md:h-8"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Get {symbol}
                                    </button>
                                    <button
                                      onClick={nextStep}
                                      className="px-3 h-9 bg-transparent border border-current text-xs rounded-lg hover:opacity-80 transition-colors md:h-8"
                                    >
                                      Continue
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs opacity-80 flex-1">No {symbol} balance</span>
                                    <button
                                      onClick={nextStep}
                                      className="px-3 h-9 bg-transparent border border-current text-xs rounded-lg hover:opacity-80 transition-colors md:h-8"
                                    >
                                      Continue anyway
                                    </button>
                                  </div>
                                )
                              ) : (
                                showBalance && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={nextStep}
                                      className="w-full h-9 bg-[#162013] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-colors md:h-8"
                                    >
                                      Continue with {symbol}
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">How much?</h3>
                  <p className="text-[#a2c398] text-sm">
                    {isBalanceLoading ? (
                      <span className="flex items-center justify-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Loading balance...
                      </span>
                    ) : (
                      `Balance: ${formatDisplayNumber(walletBalance)} ${tokenInfos[form.token]?.symbol}`
                    )}
                  </p>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setForm({ ...form, amount: value })
                      }
                    }}
                    className="w-full h-16 rounded-xl text-white bg-[#21301c] border-2 border-[#426039] focus:border-[#54d22d] focus:outline-0 focus:ring-0 pl-4 pr-20 text-2xl font-medium text-center"
                    autoFocus
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a2c398] text-sm">
                    {tokenInfos[form.token]?.symbol}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setAmountByPercent(0.25)}
                    className="h-10 bg-[#2e4328] text-white text-sm rounded-lg hover:bg-[#3a5533] transition-colors"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountByPercent(0.5)}
                    className="h-10 bg-[#2e4328] text-white text-sm rounded-lg hover:bg-[#3a5533] transition-colors"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountByPercent(0.75)}
                    className="h-10 bg-[#2e4328] text-white text-sm rounded-lg hover:bg-[#3a5533] transition-colors"
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const maxAmount = formatDisplayNumber(walletBalance)
                      setForm({ ...form, amount: maxAmount })
                    }}
                    className="h-10 bg-[#54d22d] text-[#162013] text-sm font-medium rounded-lg hover:bg-[#4bc428] transition-colors"
                  >
                    Max
                  </button>
                </div>

                <button
                  onClick={nextStep}
                  disabled={!form.amount}
                  className="w-full h-12 bg-[#54d22d] text-[#162013] text-base font-bold rounded-xl hover:bg-[#4bc428] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">Lock period</h3>
                  <p className="text-[#a2c398] text-sm">Longer = higher rewards</p>
                </div>

                <div className="space-y-3">
                  {defaultLockPeriods.map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, lockPeriod: period })
                        setTimeout(nextStep, 300)
                      }}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border ${
                        form.lockPeriod === period
                          ? "bg-[#54d22d] text-[#162013] border-[#54d22d] scale-[0.98]"
                          : "bg-[#21301c] text-white border-[#426039] hover:border-[#54d22d] hover:bg-[#2a3d24]"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-left">{getLockPeriodText(period)}</div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-lg font-bold ${
                            form.lockPeriod === period ? "text-[#162013]" : "text-[#54d22d]"
                          }`}
                        >
                          {getAPY(period)}
                        </div>
                        <div
                          className={`text-xs ${form.lockPeriod === period ? "text-[#162013]/70" : "text-[#a2c398]"}`}
                        >
                          APY
                        </div>
                      </div>
                      {form.lockPeriod === period && <Check className="w-5 h-5 ml-2" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">Ready to earn</h3>
                  <p className="text-[#a2c398] text-sm">Review your deposit</p>
                </div>

                <div className="bg-[#21301c] rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#a2c398]">Depositing</span>
                    <div className="text-right">
                      <div className="text-white font-medium">{form.amount}</div>
                      <div className="text-[#a2c398] text-sm">{tokenInfos[form.token]?.symbol}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#a2c398]">Lock period</span>
                    <div className="text-white font-medium">{getLockPeriodText(form.lockPeriod)}</div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#426039]">
                    <span className="text-[#a2c398]">You'll earn</span>
                    <div className="text-right">
                      <div className="text-[#54d22d] font-bold text-lg">{getAPY(form.lockPeriod)}</div>
                      <div className="text-[#a2c398] text-sm">APY</div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!account || !form.token || !form.amount || !form.lockPeriod || isSaving || isTransactionPending}
                  className="w-full h-12 bg-[#54d22d] text-[#162013] text-base font-bold rounded-xl hover:bg-[#4bc428] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving || isTransactionPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    "Start Earning"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <OnrampDepositModal
          isOpen={showOnrampModal}
          onClose={() => setShowOnrampModal(false)}
          selectedAsset={selectedTokenForOnramp}
          assetSymbol={tokenInfos[selectedTokenForOnramp]?.symbol || ""}
          onSuccess={handleOnrampSuccess}
        />
      </DialogContent>
    </Dialog>
  )
}