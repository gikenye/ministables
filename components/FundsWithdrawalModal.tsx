"use client"

import { useState, useMemo, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { VaultPosition } from "@/lib/services/vaultService"

interface FundsWithdrawalModalProps {
  isOpen: boolean
  onClose: () => void
  onWithdraw: (tokenSymbol: string, depositIds: number[]) => Promise<void>
  vaultPositions: VaultPosition[]
  tokenInfos: Record<string, { symbol: string; decimals: number; icon?: string }>
  loading: boolean
}

export function FundsWithdrawalModal({
  isOpen,
  onClose,
  onWithdraw,
  vaultPositions,
  tokenInfos,
  loading,
}: FundsWithdrawalModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState("")
  const [selectedDepositIds, setSelectedDepositIds] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setSelectedTokenSymbol("")
      setSelectedDepositIds([])
      setError(null)
    }
  }, [isOpen])

  const handleWithdraw = async () => {
    if (!selectedTokenSymbol || selectedDepositIds.length === 0) return

    setError(null)
    setIsWithdrawing(true)

    try {
      await onWithdraw(selectedTokenSymbol, selectedDepositIds)
      setSelectedTokenSymbol("")
      setSelectedDepositIds([])
      onClose()
    } catch (err: any) {
      console.error("Withdrawal error:", err)
      setError(err.message || "Transaction failed. Please try again.")
    } finally {
      setIsWithdrawing(false)
    }
  }

  const formatDate = (timestamp: number) => {
    if (timestamp === 0) return "No lock"
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const formatAmount = (amountStr: string, decimals: number = 18) => {
    try {
      const amt = BigInt(amountStr || "0")
      const divisor = BigInt(10 ** decimals)
      const value = Number(amt) / Number(divisor)
      return value.toFixed(6)
    } catch {
      return "0.000000"
    }
  }

  const selectedPosition = useMemo(() => {
    return vaultPositions.find(p => p.tokenSymbol === selectedTokenSymbol)
  }, [vaultPositions, selectedTokenSymbol])

  const withdrawableDeposits = useMemo(() => {
    if (!selectedPosition) return []
    return selectedPosition.deposits.filter(d => d.canWithdraw)
  }, [selectedPosition])

  const goToNextStep = () => {
    if (currentStep < 2) {
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

  const canProceedToStep2 = selectedTokenSymbol && withdrawableDeposits.length > 0 && selectedDepositIds.length > 0

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
              <DialogTitle className="text-white text-lg font-normal">Cash Out</DialogTitle>
              <DialogDescription className="text-[#a2c398] text-sm">
                {currentStep === 1 && "Select deposits to withdraw"}
                {currentStep === 2 && "Review and confirm"}
              </DialogDescription>
            </div>
            <div className="w-8" />
          </div>

          <div className="flex justify-center space-x-2">
            {[1, 2].map((step) => (
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
          {/* Step 1: Select Deposits */}
          {currentStep === 1 && (
            <div className="space-y-4">

              {vaultPositions.filter(pos => BigInt(pos.totalCurrentValue) > BigInt(0)).length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-[#a2c398] text-sm">
                    No deposits available to withdraw yet.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {vaultPositions.filter(pos => BigInt(pos.totalCurrentValue) > BigInt(0)).map((pos) => {
                    const tokenInfo = tokenInfos[pos.tokenAddress]
                    const iconUrl = tokenInfo?.icon
                    const hasWithdrawable = pos.deposits.some(d => d.canWithdraw)

                    return (
                      <div key={pos.tokenAddress} className="border border-[#426039] bg-[#21301c] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            {iconUrl ? (
                              <img src={iconUrl} alt={pos.tokenSymbol} className="w-8 h-8 mr-3 rounded-full" />
                            ) : (
                              <span className="text-2xl mr-3">💱</span>
                            )}
                            <div className="text-left">
                              <div className="text-white font-medium">{pos.tokenSymbol}</div>
                              <div className="text-[#a2c398] text-sm">{hasWithdrawable ? "Available" : "All Locked"}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-normal">{formatAmount(pos.totalCurrentValue, pos.decimals)}</div>
                            <div className="text-xs text-[#a2c398]">Total</div>
                          </div>
                        </div>

                        {pos.deposits.length > 0 && (
                          <div className="space-y-2">
                            {pos.deposits.map((deposit) => (
                              <div key={deposit.depositId} className="flex items-center justify-between bg-black/20 p-2 rounded">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    disabled={!deposit.canWithdraw}
                                    checked={selectedTokenSymbol === pos.tokenSymbol && selectedDepositIds.includes(deposit.depositId)}
                                    onChange={(e) => {
                                      console.log('Deposit:', deposit, 'depositId:', deposit.depositId);
                                      if (e.target.checked) {
                                        setSelectedTokenSymbol(pos.tokenSymbol)
                                        setSelectedDepositIds([...selectedDepositIds.filter(id => 
                                          pos.deposits.some(d => d.depositId === id)
                                        ), deposit.depositId])
                                      } else {
                                        setSelectedDepositIds(selectedDepositIds.filter(id => id !== deposit.depositId))
                                        if (selectedDepositIds.length === 1) setSelectedTokenSymbol("")
                                      }
                                    }}
                                    className="w-4 h-4"
                                  />
                                  <div>
                                    <div className="text-sm text-white">{formatAmount(deposit.currentValue, pos.decimals)} {pos.tokenSymbol}</div>
                                    <div className="text-xs text-[#a2c398]">{deposit.lockEnd > 0 ? `Unlocks: ${formatDate(deposit.lockEnd)}` : "No lock"}</div>
                                  </div>
                                </div>
                                <div className="text-xs">
                                  {deposit.canWithdraw ? (
                                    <span className="text-[#54d22d]">Available</span>
                                  ) : (
                                    <span className="text-[#a2c398]">Locked</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <Button
                onClick={goToNextStep}
                disabled={!canProceedToStep2}
                className="w-full bg-[#54d22d] hover:bg-[#54d22d]/90 text-[#162013] font-semibold h-12 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </Button>
            </div>
          )}

          {/* Step 2: Confirm Withdrawal */}
          {currentStep === 2 && selectedPosition && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-white text-lg font-medium mb-2">Confirm Withdrawal</h3>
                <p className="text-[#a2c398] text-sm">Review your withdrawal details</p>
              </div>

              <div className="bg-[#21301c] rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#a2c398]">Asset</span>
                  <span className="text-white font-normal">{selectedPosition.tokenSymbol}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#a2c398]">Deposits</span>
                  <span className="text-white font-normal text-base">{selectedDepositIds.length}</span>
                </div>
                <div className="border-t border-[#426039] pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[#a2c398]">Total Amount</span>
                    <span className="text-[#54d22d] font-normal text-base">
                      {formatAmount(
                        selectedPosition.deposits
                          .filter(d => selectedDepositIds.includes(d.depositId))
                          .reduce((sum, d) => sum + BigInt(d.currentValue), BigInt(0))
                          .toString(),
                        selectedPosition.decimals
                      )} {selectedPosition.tokenSymbol}
                    </span>
                  </div>
                </div>
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
                  onClick={handleWithdraw}
                  disabled={loading || isWithdrawing}
                  className="flex-1 bg-[#54d22d] hover:bg-[#54d22d]/90 text-[#162013] font-semibold h-12"
                >
                  {loading || isWithdrawing ? "Processing..." : "Confirm Withdrawal"}
                </Button>
              </div>
            </div>
          )}
        </div>


      </DialogContent>
    </Dialog>
  )
}