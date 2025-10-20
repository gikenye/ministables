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

import { 
  getContract, 
  prepareContractCall, 
  sendTransaction,
  waitForReceipt
} from "thirdweb"
import { client } from "@/lib/thirdweb/client"

import { calculateRequiredCollateral } from "@/lib/oracles/priceService"
import { useRouter } from "next/navigation"

import { 
  useActiveAccount, 
  useReadContract, 
  useWalletBalance 
} from "thirdweb/react"
import { useChain } from "@/components/ChainProvider"

// Helper to safely log thirdweb responses (avoid throwing on circular objects)
const logThirdweb = (label: string, obj: any) => {
  try {
    // Primary dump
    console.debug(`[thirdweb:${label}]`, obj)

    // Try to stringify for easier server-side capture; ignore stringify errors
    try {
      const json = JSON.stringify(obj, Object.getOwnPropertyNames(obj))
      console.debug(`[thirdweb:${label}:json]`, json)
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore
  }
}

interface BorrowMoneyModalProps {
  isOpen: boolean
  onClose: () => void
  onBorrow: (token: string, amount: string, collateralToken: string) => Promise<void>
  onDepositCollateral: (token: string, amount: string) => Promise<void>
  userBalances: Record<string, string>
  userCollaterals: Record<string, string>
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
  loading,
  requiresAuth = false,
}: BorrowMoneyModalProps) {
  const { toast } = useToast()
  const account = useActiveAccount()
  const router = useRouter()
  const { chain, contractAddress, tokens, tokenInfos } = useChain()

  const contract = getContract({
    client,
    chain,
    address: contractAddress,
  })

  // Valid collateral assets - only specific tokens per chain
  const SUPPORTED_COLLATERAL = useMemo(() => {
    if (chain?.id === 42220) { // Celo
      const allowedSymbols = ["USDC", "USDT", "CUSD"]
      return Object.entries(tokenInfos || {}).filter(([, info]) => {
        const s = (info.symbol || "").toUpperCase()
        return allowedSymbols.includes(s)
      }).map(([addr]) => addr)
    } else if (chain?.id === 534352) { // Scroll
      const allowedSymbols = ["USDC"]
      return Object.entries(tokenInfos || {}).filter(([, info]) => {
        const s = (info.symbol || "").toUpperCase()
        return allowedSymbols.includes(s)
      }).map(([addr]) => addr)
    }
    return []
  }, [tokenInfos, chain?.id])

  // Only cKES, bKES, and cNGN available for borrowing
  const SUPPORTED_STABLECOINS = useMemo(() => {
    // Filter tokens to only allow cKES, bKES, and cNGN
    const allowedSymbols = ["CKES", "BKES", "CNGN"]
    const filtered = Object.entries(tokenInfos || {}).filter(([, info]) => {
      const s = (info.symbol || "").toUpperCase()
      return allowedSymbols.includes(s)
    }).map(([addr]) => addr)

    return filtered
  }, [tokenInfos])

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

  // Reset modal-specific state when the selected chain changes to avoid
  // carrying over token addresses or selections from the previous chain.
  useEffect(() => {
    // Only reset if modal is open (user is interacting) to avoid surprising
    // behaviour when switching chains elsewhere in the app.
    if (isOpen) {
      setCurrentStep(BorrowStep.SELECT_TOKEN)
      setForm({ token: "", collateralToken: "", amount: "" })
      setRequiredCollateral(null)
      setExchangeRate(null)
      setTransactionStatus(null)
      setIsProcessing(false)
      setShowOnrampModal(false)
    }
  }, [chain?.id])

  // Calculate required collateral using price service
  useEffect(() => {
    if (form.token && form.collateralToken && form.amount && Number(form.amount) > 0) {
      setFetchingRate(true)
      calculateRequiredCollateral(
        form.token,
        form.collateralToken,
        form.amount,
        1.5
      ).then(result => {
        if (result) {
          setRequiredCollateral(result.amount)
          setExchangeRate(result.rate)
        } else {
          // Fallback only if price service fails
          const amountValue = Number(form.amount)
          setRequiredCollateral((amountValue * 1.5).toFixed(4))
          setExchangeRate(1.5)
        }
      }).catch(() => {
        // Fallback on error
        const amountValue = Number(form.amount)
        setRequiredCollateral((amountValue * 1.5).toFixed(4))
        setExchangeRate(1.5)
      }).finally(() => {
        setFetchingRate(false)
      })
    } else {
      setRequiredCollateral(null)
      setExchangeRate(null)
    }
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

  // Pre-fetch liquidity data for all supported tokens
  const tokenLiquidityData = useMemo(() => {
    const data: Record<string, { 
      totalSupply?: bigint, 
      totalBorrows?: bigint, 
      isBorrowingPaused?: boolean,
      isLoading: boolean 
    }> = {}
    
    SUPPORTED_STABLECOINS.forEach(token => {
      data[token] = { isLoading: true }
    })
    
    return data
  }, [SUPPORTED_STABLECOINS])

  // Create a stable array to avoid hook order issues when chain changes
  const maxTokens = 10; // Fixed number to ensure consistent hook calls
  const paddedTokens = useMemo(() => {
    const result = [...SUPPORTED_STABLECOINS];
    while (result.length < maxTokens) {
      result.push(null); // Fill with null for unused slots
    }
    return result.slice(0, maxTokens);
  }, [SUPPORTED_STABLECOINS]);

  // Always call the same number of hooks regardless of chain
  const allLiquidityQueries = paddedTokens.map((token) => {
    const { data: totalSupply } = useReadContract({
      contract,
      method: "function totalSupply(address) view returns (uint256)",
      params: token ? [token] : ["0x0000000000000000000000000000000000000000"],
      queryOptions: {
        enabled: isOpen && !!token,
        retry: 2,
      },
    })

    const { data: totalBorrows } = useReadContract({
      contract,
      method: "function totalBorrows(address) view returns (uint256)",
      params: token ? [token] : ["0x0000000000000000000000000000000000000000"],
      queryOptions: {
        enabled: isOpen && !!token,
        retry: 2,
      },
    })

    const { data: isBorrowingPaused } = useReadContract({
      contract,
      method: "function isBorrowingPaused(address) view returns (bool)",
      params: token ? [token] : ["0x0000000000000000000000000000000000000000"],
      queryOptions: {
        enabled: isOpen && !!token,
        retry: 2,
      },
    })

    return { token, totalSupply, totalBorrows, isBorrowingPaused }
  })

  // Filter out null entries after all hooks have been called
  const liquidityQueries = allLiquidityQueries.filter(query => query.token !== null)

  // Calculate liquidity for all tokens
  const allTokenLiquidity = useMemo(() => {
    const result: Record<string, {
      liquidity: string,
      isPaused: boolean,
      isLoading: boolean
    }> = {}

    liquidityQueries.forEach(({ token, totalSupply, totalBorrows, isBorrowingPaused }) => {
      const isLoading = totalSupply === undefined || totalBorrows === undefined || isBorrowingPaused === undefined
      
      if (isLoading) {
        result[token] = { liquidity: "0", isPaused: false, isLoading: true }
        return
      }

      const borrowsAmount = totalBorrows || BigInt(0)
      const availableLiquidity = totalSupply && totalSupply > borrowsAmount ? totalSupply - borrowsAmount : BigInt(0)
      
      const decimals = tokenInfos[token]?.decimals || 18
      const liquidityFormatted = availableLiquidity > 0 ? formatAmount(availableLiquidity.toString(), decimals) : "0"
      
      result[token] = {
        liquidity: liquidityFormatted,
        isPaused: isBorrowingPaused || false,
        isLoading: false
      }
    })

    return result
  }, [liquidityQueries, tokenInfos])

  // Get data for selected token
  const selectedTokenData = form.token ? allTokenLiquidity[form.token] : null



  // Balances for auto-wrap support when depositing collateral in CELO
  const { data: collateralTokenBalance } = useWalletBalance({
    client,
    chain: chain,
    address: account?.address,
    tokenAddress: form.collateralToken || undefined,
  })

  const { data: nativeBalanceData } = useWalletBalance({
    client,
    chain: chain,
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

    if (selectedTokenData?.isPaused) {
      setTransactionStatus(`Borrowing ${tokenInfos[form.token]?.symbol} is currently paused. Please try again later or select another token.`)
      return
    }

    if (selectedTokenData?.liquidity === "0") {
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
        // Find CELO token from current chain tokens
        const CELO_ERC20 = tokens.find(t => t.symbol.toUpperCase() === "CELO")?.address
        const required = Number.parseFloat(requiredCollateral)

        // Auto-wrap native CELO to ERC-20 if collateral is CELO and ERC-20 balance is short
        if (CELO_ERC20 && form.collateralToken === CELO_ERC20 && walletBalance < required) {
          const nativeBal = Number.parseFloat(nativeBalanceData?.displayValue || "0")
          const amountToWrap = Math.min(required - walletBalance, nativeBal)
          if (amountToWrap > 0) {
            setTransactionStatus("Converting CELO for collateral...")
            const celoContract = getContract({ client, chain: chain, address: CELO_ERC20 })
            const wrapTx = prepareContractCall({
              contract: celoContract,
              method: "function deposit()",
              params: [],
              value: parseUnits(amountToWrap.toString(), 18),
            })
            
            const wrapResult = await sendTransaction({ transaction: wrapTx, account })
            logThirdweb('wrapResult', wrapResult)
            if (wrapResult?.transactionHash) {
              setTransactionStatus("Waiting for CELO conversion...")
              await waitForReceipt({ client, chain: chain, transactionHash: wrapResult.transactionHash })
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
          chain: chain,
          address: form.collateralToken,
        })

        const allowanceTx = prepareContractCall({
          contract: tokenContract,
          method: "function approve(address spender, uint256 amount)",
          params: [contractAddress, amount],
        })
        
        // Execute approval transaction
        setTransactionStatus("Approving collateral use...")
        const allowanceResult = await sendTransaction({ transaction: allowanceTx, account })
  logThirdweb('allowanceResult', allowanceResult)
        if (allowanceResult?.transactionHash) {
          await waitForReceipt({ client, chain: chain, transactionHash: allowanceResult.transactionHash })
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
  logThirdweb('depositResult', depositResult)
          if (depositResult?.transactionHash) {
            await waitForReceipt({ client, chain: chain, transactionHash: depositResult.transactionHash })

            // Report collateral deposit transaction to Divvi
            reportTransactionToDivvi(depositResult.transactionHash, chain?.id)
              .then(() => console.log("[BorrowMoneyModal] Reported collateral deposit to Divvi:", depositResult.transactionHash))
              .catch((error) => console.error("[BorrowMoneyModal] Error reporting to Divvi:", error))
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
  logThirdweb('borrowResult', borrowResult)
      if (borrowResult?.transactionHash) {
        setTransactionStatus("Processing transaction...")
        await waitForReceipt({ client, chain: chain, transactionHash: borrowResult.transactionHash })

        // Report borrow transaction to Divvi
        reportTransactionToDivvi(borrowResult.transactionHash, chain?.id)
          .then(() => console.log("[BorrowMoneyModal] Reported borrow transaction to Divvi:", borrowResult.transactionHash))
          .catch((error) => console.error("[BorrowMoneyModal] Error reporting to Divvi:", error))
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
  // Log full error for debugging
  logThirdweb('error', error)

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
        return !!form.token && selectedTokenData?.liquidity !== "0" && !selectedTokenData?.isPaused
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
              <h3 className="text-lg font-semibold text-foreground">What do you need?</h3>
              <p className="text-sm text-muted-foreground">Choose the currency you'd like to borrow</p>
            </div>

            <div className="space-y-3">
              {SUPPORTED_STABLECOINS.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No currencies available right now</p>
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
                          ? "border-primary bg-card"
                          : "border-border bg-card hover:border-primary"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {tokenInfo?.icon ? (
                          <img
                            src={tokenInfo.icon}
                            alt={symbol}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                            {symbol.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-foreground">{symbol}</div>
                          {(() => {
                            const tokenData = allTokenLiquidity[token]
                            if (tokenData?.isLoading) {
                              return <div className="text-xs text-muted-foreground">Loading...</div>
                            }
                            if (tokenData?.isPaused) {
                              return <div className="text-xs text-destructive">Currently paused</div>
                            }
                            if (tokenData?.liquidity === "0") {
                              return <div className="text-xs text-destructive">Not available</div>
                            }
                            if (tokenData?.liquidity && isSelected) {
                              return <div className="text-xs text-primary">Available: {tokenData.liquidity}</div>
                            }
                            return <div className="text-xs text-muted-foreground">Tap to select</div>
                          })()}
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
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
              <h3 className="text-lg font-semibold text-foreground">How much do you need?</h3>
              <p className="text-sm text-muted-foreground">Enter the amount you'd like to borrow</p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="h-16 text-2xl text-center bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                  min="0.01"
                  step="0.01"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                  {tokenInfos[form.token]?.symbol}
                </div>
              </div>

              {selectedTokenData?.liquidity && selectedTokenData.liquidity !== "0" && (
                <div className="text-center text-sm text-muted-foreground">
                  Available to borrow: {selectedTokenData.liquidity} {tokenInfos[form.token]?.symbol}
                </div>
              )}
            </div>
          </div>
        )

      case BorrowStep.CHOOSE_SECURITY:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Choose your security</h3>
              <p className="text-sm text-muted-foreground">Select what you'll use to secure this loan</p>
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
                        ? "border-primary bg-card"
                        : "border-border bg-card hover:border-primary"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {tokenInfo?.icon ? (
                        <img
                          src={tokenInfo.icon}
                          alt={symbol}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                          {symbol.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-foreground">{symbol}</div>
                        <div className="text-xs text-muted-foreground">
                          Balance: {balance} {symbol}
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
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
              <h3 className="text-lg font-semibold text-foreground">Confirm your loan</h3>
              <p className="text-sm text-muted-foreground">Review the details before proceeding</p>
            </div>

            <div className="space-y-4">
              <div className="bg-card rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">You'll receive</span>
                  <span className="text-foreground font-semibold">
                    {form.amount} {tokenInfos[form.token]?.symbol}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Security required</span>
                  <div className="text-right">
                    <span className="text-foreground font-semibold">
                      {fetchingRate ? "Calculating..." : requiredCollateral} {tokenInfos[form.collateralToken]?.symbol}
                    </span>
                    <button 
                      onClick={refreshExchangeRate}
                      disabled={fetchingRate || !form.token || !form.collateralToken || !form.amount}
                      className="ml-2 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className={`w-4 h-4 ${fetchingRate ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>
                
                {exchangeRate && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Current exchange rate</span>
                    <span className="text-muted-foreground">
                      1 {tokenInfos[form.collateralToken]?.symbol} = {exchangeRate.toFixed(4)} {tokenInfos[form.token]?.symbol}
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
                      <div className="border-t border-border pt-3">
                        <div className="text-xs text-muted-foreground mb-2">
                          You need more {tokenInfos[form.collateralToken]?.symbol}
                        </div>
                        {onrampService.isAssetSupportedForOnramp(tokenInfos[form.collateralToken]?.symbol || "") && (
                          <Button
                            onClick={() => setShowOnrampModal(true)}
                            variant="outline"
                            size="sm"
                            className="w-full bg-primary text-primary-foreground border-primary hover:bg-primary/90"
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
                <div className="bg-card border border-primary rounded-xl p-4">
                  <div className="text-sm text-primary font-medium text-center" style={{ whiteSpace: 'pre-line' }}>{transactionStatus}</div>
                  
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
                        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-4 py-2 rounded"
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
      <DialogContent className="w-[90vw] max-w-md mx-auto bg-background border-border shadow-2xl [&>button]:text-foreground [&>button]:hover:text-muted-foreground">
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
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-card"
                disabled={isProcessing}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-foreground">Get Cash</DialogTitle>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-1 flex-1 rounded-full ${step <= currentStep ? "bg-primary" : "bg-muted"}`}
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
              className="flex-1 bg-transparent border-border text-muted-foreground hover:bg-card hover:text-foreground"
              disabled={isProcessing}
            >
              Cancel
            </Button>

            {currentStep < BorrowStep.CONFIRM ? (
              <Button
                onClick={goToNextStep}
                disabled={!canProceedToNextStep() || isProcessing}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
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
                  selectedTokenData?.liquidity === "0" ||
                  selectedTokenData?.isLoading ||
                  selectedTokenData?.isPaused ||
                  fetchingRate ||
                  // Disable button if transaction is complete and showing final message
                  transactionStatus?.includes("check your wallet")
                }
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
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