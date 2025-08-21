"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ArrowLeft, Check, AlertCircle, Loader2, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useActiveAccount, TransactionButton } from "thirdweb/react"
import { OnrampDepositModal } from "./OnrampDepositModal"
import { onrampService } from "@/lib/services/onrampService" // Import onrampService

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
import { getContract, prepareContractCall, type PreparedTransaction } from "thirdweb"
import { getApprovalForTransaction } from "thirdweb/extensions/erc20"
import { client } from "@/lib/thirdweb/client"
import { celo } from "thirdweb/chains"
import { getTokenIcon } from "@/lib/utils/tokenIcons"
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService"
import { parseUnits } from "viem"
import { useWalletBalance } from "thirdweb/react"

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
  const { toast } = useToast()

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

  const { data: selectedTokenBalance, isLoading: isSelectedTokenLoading } = useWalletBalance({
    client,
    chain: celo,
    address: account?.address,
    tokenAddress: form.token || undefined,
  })

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setError(null)
    }
  }, [isOpen])

  const prepareDepositTransaction = async () => {
    if (!form.token || !form.amount || !form.lockPeriod || !account) {
      throw new Error("Missing required parameters")
    }

    const decimals = tokenInfos[form.token]?.decimals || 18
    const amountWei = parseUnits(form.amount, decimals)

    const minilendContract = getContract({
      client,
      chain: celo,
      address: MINILEND_ADDRESS,
      abi: minilendABI,
    })

    const depositTx = prepareContractCall({
      contract: minilendContract,
      method: "deposit",
      params: [form.token, amountWei, BigInt(Number.parseInt(form.lockPeriod))],
      erc20Value: {
        tokenAddress: form.token,
        amountWei,
      },
    })

    // Check if approval is needed
    const approveTx = await getApprovalForTransaction({
      transaction: depositTx as PreparedTransaction,
      account,
    })

    return approveTx || depositTx
  }

  const handleTransactionError = (error: Error) => {
    console.error("[SaveMoneyModal] Transaction error:", error)

    let userMessage = "Transaction failed. Please try again."

    if (error.message.includes("receipt not found")) {
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
    toast({
      title: "Transaction Failed",
      description: userMessage,
      variant: "destructive",
    })
  }

  const handleTransactionSuccess = (receipt: any) => {
    console.log("[SaveMoneyModal] Transaction successful:", receipt)

    toast({
      title: "Deposit Successful!",
      description: `Your ${tokenInfos[form.token]?.symbol} has been deposited successfully.`,
    })

    setForm({
      token: "",
      amount: "",
      lockPeriod: "2592000",
    })
    onClose()
  }

  const handleTransactionSent = (result: any) => {
    console.log("[SaveMoneyModal] Transaction sent:", result)

    toast({
      title: "Transaction Sent",
      description: "Your transaction has been submitted. Please wait for confirmation.",
    })
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

  const selectedTokenDecimals = form.token ? tokenInfos[form.token]?.decimals || 18 : 18
  const walletBalance = Number.parseFloat(selectedTokenBalance?.displayValue || "0")

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
    toast({
      title: "Deposit Initiated",
      description: `Your mobile money deposit is being processed. You'll receive ${tokenInfos[selectedTokenForOnramp]?.symbol} shortly.`,
    })
    setShowOnrampModal(false)
    // Optionally set the token and continue to amount step
    setForm((prev) => ({ ...prev, token: selectedTokenForOnramp }))
    setCurrentStep(2)
  }

  const hasZeroBalance = () => {
    if (isSelectedTokenLoading || !form.token) return false
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
          <div className="flex items-center justify-between pt-5 pb-3">
            {currentStep > 1 && (
              <button onClick={prevStep} className="p-1 text-[#a2c398] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 text-center">
              <h1 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">Start Earning</h1>
              <div className="flex justify-center gap-1 mt-2">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      step <= currentStep ? "bg-[#54d22d]" : "bg-[#426039]"
                    }`}
                  />
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

                <div className="space-y-3">
                  {supportedStablecoins.map((token) => {
                    const symbol = tokenInfos[token]?.symbol || "Unknown"
                    const isSelected = form.token === token
                    const showBalance = isSelected && !isSelectedTokenLoading
                    const zeroBalance = isSelected && hasZeroBalance()

                    return (
                      <div key={token} className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setForm({ ...form, token })
                          }}
                          className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all border ${
                            isSelected
                              ? "bg-[#54d22d] text-[#162013] border-[#54d22d] scale-[0.98]"
                              : "bg-[#21301c] text-white border-[#426039] hover:border-[#54d22d] hover:bg-[#2a3d24]"
                          }`}
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
                                {isSelectedTokenLoading ? (
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

                        {isSelected && zeroBalance && isAssetSupportedForOnramp(token) && (
                          <div className="bg-[#2a3d24] border border-[#426039] rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[#a2c398] text-sm">No {symbol} balance</div>
                              <div className="text-[#54d22d] text-xs">Get tokens first</div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedTokenForOnramp(token)
                                  setShowOnrampModal(true)
                                }}
                                className="flex-1 h-10 bg-[#54d22d] text-[#162013] text-sm font-medium rounded-lg hover:bg-[#4bc428] transition-colors flex items-center justify-center gap-1"
                              >
                                <Plus className="w-4 h-4" />
                                Get {symbol}
                              </button>
                              <button
                                onClick={nextStep}
                                className="px-4 h-10 bg-[#2e4328] text-white text-sm rounded-lg hover:bg-[#3a5533] transition-colors"
                              >
                                Skip
                              </button>
                            </div>
                          </div>
                        )}

                        {isSelected && zeroBalance && !isAssetSupportedForOnramp(token) && (
                          <div className="bg-[#2a3d24] border border-[#426039] rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[#a2c398] text-sm">No {symbol} balance</div>
                              <div className="text-yellow-400 text-xs">External deposit needed</div>
                            </div>
                            <div className="text-[#a2c398] text-xs mb-3">
                              {symbol} deposits via mobile money are not available. Please deposit from another wallet
                              or exchange.
                            </div>
                            <button
                              onClick={nextStep}
                              className="w-full h-10 bg-[#2e4328] text-white text-sm rounded-lg hover:bg-[#3a5533] transition-colors"
                            >
                              Continue anyway
                            </button>
                          </div>
                        )}

                        {isSelected && !zeroBalance && showBalance && (
                          <button
                            onClick={nextStep}
                            className="w-full h-10 bg-[#54d22d] text-[#162013] text-sm font-bold rounded-lg hover:bg-[#4bc428] transition-colors"
                          >
                            Continue with {symbol}
                          </button>
                        )}
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
                    {isSelectedTokenLoading ? (
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

                <TransactionButton
                  transaction={prepareDepositTransaction}
                  onTransactionSent={handleTransactionSent}
                  onTransactionConfirmed={handleTransactionSuccess}
                  onError={handleTransactionError}
                  disabled={!account || !form.token || !form.amount || !form.lockPeriod}
                  className="w-full h-12 bg-[#54d22d] text-[#162013] text-base font-bold rounded-xl hover:bg-[#4bc428] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  unstyled
                >
                  Start Earning
                </TransactionButton>
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