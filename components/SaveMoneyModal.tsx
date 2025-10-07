"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ArrowLeft, Check, AlertCircle, Loader2, Plus } from "lucide-react"
import { useActiveAccount, useSendTransaction, useWalletBalance } from "thirdweb/react"
import { OnrampDepositModal } from "./OnrampDepositModal"
import { onrampService } from "@/lib/services/onrampService"
import { appendDivviReferralTag, reportTransactionToDivvi } from "@/lib/services/divviService"

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

import { parseUnits } from "viem"
import { useChain } from "@/components/ChainProvider"
import { getExplorerUrl } from "@/config/chainConfig"

interface SaveMoneyModalProps {
  isOpen: boolean
  onClose: () => void
  loading?: boolean
  requiresAuth?: boolean
}

export function SaveMoneyModal({
  isOpen,
  onClose,
  loading: _loading = false,
  requiresAuth = false,
}: SaveMoneyModalProps) {
  const account = useActiveAccount()
  const { chain, contractAddress, tokens, tokenInfos } = useChain()

  // Only show deposit-appropriate tokens per chain
  const supportedStablecoins = useMemo(() => {
    if (chain?.id === 42220) { // Celo
      const allowedSymbols = ["USDC", "USDT", "CUSD"]
      return tokens.filter(t => allowedSymbols.includes(t.symbol.toUpperCase())).map(t => t.address)
    } else if (chain?.id === 534352) { // Scroll
      const allowedSymbols = ["USDC", "WETH"]
      return tokens.filter(t => allowedSymbols.includes(t.symbol.toUpperCase())).map(t => t.address)
    }
    return tokens.map(t => t.address)
  }, [tokens, chain?.id])
  const [currentStep, setCurrentStep] = useState(1)
  const [depositMethod, setDepositMethod] = useState<"mpesa" | "crypto" | "">("")
  const [form, setForm] = useState({
    token: "",
    amount: "",
    lockPeriod: "2592000", // 30 days default
  })

  const [error, setError] = useState<string | null>(null)
  const [showOnrampModal, setShowOnrampModal] = useState(false)
  const [selectedTokenForOnramp, setSelectedTokenForOnramp] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)
  const [depositSuccess, setDepositSuccess] = useState<{
    token: string
    amount: string
    lockPeriod: string
    transactionHash?: string
  } | null>(null)

  // Use the working setup's wallet balance hook
  const { data: walletBalanceData, isLoading: isBalanceLoading } = useWalletBalance({
    client,
    chain,
    address: account?.address,
    tokenAddress: form.token || undefined,
  })

  // Use the working setup's transaction hook
  const { mutateAsync: sendTransaction, isPending: isTransactionPending } = useSendTransaction({ payModal: false })

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setDepositMethod("")
      setError(null)
      setIsSaving(false)
      setTransactionStatus(null)
      setDepositSuccess(null)
    }
  }, [isOpen])

  // Clear modal state when the chain changes to prevent using token addresses
  // or balances from the previously selected chain.
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setDepositMethod("")
      setError(null)
      setIsSaving(false)
      setTransactionStatus(null)
      setDepositSuccess(null)
      setForm({ token: "", amount: "", lockPeriod: "2592000" })
      setShowOnrampModal(false)
      setSelectedTokenForOnramp("")
    }
  }, [chain?.id])

  const prepareDepositTransaction = async () => {
    if (!form.token || !form.amount || !form.lockPeriod || !account) {
      throw new Error("Missing required parameters")
    }

    if (process.env.NODE_ENV === 'development') {
      console.log("[SaveMoneyModal] Starting save with params:", {
        tokenAddress: form.token?.substring(0, 10) + '...',
        tokenSymbol: tokenInfos[form.token]?.symbol,
        amount: 'REDACTED',
        lockPeriod: form.lockPeriod,
      })
    }

    const decimals = tokenInfos[form.token]?.decimals || 18
    const amountWei = parseUnits(form.amount, decimals)

    if (process.env.NODE_ENV === 'development') {
      console.log("[SaveMoneyModal] Calculated wei amount:", {
        inputAmount: 'REDACTED',
        decimals,
        amountWei: 'REDACTED'
      })
    }

    // Create Minilend contract instance from config
    if (process.env.NODE_ENV === 'development') {
      console.log("[SaveMoneyModal] Creating Minilend contract instance for chain:", chain?.id)
    }
    const minilendContract = getContract({
      client,
      chain: chain,
      address: contractAddress,
      abi: minilendABI,
    })



    // Prepare deposit transaction
    if (process.env.NODE_ENV === 'development') {
      console.log("[SaveMoneyModal] Preparing deposit transaction with params:", {
        token: form.token?.substring(0, 10) + '...',
        amount: 'REDACTED',
        lockPeriod: form.lockPeriod
      })
    }

    // Create the deposit transaction
    let depositTx = prepareContractCall({
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
    
    // Append Divvi referral tag to the transaction using our helper function
    if (account) {
      if (process.env.NODE_ENV === 'development') {
        console.log("[SaveMoneyModal] Adding Divvi referral tag to transaction for address:", account.address?.substring(0, 10) + '...')
      }
      depositTx = appendDivviReferralTag(depositTx, account.address) as any;
    }
    
    // We'll also report to Divvi after transaction is complete

    return depositTx
  }

  const handleTransactionError = (error: Error) => {
    if (process.env.NODE_ENV === 'development') {
      console.error("[SaveMoneyModal] Transaction error:", error?.message || 'Unknown error')
    }

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

  const handleTransactionSuccess = async (receipt: any, isApproval: boolean = false) => {
    if (process.env.NODE_ENV === 'development') {
      console.log("[SaveMoneyModal] Transaction successful:", receipt?.transactionHash || 'unknown')
    }

    if (!isApproval) {
      // Set the success state with current form data and transaction hash
      setDepositSuccess({
        token: form.token,
        amount: form.amount,
        lockPeriod: form.lockPeriod,
        transactionHash: receipt.transactionHash
      })
      // Move to success step
      setCurrentStep(6)
      
      // Report transaction to Divvi for referral tracking
      if (receipt.transactionHash) {
        reportTransactionToDivvi(receipt.transactionHash, chain.id)
          .then(() => {
            if (process.env.NODE_ENV === 'development') {
              console.log("[SaveMoneyModal] Reported transaction to Divvi:", receipt.transactionHash)
            }
          })
          .catch(error => {
            if (process.env.NODE_ENV === 'development') {
              console.error("[SaveMoneyModal] Error reporting to Divvi:", error?.message || 'Unknown error')
            }
          })
      }
    }
  }

  const handleTransactionSent = (result: any, _isApproval: boolean = false) => {
    if (process.env.NODE_ENV === 'development') {
      console.log("[SaveMoneyModal] Transaction sent:", result?.transactionHash || 'unknown')
    }
  }

  const handleSave = async () => {
    if (!form.token || !form.amount || !form.lockPeriod) return
    if (requiresAuth) {
      setError('Please sign in to complete this transaction')
      return
    }
    if (!account) {
      setError("Please sign in first")
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
    setTransactionStatus("Setting up your deposit...")

    try {
      const depositTx = await prepareDepositTransaction()
      
      // Check if approval is needed and handle it
      if (process.env.NODE_ENV === 'development') {
        console.log("[SaveMoneyModal] Checking if approval is needed for deposit transaction")
      }
      const approveTx = await getApprovalForTransaction({
        transaction: depositTx as any,
        account: account!,
      })
      
      // No need to add referral tag to approval transaction, as it's not a direct interaction with our contract
      
      if (approveTx) {
        if (process.env.NODE_ENV === 'development') {
          console.log("[SaveMoneyModal] Approval required, sending approval transaction")
        }
        setTransactionStatus("Authorizing transaction...")
        const approveResult = await sendTransaction(approveTx)
        if (process.env.NODE_ENV === 'development') {
          console.log("[SaveMoneyModal] Approval transaction submitted:", approveResult?.transactionHash?.substring(0, 10) + '...')
        }
        
        handleTransactionSent(approveResult, true)
        
          if (approveResult?.transactionHash) {
            if (process.env.NODE_ENV === 'development') {
              console.log("[SaveMoneyModal] Waiting for approval confirmation...")
            }
            setTransactionStatus("Processing authorization...")
            const approvalReceipt = await waitForReceipt({
              client,
              chain,
              transactionHash: approveResult.transactionHash,
            })
            handleTransactionSuccess(approvalReceipt, true)
          }
      } else {
        console.log("[SaveMoneyModal] No approval needed, proceeding with deposit")
      }
      
      // Execute deposit transaction
      console.log("[SaveMoneyModal] Sending deposit transaction");
      setTransactionStatus("Completing your deposit...")
      // Send the transaction normally, without trying to modify the data
      const depositResult = await sendTransaction(depositTx as any);
      console.log("[SaveMoneyModal] Deposit result:", depositResult)
      
      handleTransactionSent(depositResult, false)
      
        if (depositResult?.transactionHash) {
          console.log("[SaveMoneyModal] Deposit transaction submitted with hash:", depositResult.transactionHash)
          setTransactionStatus("Almost done...")
          // Wait for deposit confirmation
          const depositReceipt = await waitForReceipt({
            client,
            chain,
            transactionHash: depositResult.transactionHash,
          })
          setTransactionStatus("Success!")
          handleTransactionSuccess(depositReceipt, false)
        }

    } catch (err: any) {
      setTransactionStatus(null)
      handleTransactionError(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleMakeAnotherDeposit = () => {
    setDepositSuccess(null)
    setCurrentStep(1)
    setDepositMethod("")
    setForm({
      token: "",
      amount: "",
      lockPeriod: "2592000",
    })
    setError(null)
    setTransactionStatus(null)
  }

  const handleCloseSuccess = () => {
    setForm({
      token: "",
      amount: "",
      lockPeriod: "2592000",
    })
    setDepositMethod("")
    setDepositSuccess(null)
    onClose()
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
        return depositMethod !== ""
      case 3:
        return depositMethod !== "" && form.token !== ""
      case 4:
        return depositMethod !== "" && form.token !== "" && form.amount !== ""
      case 5:
        return depositMethod !== "" && form.token !== "" && form.amount !== "" && form.lockPeriod !== ""
      case 6:
        return depositSuccess !== null
      default:
        return true
    }
  }

  const nextStep = () => {
    if (currentStep < 6 && canProceedToStep(currentStep + 1)) {
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

  const handleOnrampSuccess = () => {
    setShowOnrampModal(false)
    // For M-Pesa with auto-deposit, show success directly
    setDepositSuccess({
      token: form.token,
      amount: "Auto-deposited",
      lockPeriod: "2592000", // 30 days default
    })
    setCurrentStep(6)
  }

  const hasZeroBalance = () => {
    if (isBalanceLoading || !form.token) return false
    return walletBalance === 0
  }

  const isAssetSupportedForOnramp = (tokenAddress: string) => {
    try {
      const tokenSymbol = tokenInfos[tokenAddress]?.symbol
      if (!tokenSymbol) {
        console.log("[SaveMoneyModal] No token symbol found for address:", tokenAddress)
        return false
      }

      // Map chain ID to proper chain name
      const chainName = chain?.id === 42220 ? "CELO" : 
                       chain?.id === 534352 ? "SCROLL" : 
                       "CELO"
      
      console.log("[SaveMoneyModal] Checking onramp support for:", {
        tokenAddress: tokenAddress.substring(0, 10) + '...',
        tokenSymbol,
        chainId: chain?.id,
        chainName
      })
      
      const isSupported = onrampService.isAssetSupportedForOnramp(tokenSymbol, chainName)
      console.log("[SaveMoneyModal] Onramp support result:", isSupported)
      
      return isSupported
    } catch (error) {
      console.error("[SaveMoneyModal] Error checking onramp support:", error)
      return false
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md mx-auto bg-[#162013] border-0 shadow-lg p-0 overflow-hidden [&>button]:text-white [&>button]:hover:text-[#a2c398]">
        <div className="flex h-5 w-full items-center justify-center bg-[#162013]">
          <div className="h-1 w-9 rounded-full bg-[#426039]"></div>
        </div>

        <div className="px-4 pb-5">
          <DialogTitle className="sr-only">Start Earning</DialogTitle>
          <DialogDescription className="sr-only">
            Start earning by choosing a token, entering an amount, selecting a lock period, and confirming your deposit.
          </DialogDescription>
          <div className="flex items-center justify-between pt-5 pb-3">
            {currentStep > 1 && currentStep !== 6 && (
              <button onClick={prevStep} className="p-1 text-[#a2c398] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 text-center">
              <h1 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">
                {currentStep === 1 && "Deposit Method"}
                {currentStep === 2 && "Choose Asset"}
                {currentStep === 3 && "Enter Amount"}
                {currentStep === 4 && "Lock Period"}
                {currentStep === 5 && "Review"}
                {currentStep === 6 && "Success!"}
              </h1>
              <div className="flex justify-center gap-2 mt-2">
                {[1, 2, 3, 4, 5, 6].map((step) => (
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
                    {step === 6 ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step
                    )}
                  </div>
                ))}
              </div>
            </div>
            {currentStep > 1 && currentStep !== 6 && <div className="w-7" />}
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-700 text-red-300 p-3 rounded-xl text-sm mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {requiresAuth && (
            <div className="bg-yellow-900/20 border border-yellow-700 text-yellow-300 p-3 rounded-xl text-sm mb-4">
              Sign in required to complete transactions
            </div>
          )}

          <div className="min-h-[300px]">
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">How would you like to deposit?</h3>
                  <p className="text-[#a2c398] text-sm">Choose your preferred deposit method</p>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDepositMethod("mpesa")
                      // Set USDC as default token for M-Pesa deposits
                      const usdcToken = supportedStablecoins.find(token => 
                        tokenInfos[token]?.symbol?.toUpperCase() === "USDC"
                      )
                      if (usdcToken) {
                        setForm({ ...form, token: usdcToken })
                        setSelectedTokenForOnramp(usdcToken)
                      }
                      setShowOnrampModal(true)
                    }}
                    className="w-full p-4 rounded-xl border-2 border-[#426039] bg-[#2e4328] hover:border-[#54d22d] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#54d22d] flex items-center justify-center text-[#162013] font-bold">
                        M
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-white">M-Pesa</div>
                        <div className="text-xs text-[#a2c398]">Deposit using mobile money</div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDepositMethod("crypto")
                      const usdcToken = supportedStablecoins.find(token => 
                        tokenInfos[token]?.symbol?.toUpperCase() === "USDC"
                      )
                      if (usdcToken) {
                        setForm({ ...form, token: usdcToken })
                      }
                      nextStep()
                    }}
                    className="w-full p-4 rounded-xl border-2 border-[#426039] bg-[#2e4328] hover:border-[#54d22d] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#54d22d] flex items-center justify-center text-[#162013] font-bold">
                        ₿
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-white">Crypto</div>
                        <div className="text-xs text-[#a2c398]">Deposit USDC from your wallet</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {currentStep === 2 && depositMethod === "crypto" && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">Deposit USDC</h3>
                  <p className="text-[#a2c398] text-sm">You'll deposit USDC on {chain?.name}</p>
                </div>

                <div className="bg-[#21301c] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#a2c398] text-sm">Selected Asset</span>
                    <span className="text-[#54d22d] font-semibold">USDC</span>
                  </div>
                  <div className="text-xs text-[#a2c398]">
                    Balance: {isBalanceLoading ? "Loading..." : `${formatDisplayNumber(walletBalance)} USDC`}
                  </div>
                </div>

                <button
                  onClick={nextStep}
                  className="w-full h-12 bg-[#54d22d] text-[#162013] text-base font-bold rounded-xl hover:bg-[#4bc428] transition-colors"
                >
                  Continue with USDC
                </button>
              </div>
            )}

            {currentStep === 2 && depositMethod === "mpesa" && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">Choose asset to deposit</h3>
                  <p className="text-[#a2c398] text-sm">Select which token you'd like to deposit</p>
                </div>

                <div className="space-y-2">
                  {supportedStablecoins.map((token) => {
                    const symbol = tokenInfos[token]?.symbol || "Unknown"
                    const isSelected = form.token === token
                    const showBalance = isSelected && !isBalanceLoading
                    const zeroBalance = isSelected && hasZeroBalance()

                    const onrampSupported = isSelected ? isAssetSupportedForOnramp(token) : true

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
                              {tokenInfos[token]?.icon ? (
                                <img
                                  src={tokenInfos[token].icon}
                                  alt={symbol}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-[#54d22d] flex items-center justify-center text-[#162013] font-bold">
                                  {symbol.charAt(0)}
                                </div>
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

            {currentStep === 3 && (
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

            {currentStep === 4 && (
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

            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">Deposit {tokenInfos[form.token]?.symbol}</h3>
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
                  disabled={requiresAuth || !account || !form.token || !form.amount || !form.lockPeriod || isSaving || isTransactionPending}
                  className="w-full h-12 bg-[#54d22d] text-[#162013] text-base font-bold rounded-xl hover:bg-[#4bc428] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving || isTransactionPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {transactionStatus || "Processing..."}
                    </span>
                  ) : requiresAuth ? (
                    "Sign In Required"
                  ) : (
                    "Complete Deposit"
                  )}
                </button>
              </div>
            )}

            {currentStep === 6 && depositSuccess && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#54d22d] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-[#162013]" />
                  </div>
                  <h3 className="text-white text-lg font-medium mb-2">Deposit Successful!</h3>
                  <p className="text-[#a2c398] text-sm">
                    {depositMethod === "mpesa" ? "Your M-Pesa payment will be auto-deposited to earn rewards" : "Your funds have been deposited and are now earning rewards"}
                  </p>
                </div>

                <div className="bg-[#21301c] rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#a2c398]">Deposited</span>
                    <div className="text-right">
                      <div className="text-white font-medium">{depositSuccess.amount}</div>
                      <div className="text-[#a2c398] text-sm">{tokenInfos[depositSuccess.token]?.symbol}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#a2c398]">Lock period</span>
                    <div className="text-white font-medium">{getLockPeriodText(depositSuccess.lockPeriod)}</div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#426039]">
                    <span className="text-[#a2c398]">Earning</span>
                    <div className="text-right">
                      <div className="text-[#54d22d] font-bold text-lg">{getAPY(depositSuccess.lockPeriod)}</div>
                      <div className="text-[#a2c398] text-sm">APY</div>
                    </div>
                  </div>

                  {depositSuccess.transactionHash && (
                    <div className="flex items-center justify-between pt-2 border-t border-[#426039]">
                      <span className="text-[#a2c398]">Transaction</span>
                      <a
                        href={`${getExplorerUrl(chain?.id || 42220)}/tx/${depositSuccess.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#54d22d] text-sm hover:underline truncate max-w-32"
                      >
                        {`${depositSuccess.transactionHash.slice(0, 6)}...${depositSuccess.transactionHash.slice(-4)}`}
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleMakeAnotherDeposit}
                    className="w-full h-12 bg-[#54d22d] text-[#162013] text-base font-bold rounded-xl hover:bg-[#4bc428] transition-colors"
                  >
                    Make Another Deposit
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseSuccess}
                    className="w-full h-12 bg-transparent border border-[#426039] text-white text-base font-medium rounded-xl hover:bg-[#21301c] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <OnrampDepositModal
          isOpen={showOnrampModal}
          onClose={() => setShowOnrampModal(false)}
          selectedAsset={selectedTokenForOnramp}
          assetSymbol={(() => {
            const symbol = tokenInfos[selectedTokenForOnramp]?.symbol || ""
            console.log("[SaveMoneyModal] Passing to OnrampDepositModal:", {
              selectedTokenForOnramp,
              symbol,
              tokenInfos: tokenInfos[selectedTokenForOnramp]
            })
            return symbol
          })()}
          onSuccess={handleOnrampSuccess}
        />
      </DialogContent>
    </Dialog>
  )
}