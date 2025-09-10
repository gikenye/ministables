"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useSendTransaction } from "thirdweb/react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Smartphone, AlertCircle } from "lucide-react"
import { formatAmount } from "@/lib/utils"
import { MobileMoneyWithdrawModal } from "./EnhancedMobileMoneyWithdrawModal"
import { offrampService } from "@/lib/services/offrampService"
import { getTokenIcon } from "@/lib/utils/tokenIcons"
import { thirdwebService } from "@/lib/services/thirdwebService"

interface FundsWithdrawalModalProps {
  isOpen: boolean
  onClose: () => void
  onWithdraw: (token: string, amount: string) => Promise<void>
  userDeposits: Record<string, string>
  depositLockEnds: Record<string, number>
  tokenInfos: Record<string, { symbol: string; decimals: number }>
  loading: boolean
  userAddress?: string
  getWithdrawableAmount?: (token: string) => Promise<string>
  requiresAuth?: boolean
}

export function FundsWithdrawalModal({
  isOpen,
  onClose,
  onWithdraw,
  userDeposits,
  depositLockEnds,
  tokenInfos,
  loading,
  userAddress,
  getWithdrawableAmount: getActualWithdrawableAmount,
  requiresAuth = false,
}: FundsWithdrawalModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [form, setForm] = useState({
    token: "",
    amount: "",
  })

  const [error, setError] = useState<string | null>(null)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [showMobileMoneyModal, setShowMobileMoneyModal] = useState(false)
  const [perDeposits, setPerDeposits] = useState<Array<{ amount: string; lockEnd: number }>>([])
  const [collateralAmount, setCollateralAmount] = useState<string>("0")
  const [loadingDeposits, setLoadingDeposits] = useState(false)
  const [withdrawableMap, setWithdrawableMap] = useState<Record<string, string>>({})

  const { mutateAsync: sendTransaction, isPending: isTransactionPending } = useSendTransaction()

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setForm({ token: "", amount: "" })
      setError(null)
    }
  }, [isOpen])

  // Fetch per-deposit rows and collateral amount whenever a token is selected
  useEffect(() => {
    const fetchDetails = async () => {
      if (!form.token || !userAddress) {
        setPerDeposits([])
        setCollateralAmount("0")
        setWithdrawableMap({})
        return
      }

      setLoadingDeposits(true)
      try {
        const deps = await thirdwebService.getAllUserDeposits(userAddress, form.token)
        setPerDeposits(deps || [])

        const coll = await thirdwebService.getUserCollateral(userAddress, form.token)
        setCollateralAmount(coll || "0")
        // compute withdrawable for this token using prop or per-deposits
        if (getActualWithdrawableAmount) {
          try {
            const w = await getActualWithdrawableAmount(form.token)
            setWithdrawableMap((p) => ({ ...p, [form.token]: w }))
          } catch (err) {
            console.error('getActualWithdrawableAmount failed', err)
            // fallback to per-deposits sum
            const now = Math.floor(Date.now() / 1000)
            const sum = (deps || []).reduce((acc, d) => {
              try {
                if ((d.lockEnd || 0) <= now) return acc + BigInt(d.amount || "0")
              } catch {}
              return acc
            }, BigInt(0))
            setWithdrawableMap((p) => ({ ...p, [form.token]: sum.toString() }))
          }
        } else {
          const now = Math.floor(Date.now() / 1000)
          const sum = (deps || []).reduce((acc, d) => {
            try {
              if ((d.lockEnd || 0) <= now) return acc + BigInt(d.amount || "0")
            } catch {}
            return acc
          }, BigInt(0))
          setWithdrawableMap((p) => ({ ...p, [form.token]: sum.toString() }))
        }
      } catch (err) {
        console.error('Error fetching deposits/collateral for', form.token, err)
        setPerDeposits([])
        setCollateralAmount("0")
      } finally {
        setLoadingDeposits(false)
      }
    }

    fetchDetails()
  }, [form.token, userAddress])

  const handleWithdraw = async () => {
    if (!form.token || !form.amount) return
    
    if (requiresAuth) {
      alert('Please sign in to complete this transaction')
      return
    }

    const withdrawableAmount = getWithdrawableAmount(form.token)
    const maxWithdrawable = Number.parseFloat(formatAmount(withdrawableAmount, tokenInfos[form.token]?.decimals || 18))
    const requestedAmount = Number.parseFloat(form.amount)

    if (requestedAmount > maxWithdrawable) {
      setError(
        `Cannot withdraw ${form.amount} ${tokenInfos[form.token]?.symbol}. Maximum available: ${maxWithdrawable.toFixed(6)}`,
      )
      return
    }

    if (withdrawableAmount === "0") {
      setError("No funds available. Your deposits may still be locked.")
      return
    }

    setError(null)
    setIsWithdrawing(true)

    try {
      await onWithdraw(form.token, form.amount)
      setForm({ token: "", amount: "" })
      onClose()
    } catch (err: any) {
      console.error("Withdrawal error:", err)

      let errorMessage = "Transaction failed. Please try again."

      if (err.message?.includes("MetaMask") || err.message?.includes("extension not found")) {
        errorMessage = "Wallet connection failed. Please ensure your wallet is installed and unlocked."
      } else if (err.message?.includes("network") || err.message?.includes("RPC")) {
        errorMessage = "Network error. Please check your connection and try again."
      } else if (err.message?.includes("E4") || err.message?.includes("Insufficient matured deposit balance")) {
        errorMessage = `Some ${tokenInfos[form.token]?.symbol} deposits may still be locked.`
      } else if (err.message?.includes("E2") || err.message?.includes("Repay loans")) {
        errorMessage = "Please repay outstanding loans before withdrawing."
      } else if (err.message?.includes("E5") || err.message?.includes("Insufficient contract reserve")) {
        errorMessage = "Insufficient liquidity. Please try again later."
      } else if (err.message?.includes("rejected") || err.message?.includes("denied")) {
        errorMessage = "Transaction cancelled by user."
      }

      setError(errorMessage)
    } finally {
      setIsWithdrawing(false)
    }
  }

  const isLocked = (timestamp: number) => {
    return timestamp > 0 && timestamp > Date.now() / 1000
  }

  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return "No lock"
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const supportedStablecoins = useMemo(() => Object.keys(tokenInfos), [tokenInfos])

  const getWithdrawableAmount = useCallback(
    (tokenAddress: string) => {
      // Case-insensitive lookup helpers
      const lookup = (m: Record<string, any>, key: string) => {
        if (!m) return undefined
        if (m[key]) return m[key]
        const foundKey = Object.keys(m).find((k) => k.toLowerCase() === key.toLowerCase())
        return foundKey ? m[foundKey] : undefined
      }

      // Prefer precomputed withdrawableMap (populated via prop or per-deposits)
      const w = lookup(withdrawableMap, tokenAddress)
      if (w !== undefined) return w

      // fallback: prefer provided async prop if available (not ideal sync) - try to read cached map
      const deposit = lookup(userDeposits, tokenAddress) || "0"
      const lockEnd = Number(lookup(depositLockEnds, tokenAddress) || 0)

      if (deposit === "0") return "0"
      if (isLocked(lockEnd)) return "0"

      return deposit
    },
    [userDeposits, depositLockEnds, withdrawableMap],
  )

  const hasPotentialMixedLocks = useCallback(
    (tokenAddress: string) => {
      const deposit = userDeposits[tokenAddress] || "0"
      const lockEnd = depositLockEnds[tokenAddress] || 0
      return deposit !== "0" && lockEnd > 0
    },
    [userDeposits, depositLockEnds],
  )

  // Build available tokens from the userDeposits keys (fallback to tokenInfos keys).
  // This is robust to address casing differences and ensures any token the user
  // actually has a non-zero deposit for will be shown.
  const availableTokens = useMemo(() => {
    const tokens = new Set<string>()
    const infoKeys = Object.keys(tokenInfos || {})

    // prefer tokenInfos key when it matches case-insensitively
    for (const k of Object.keys(userDeposits || {})) {
      try {
        if (BigInt(userDeposits[k] || "0") === BigInt(0)) continue
      } catch {
        continue
      }
      const match = infoKeys.find((t) => t.toLowerCase() === k.toLowerCase())
      tokens.add(match || k)
    }

    // also include any tokenInfos entries that have deposits (defensive)
    for (const t of infoKeys) {
      const amt = userDeposits[t] || userDeposits[t.toLowerCase()] || userDeposits[t.toUpperCase()]
      try {
        if (amt && BigInt(amt) > BigInt(0)) tokens.add(t)
      } catch {
        // ignore parse errors
      }
    }

    return Array.from(tokens)
  }, [userDeposits, tokenInfos])

  const goToNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
      setError(null)
    }
  }

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setError(null)
    }
  }

  const canProceedToStep2 = form.token && getWithdrawableAmount(form.token) !== "0"
  const canProceedToStep3 = canProceedToStep2 && form.amount && Number.parseFloat(form.amount) > 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-sm mx-auto bg-[#162013] border-0 shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            {currentStep > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousStep}
                className="text-[#a2c398] hover:text-white hover:bg-[#21301c] p-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="flex-1 text-center">
              <DialogTitle className="text-white text-xl font-semibold">Cash Out</DialogTitle>
              <DialogDescription className="text-[#a2c398] text-sm">
                {currentStep === 1 && "Select your savings to withdraw"}
                {currentStep === 2 && "How much would you like?"}
                {currentStep === 3 && "Review and confirm"}
              </DialogDescription>
            </div>
            <div className="w-8" />
          </div>

          <div className="flex justify-center space-x-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  step <= currentStep ? "bg-[#54d22d] scale-110" : "bg-[#426039]"
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm animate-in slide-in-from-top-2">
            <div className="flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Step 1: Select Token */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-white text-lg font-medium mb-2">Your Savings</h3>
                <p className="text-[#a2c398] text-sm">Choose which savings to withdraw from</p>
              </div>

              {availableTokens.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-[#a2c398] text-sm">
                    No savings available to withdraw yet.
                    <br />
                    Start saving to see your funds here!
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableTokens.map((token) => {
                    const tokenInfo = tokenInfos[token]
                    const withdrawable = getWithdrawableAmount(token)
                    const totalDeposit = userDeposits[token] || "0"
                    const formattedWithdrawable = formatAmount(withdrawable, tokenInfo?.decimals || 18)
                    const formattedTotal = formatAmount(totalDeposit, tokenInfo?.decimals || 18)
                    const iconUrl = getTokenIcon(tokenInfo?.symbol || "")
                    const isTokenLocked = isLocked(depositLockEnds[token])

                    return (
                      <button
                        key={token}
                        onClick={() => {
                          setForm({ ...form, token })
                          // allow opening details for locked tokens too, but only auto-advance when available
                          if (!isTokenLocked && withdrawable !== "0") {
                            goToNextStep()
                          }
                        }}
                        disabled={false}
                        className={`w-full p-4 rounded-xl border transition-all ${
                          form.token === token
                            ? "border-[#54d22d] bg-[#54d22d]/10"
                            : isTokenLocked || withdrawable === "0"
                              ? "border-[#426039] bg-[#21301c]/50"
                              : "border-[#426039] bg-[#21301c] hover:border-[#54d22d] hover:bg-[#2e4328]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {iconUrl.startsWith("http") ? (
                              <img
                                src={iconUrl || "/placeholder.svg"}
                                alt={tokenInfo?.symbol}
                                className="w-8 h-8 mr-3"
                              />
                            ) : (
                              <span className="text-2xl mr-3">{iconUrl}</span>
                            )}
                            <div className="text-left">
                              <div className="text-white font-medium">{tokenInfo?.symbol}</div>
                              <div className="text-[#a2c398] text-sm">{isTokenLocked ? "Locked" : "Available"}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-semibold">{formattedTotal}</div>
                            {isTokenLocked ? (
                              <>
                                <div className="text-red-400 text-xs">Locked • Available: {formattedWithdrawable}</div>
                                <div className="text-red-400 text-xs">Until {formatDate(depositLockEnds[token])}</div>
                              </>
                            ) : (
                              <div className="text-xs text-[#a2c398]">Available: {formattedWithdrawable}</div>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Per-deposit details for selected token */}
              {form.token && (
                <div className="mt-3 bg-[#0f1a12] rounded-xl p-3 border border-[#21301c]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-white font-medium">{tokenInfos[form.token]?.symbol || form.token}</div>
                    <div className="text-xs text-[#a2c398]">Deposit details</div>
                  </div>

                  {loadingDeposits ? (
                    <div className="text-sm text-[#a2c398]">Loading deposits...</div>
                  ) : perDeposits.length === 0 ? (
                    <div className="text-sm text-[#a2c398]">No individual deposits found.</div>
                  ) : (
                    <div className="space-y-2">
                      {perDeposits.map((d, idx) => {
                        const isMature = Math.floor(Date.now() / 1000) >= (d.lockEnd || 0)
                        const formatted = formatAmount(d.amount, tokenInfos[form.token]?.decimals || 18)
                        return (
                          <div key={idx} className="flex items-center justify-between bg-black/10 p-2 rounded">
                            <div>
                              <div className="text-sm text-white">{formatted} {tokenInfos[form.token]?.symbol}</div>
                              <div className="text-xs text-[#a2c398]">{d.lockEnd && d.lockEnd > 0 ? `Unlocks: ${formatDate(d.lockEnd)}` : "No lock"}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isMature ? (
                                <button
                                  className="text-[#54d22d] text-sm font-medium"
                                  onClick={() => {
                                    // Quick withdraw full deposit
                                    setForm({ token: form.token, amount: formatAmount(d.amount, tokenInfos[form.token]?.decimals || 18) })
                                    goToNextStep()
                                  }}
                                >
                                  Withdraw Full
                                </button>
                              ) : (
                                <div className="text-xs text-[#a2c398]">Locked</div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Collateral withdraw row */}
                  {collateralAmount && BigInt(collateralAmount || "0") > BigInt(0) && (
                    <div className="mt-3 p-3 bg-black/20 rounded flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white">Collateral deposited</div>
                        <div className="text-xs text-[#a2c398]">{formatAmount(collateralAmount, tokenInfos[form.token]?.decimals || 18)} {tokenInfos[form.token]?.symbol}</div>
                      </div>
                      <div>
                        <button
                          className="bg-[#54d22d] text-[#162013] px-3 py-1 rounded text-sm font-medium"
                          onClick={() => {
                            // Prefill withdrawal amount with collateral and proceed
                            setForm({ token: form.token, amount: formatAmount(collateralAmount, tokenInfos[form.token]?.decimals || 18) })
                            goToNextStep()
                          }}
                        >
                          Withdraw Collateral
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Enter Amount */}
          {currentStep === 2 && form.token && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-white text-lg font-medium mb-2">How Much?</h3>
                <p className="text-[#a2c398] text-sm">
                  Enter the amount of {tokenInfos[form.token]?.symbol} to withdraw
                </p>
              </div>

              <div className="bg-[#21301c] rounded-xl p-4 border border-[#426039]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#a2c398] text-sm">Available to withdraw</span>
                  <span className="text-[#54d22d] font-semibold text-lg">
                    {formatAmount(getWithdrawableAmount(form.token), tokenInfos[form.token]?.decimals || 18)}{" "}
                    {tokenInfos[form.token]?.symbol}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-[#a2c398] text-sm">Amount</Label>
                  <button
                    type="button"
                    onClick={() => {
                      const maxAmount = formatAmount(
                        getWithdrawableAmount(form.token),
                        tokenInfos[form.token]?.decimals || 18,
                      )
                      setForm({ ...form, amount: maxAmount })
                    }}
                    className="text-[#54d22d] text-sm hover:text-white transition-colors"
                  >
                    Use Max
                  </button>
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === "" || /^\d*\.?\d*$/.test(value)) {
                      setForm({ ...form, amount: value })
                    }
                    if (error && value !== form.amount) {
                      setError(null)
                    }
                  }}
                  className="bg-[#21301c] border-[#426039] text-white placeholder-[#a2c398] text-lg h-14 text-center focus:border-[#54d22d] focus:ring-[#54d22d]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={goToPreviousStep}
                  variant="outline"
                  className="flex-1 bg-transparent border-[#426039] text-[#a2c398] hover:bg-[#21301c] hover:text-white h-12"
                >
                  Back
                </Button>
                <Button
                  onClick={goToNextStep}
                  disabled={!canProceedToStep3}
                  className="flex-1 bg-[#54d22d] hover:bg-[#54d22d]/90 text-[#162013] font-semibold h-12 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm Withdrawal */}
          {currentStep === 3 && form.token && form.amount && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-white text-lg font-medium mb-2">Almost Done!</h3>
                <p className="text-[#a2c398] text-sm">Double-check your withdrawal details</p>
              </div>

              <div className="bg-[#21301c] rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#a2c398]">Asset</span>
                  <span className="text-white font-medium">{tokenInfos[form.token]?.symbol}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a2c398]">Amount</span>
                  <span className="text-white font-semibold text-lg">{form.amount}</span>
                </div>
                <div className="border-t border-[#426039] pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[#a2c398]">You'll receive</span>
                    <span className="text-[#54d22d] font-bold text-lg">
                      {form.amount} {tokenInfos[form.token]?.symbol}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile Money Option */}
              {offrampService.isCryptoSupportedForOfframp(tokenInfos[form.token]?.symbol || "") && (
                <div className="bg-[#2e4328] rounded-xl p-4 border border-[#54d22d]/20">
                  <div className="flex items-center mb-2">
                    <Smartphone className="w-4 h-4 mr-2 text-[#54d22d]" />
                    <span className="text-white font-medium">Get Cash Instantly</span>
                  </div>
                  <p className="text-[#a2c398] text-sm mb-3">Convert directly to mobile money instead</p>
                  <Button
                    onClick={() => setShowMobileMoneyModal(true)}
                    variant="outline"
                    className="w-full border-[#54d22d] text-[#54d22d] hover:bg-[#54d22d] hover:text-[#162013] h-10 transition-all duration-200"
                  >
                    Get Mobile Money
                  </Button>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={goToPreviousStep}
                  variant="outline"
                  className="flex-1 bg-transparent border-[#426039] text-[#a2c398] hover:bg-[#21301c] hover:text-white h-12"
                >
                  Back
                </Button>
                <Button
                  onClick={handleWithdraw}
                  disabled={loading || isWithdrawing || isTransactionPending}
                  className="flex-1 bg-[#54d22d] hover:bg-[#54d22d]/90 text-[#162013] font-semibold h-12"
                >
                  {loading || isWithdrawing || isTransactionPending ? "Processing..." : "Confirm Withdrawal"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Money Withdrawal Modal */}
        {form.token && tokenInfos[form.token] && (
          <MobileMoneyWithdrawModal
            isOpen={showMobileMoneyModal}
            onClose={() => setShowMobileMoneyModal(false)}
            tokenSymbol={tokenInfos[form.token]?.symbol || ""}
            tokenAddress={form.token}
            network={offrampService.detectNetworkFromTokenAddress(form.token) || "celo"}
            availableAmount={formatAmount(getWithdrawableAmount(form.token), tokenInfos[form.token]?.decimals || 18)}
            decimals={tokenInfos[form.token]?.decimals || 18}
            onWithdrawSuccess={(orderID, amount) => {
              setShowMobileMoneyModal(false)
              setForm({ token: "", amount: "" })
              onClose()
            }}
            onBlockchainWithdraw={async (tokenAddress: string, amount: string) => {
              try {
                await onWithdraw(tokenAddress, amount)
                return "0x" + Math.random().toString(16).substr(2, 64)
              } catch (error) {
                console.error("Blockchain withdrawal failed:", error)
                throw new Error("Withdrawal transaction failed")
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}