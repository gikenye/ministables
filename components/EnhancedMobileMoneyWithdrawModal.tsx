"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Smartphone, AlertCircle, CheckCircle, Loader2, Info, X, ArrowLeft, Clock, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  enhancedOfframpService,
  ENHANCED_OFFRAMP_FIAT,
  formatEnhancedCurrencyAmount,
  type OfframpQuoteRequest,
  type OfframpInitiateRequest,
} from "@/lib/services/enhancedOfframpService"

interface EnhancedMobileMoneyWithdrawModalProps {
  isOpen: boolean
  onClose: () => void
  tokenSymbol: string
  tokenAddress: string
  network: string
  availableAmount: string
  decimals: number
  onWithdrawSuccess?: (orderID: string, amount: string) => void
  onBlockchainWithdraw: (tokenAddress: string, amount: string) => Promise<string>
  // Enhanced props for DAP integration
  userDeposits?: string
  userBorrows?: string
  isLocked?: boolean
  loanAmount?: string // For loan repayment scenarios
  transactionType?: "withdrawal" | "loan_repayment" | "excess_withdrawal"
}

interface WithdrawalStep {
  id: number
  title: string
  description: string
  completed: boolean
  current: boolean
}

export function MobileMoneyWithdrawModal({
  isOpen,
  onClose,
  tokenSymbol,
  tokenAddress,
  network,
  availableAmount,
  decimals,
  onWithdrawSuccess,
  onBlockchainWithdraw,
  userDeposits = "0",
  userBorrows = "0",
  isLocked = false,
  loanAmount = "0",
  transactionType = "withdrawal",
}: EnhancedMobileMoneyWithdrawModalProps) {
  const { toast } = useToast()

  const [currentStep, setCurrentStep] = useState(1)
  const [form, setForm] = useState({
    phoneNumber: "",
    amount: "",
    fiatCurrency: "KES",
  })

  const [quote, setQuote] = useState<any>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [transactionHash, setTransactionHash] = useState("")
  const [orderID, setOrderID] = useState("")

  const [optimizationSuggestion, setOptimizationSuggestion] = useState<any>(null)
  const [constraintValidation, setConstraintValidation] = useState<any>(null)

  const steps: WithdrawalStep[] = [
    {
      id: 1,
      title: "Phone & Amount",
      description: "Enter your details",
      completed: currentStep > 1,
      current: currentStep === 1,
    },
    {
      id: 2,
      title: "Review",
      description: "Confirm details",
      completed: currentStep > 2,
      current: currentStep === 2,
    },
    {
      id: 3,
      title: "Processing",
      description: "Sending money",
      completed: currentStep > 3,
      current: currentStep === 3,
    },
    {
      id: 4,
      title: "Complete",
      description: "Money sent",
      completed: currentStep === 4,
      current: currentStep === 4,
    },
  ]

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setForm({
        phoneNumber: "",
        amount: "",
        fiatCurrency: "KES",
      })
      setQuote(null)
      setTransactionHash("")
      setOrderID("")
      setOptimizationSuggestion(null)
      setConstraintValidation(null)
    }
  }, [isOpen])

  // Get optimization suggestions when token/fiat changes
  useEffect(() => {
    if (tokenSymbol && form.fiatCurrency) {
      const suggestion = enhancedOfframpService.getOptimalWithdrawalPath(
        tokenSymbol,
        form.amount || "1",
        form.fiatCurrency,
      )
      setOptimizationSuggestion(suggestion)
    }
  }, [tokenSymbol, form.fiatCurrency])

  // Validate constraints when amount changes
  useEffect(() => {
    if (form.amount && Number.parseFloat(form.amount) > 0) {
      const validation = enhancedOfframpService.validateWithdrawalConstraints(
        tokenAddress,
        form.amount,
        userDeposits,
        userBorrows,
        isLocked,
      )
      setConstraintValidation(validation)
    }
  }, [form.amount, tokenAddress, userDeposits, userBorrows, isLocked])

  // Get quote when amount changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (form.amount && Number.parseFloat(form.amount) > 0) {
        getWithdrawalQuote()
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [form.amount, form.fiatCurrency])

  const getWithdrawalQuote = async () => {
    if (!form.amount || Number.parseFloat(form.amount) <= 0) return

    setLoadingQuote(true)

    try {
      const quoteRequest: OfframpQuoteRequest = {
        amount: form.amount,
        fiatCurrency: form.fiatCurrency,
        cryptoCurrency: tokenSymbol,
        network: network,
        category: "B2C",
        tokenAddress: tokenAddress,
      }

      const result = await enhancedOfframpService.getOfframpQuote(quoteRequest)

      if (result.success && result.data) {
        setQuote(result.data)
      } else {
        throw new Error(result.error || "Failed to get quote")
      }
    } catch (error: any) {
      toast({
        title: "Rate Error",
        description: "Unable to get current rates. Please try again.",
        variant: "destructive",
      })
      setQuote(null)
    } finally {
      setLoadingQuote(false)
    }
  }

  const validateForm = (): boolean => {
    if (!form.phoneNumber || !form.amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return false
    }

    if (!enhancedOfframpService.validatePhoneNumber(form.phoneNumber, form.fiatCurrency)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number for your selected currency",
        variant: "destructive",
      })
      return false
    }

    // Check constraint validation
    if (constraintValidation && !constraintValidation.valid) {
      return false // Error already shown in UI
    }

    const amount = Number.parseFloat(form.amount)
    const available = Number.parseFloat(availableAmount)

    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount greater than 0",
        variant: "destructive",
      })
      return false
    }

    if (amount > available) {
      toast({
        title: "Insufficient Balance",
        description: "The withdrawal amount exceeds your available balance",
        variant: "destructive",
      })
      return false
    }

    const limits = enhancedOfframpService.getWithdrawalLimits(form.fiatCurrency)
    if (quote && Number.parseFloat(quote.outputAmount) < limits.min) {
      toast({
        title: "Amount Too Small",
        description: `Minimum withdrawal is ${formatEnhancedCurrencyAmount(limits.min, form.fiatCurrency)}`,
        variant: "destructive",
      })
      return false
    }

    return true
  }

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateForm() && quote) {
        setCurrentStep(2)
      }
    } else if (currentStep === 2) {
      handleBlockchainWithdraw()
    }
  }

  const handleBlockchainWithdraw = async () => {
    setCurrentStep(3)
    setProcessing(true)

    try {
      // Calculate transaction breakdown for complex scenarios
      let loanPaymentAmount = "0"
      let excessWithdrawalAmount = form.amount

      if (transactionType === "loan_repayment" && loanAmount && Number.parseFloat(loanAmount) > 0) {
        const flow = enhancedOfframpService.calculateLoanRepaymentFlow(
          loanAmount,
          availableAmount,
          form.amount,
          decimals,
        )

        if (!flow.canRepayAndWithdraw) {
          throw new Error(`Insufficient balance. You need ${flow.shortfall} more to complete this transaction.`)
        }

        loanPaymentAmount = flow.loanPayment
        excessWithdrawalAmount = flow.excessWithdrawal
      }

      // Perform blockchain withdrawal
      const hash = await onBlockchainWithdraw(tokenAddress, form.amount)
      setTransactionHash(hash)

      // Wait for transaction confirmation
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Initiate mobile money transfer with enhanced data
      await initiateMobileMoneyTransfer(hash, loanPaymentAmount, excessWithdrawalAmount)
    } catch (error: any) {
      let userMessage = "Transaction failed. Please try again."

      if (error.message?.includes("insufficient")) {
        userMessage = "Insufficient balance for this transaction."
      } else if (error.message?.includes("rejected") || error.message?.includes("denied")) {
        userMessage = "Transaction was cancelled."
      } else if (error.message?.includes("network")) {
        userMessage = "Network error. Please check your connection."
      }

      toast({
        title: "Transaction Failed",
        description: userMessage,
        variant: "destructive",
      })
      setCurrentStep(2) // Go back to review step
    } finally {
      setProcessing(false)
    }
  }

  const initiateMobileMoneyTransfer = async (hash: string, loanPaymentAmount = "0", excessWithdrawalAmount = "0") => {
    setCurrentStep(4)

    try {
      const formattedPhone = enhancedOfframpService.formatPhoneNumber(form.phoneNumber, form.fiatCurrency)

      const initiateRequest: OfframpInitiateRequest = {
        chain: network,
        hash: hash,
        partyB: formattedPhone,
        tokenAddress: tokenAddress,
        project: "ministables-dap",
        loanPaymentAmount,
        excessWithdrawalAmount,
        transactionType,
      }

      const result = await enhancedOfframpService.initiateOfframp(initiateRequest)

      if (result.success && result.data) {
        setOrderID(result.data.orderID)

        toast({
          title: "Money Sent!",
          description: `Your ${tokenSymbol} has been converted and sent to ${form.phoneNumber}`,
        })

        if (onWithdrawSuccess) {
          onWithdrawSuccess(result.data.orderID, form.amount)
        }
      } else {
        throw new Error(result.error || "Failed to send money")
      }
    } catch (error: any) {
      let userMessage = "Unable to send money. Please try again."

      if (error.message?.includes("phone")) {
        userMessage = "Invalid phone number. Please check and try again."
      } else if (error.message?.includes("limit")) {
        userMessage = "Transaction amount exceeds daily limits."
      } else if (error.message?.includes("network")) {
        userMessage = "Mobile money service temporarily unavailable."
      }

      toast({
        title: "Transfer Failed",
        description: userMessage,
        variant: "destructive",
      })
    }
  }

  const handleClose = () => {
    if (!processing) {
      onClose()
    }
  }

  const fiatConfig = ENHANCED_OFFRAMP_FIAT[form.fiatCurrency as keyof typeof ENHANCED_OFFRAMP_FIAT]

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[420px] mx-auto bg-[#162013] border-0 shadow-2xl rounded-xl p-0 max-h-[90vh] overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-[#2e4328]">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <Smartphone className="w-5 h-5 mr-3 text-[#54d22d] flex-shrink-0" />
              <div className="min-w-0">
                <DialogTitle className="text-white text-lg font-semibold truncate">Send to Phone</DialogTitle>
                <DialogDescription className="text-[#a2c398] text-sm mt-1">
                  Convert {tokenSymbol} to mobile money
                </DialogDescription>
              </div>
            </div>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-[#a2c398] hover:text-white hover:bg-[#2e4328]"
              disabled={processing}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 py-4 border-b border-[#2e4328] bg-[#21301c]">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      step.completed
                        ? "bg-[#54d22d] text-[#162013]"
                        : step.current
                          ? "bg-[#426039] text-white"
                          : "bg-[#2e4328] text-[#a2c398]"
                    }`}
                  >
                    {step.completed ? <CheckCircle className="w-4 h-4" /> : step.id}
                  </div>
                  <div className="text-xs text-center mt-2 max-w-[60px]">
                    <div
                      className={`font-medium ${
                        step.current ? "text-[#54d22d]" : step.completed ? "text-[#54d22d]" : "text-[#a2c398]"
                      }`}
                    >
                      {step.title}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${step.completed ? "bg-[#54d22d]" : "bg-[#2e4328]"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {currentStep === 1 && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-[#a2c398] mb-2 block">Currency {fiatConfig?.flag}</Label>
                  <Select
                    value={form.fiatCurrency}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, fiatCurrency: value }))}
                  >
                    <SelectTrigger className="h-12 bg-[#21301c] border-[#426039] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#21301c] border-[#426039]">
                      {Object.entries(ENHANCED_OFFRAMP_FIAT).map(([currency, config]) => (
                        <SelectItem key={currency} value={currency} className="text-white hover:bg-[#2e4328]">
                          {config.flag} {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-[#a2c398] mb-2 block">Available</Label>
                  <div className="h-12 px-4 py-3 bg-[#21301c] border border-[#426039] rounded-md flex items-center text-sm font-medium text-white">
                    {Number.parseFloat(availableAmount).toFixed(4)} {tokenSymbol}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-[#a2c398] mb-2 block">Phone Number</Label>
                <Input
                  type="tel"
                  placeholder={form.fiatCurrency === "KES" ? "0712345678" : "+1234567890"}
                  value={form.phoneNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                  className="h-12 bg-[#21301c] border-[#426039] text-white placeholder:text-[#a2c398]"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-[#a2c398] mb-2 block">Amount ({tokenSymbol})</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="h-12 bg-[#21301c] border-[#426039] text-white placeholder:text-[#a2c398]"
                  min="0.01"
                  step="0.01"
                  max={availableAmount}
                />

                {Number.parseFloat(availableAmount) > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[0.25, 0.5, 0.75, 1].map((percentage) => (
                      <Button
                        key={percentage}
                        type="button"
                        variant="outline"
                        className="h-8 text-xs bg-[#21301c] border-[#426039] text-[#a2c398] hover:bg-[#2e4328] hover:text-white"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            amount: (Number.parseFloat(availableAmount) * percentage).toFixed(6),
                          }))
                        }
                      >
                        {percentage === 1 ? "Max" : `${percentage * 100}%`}
                      </Button>
                    ))}
                  </div>
                )}

                {loadingQuote && (
                  <div className="mt-3 flex items-center text-sm text-[#a2c398]">
                    <Loader2 className="w-3 h-3 animate-spin mr-2" />
                    Getting rates...
                  </div>
                )}

                {quote && !loadingQuote && (
                  <div className="mt-3 bg-[#21301c] border border-[#426039] rounded-lg p-4">
                    <div className="text-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[#a2c398]">You'll receive:</span>
                        <span className="font-semibold text-[#54d22d] text-lg">
                          {formatEnhancedCurrencyAmount(Number.parseFloat(quote.outputAmount), form.fiatCurrency)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs text-[#a2c398] pt-2 border-t border-[#2e4328]">
                        <div className="flex justify-between">
                          <span>Rate:</span>
                          <span className="text-white">
                            1 {tokenSymbol} = {quote.exchangeRate} {form.fiatCurrency}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fee:</span>
                          <span className="text-white">
                            {formatEnhancedCurrencyAmount(quote.fee?.feeInOutputCurrency || 0, form.fiatCurrency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {constraintValidation && !constraintValidation.valid && (
                  <div className="mt-3 bg-[#2e1a1a] border border-[#5c2e2e] rounded-lg p-4">
                    <div className="flex items-start">
                      <AlertCircle className="w-4 h-4 text-[#ff6b6b] mr-2 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <div className="font-medium text-[#ff6b6b] mb-1">Cannot Process</div>
                        <div className="text-[#ffb3b3] text-xs">
                          {constraintValidation.reason.includes("exceeds")
                            ? "Amount exceeds your available balance."
                            : constraintValidation.reason.includes("Minimum")
                              ? `Minimum amount is ${constraintValidation.reason.match(/\d+/)?.[0] || "10"} ${form.fiatCurrency}.`
                              : "Please check your amount and try again."}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && quote && (
            <div className="p-6 space-y-6">
              <div className="bg-[#21301c] border border-[#426039] rounded-lg p-4">
                <h3 className="font-semibold text-white mb-4 flex items-center">
                  <Shield className="w-4 h-4 mr-2 text-[#54d22d]" />
                  Review Details
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#a2c398]">Sending:</span>
                    <span className="font-medium text-white">
                      {form.amount} {tokenSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a2c398]">To phone:</span>
                    <span className="font-medium text-white">{form.phoneNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a2c398]">Exchange rate:</span>
                    <span className="font-medium text-white">
                      1 {tokenSymbol} = {quote.exchangeRate} {form.fiatCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#a2c398]">Fee:</span>
                    <span className="font-medium text-white">
                      {formatEnhancedCurrencyAmount(quote.fee?.feeInOutputCurrency || 0, form.fiatCurrency)}
                    </span>
                  </div>
                  <div className="border-t border-[#2e4328] pt-3 flex justify-between font-semibold text-base">
                    <span className="text-white">They'll receive:</span>
                    <span className="text-[#54d22d]">
                      {formatEnhancedCurrencyAmount(Number.parseFloat(quote.outputAmount), form.fiatCurrency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#2e2a1a] border border-[#5c5439] rounded-lg p-4">
                <div className="flex items-start">
                  <Info className="w-4 h-4 text-[#f59e0b] mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-[#fbbf24]">
                    <div className="font-medium mb-1">Processing Time</div>
                    <div className="text-xs text-[#fcd34d]">
                      Money will be sent within {quote.processingTime || "5-10 minutes"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="p-6 text-center space-y-6">
              <div className="w-16 h-16 bg-[#21301c] rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-[#54d22d] animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Sending Money</h3>
                <p className="text-sm text-[#a2c398]">
                  Converting your {tokenSymbol} and sending to {form.phoneNumber}...
                </p>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="p-6 text-center space-y-6">
              {orderID ? (
                <>
                  <div className="w-16 h-16 bg-[#21301c] rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-[#54d22d]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Money Sent!</h3>
                    <p className="text-sm text-[#a2c398] mb-4">Your mobile money transfer is being processed.</p>
                    <div className="bg-[#21301c] border border-[#426039] rounded-lg p-3">
                      <p className="text-xs text-[#a2c398] mb-1">Reference:</p>
                      <p className="font-mono text-sm font-medium text-white">{orderID}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-[#21301c] rounded-full flex items-center justify-center mx-auto">
                    <Clock className="w-8 h-8 text-[#54d22d]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Almost Done</h3>
                    <p className="text-sm text-[#a2c398]">Setting up your mobile money transfer...</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#2e4328] bg-[#21301c] p-6">
          {currentStep === 1 && (
            <div className="flex gap-3">
              <Button
                onClick={handleClose}
                variant="outline"
                className="flex-1 h-12 bg-[#162013] border-[#426039] text-[#a2c398] hover:bg-[#2e4328] hover:text-white"
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleNext}
                disabled={!quote || !validateForm() || loadingQuote}
                className="flex-1 bg-[#54d22d] hover:bg-[#4bc226] text-[#162013] h-12 font-medium"
              >
                {loadingQuote ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Review & Send"
                )}
              </Button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex gap-3">
              <Button
                onClick={() => setCurrentStep(1)}
                variant="outline"
                className="flex-1 h-12 bg-[#162013] border-[#426039] text-[#a2c398] hover:bg-[#2e4328] hover:text-white"
                disabled={processing}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={processing}
                className="flex-1 bg-[#54d22d] hover:bg-[#4bc226] text-[#162013] h-12 font-medium"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Confirm & Send"
                )}
              </Button>
            </div>
          )}

          {(currentStep === 3 || currentStep === 4) && (
            <Button
              onClick={handleClose}
              disabled={processing && !orderID}
              className="w-full bg-[#54d22d] hover:bg-[#4bc226] text-[#162013] h-12 font-medium"
            >
              {orderID ? "Done" : "Processing..."}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}