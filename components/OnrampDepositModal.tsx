"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActiveAccount } from "thirdweb/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Smartphone, AlertCircle, CheckCircle, Loader2, Info } from "lucide-react"
import {
  onrampService,
  SUPPORTED_COUNTRIES,
  formatPhoneNumber,
  detectCountryFromPhone,
  type OnrampRequest,
} from "@/lib/services/onrampService"
import { useChain } from "@/components/ChainProvider"

interface OnrampDepositModalProps {
  isOpen: boolean
  onClose: () => void
  selectedAsset: string
  assetSymbol: string
  onSuccess?: (transactionCode: string, amount: number) => void
}

export function OnrampDepositModal({
  isOpen,
  onClose,
  selectedAsset,
  assetSymbol,
  onSuccess,
}: OnrampDepositModalProps) {
  const account = useActiveAccount()
  const address = account?.address
  const { chain } = useChain()

  const [currentStep, setCurrentStep] = useState(1)
  const [form, setForm] = useState({
    phoneNumber: "",
    amount: "",
    mobileNetwork: "",
    countryCode: "KES",
  })

  const [validation, setValidation] = useState({
    isValidating: false,
    isValid: false,
    accountName: "",
    error: "",
  })

  const [transaction, setTransaction] = useState({
    isProcessing: false,
    isComplete: false,
    transactionCode: "",
    error: "",
  })

  const [exchangeRate, setExchangeRate] = useState<number | null>(null)
  const [loadingRate, setLoadingRate] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "completed" | "failed">("pending")
  const [completedTransaction, setCompletedTransaction] = useState<any>(null)

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setForm({
        phoneNumber: "",
        amount: "",
        mobileNetwork: "",
        countryCode: "KES",
      })
      setValidation({
        isValidating: false,
        isValid: false,
        accountName: "",
        error: "",
      })
      setTransaction({
        isProcessing: false,
        isComplete: false,
        transactionCode: "",
        error: "",
      })
      setPaymentStatus("pending")
      loadExchangeRate("KES")
    }
  }, [isOpen])

  // Poll transaction status
  useEffect(() => {
    if (currentStep === 4 && transaction.transactionCode && paymentStatus === "pending") {
      const pollInterval = setInterval(async () => {
        try {
          const status = await onrampService.getTransactionStatus(
            transaction.transactionCode,
            form.countryCode
          );
          
          if (status?.status === "COMPLETE" || status?.status === "SUCCESS") {
            setCompletedTransaction(status);
            setPaymentStatus("completed");
            clearInterval(pollInterval);
          } else if (status?.status === "FAILED" || status?.status === "CANCELLED") {
            setPaymentStatus("failed");
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error("Failed to check transaction status:", error);
        }
      }, 5000);

      return () => clearInterval(pollInterval);
    }
  }, [currentStep, transaction.transactionCode, paymentStatus, form.countryCode])

  // Auto-detect country when phone number changes
  useEffect(() => {
    if (form.phoneNumber) {
      const detectedCountry = detectCountryFromPhone(form.phoneNumber)
      if (detectedCountry !== form.countryCode) {
        setForm((prev) => ({ ...prev, countryCode: detectedCountry }))
        loadExchangeRate(detectedCountry)
      }
    }
  }, [form.phoneNumber])

  // Load exchange rate for selected country
  const loadExchangeRate = async (currencyCode: string) => {
    setLoadingRate(true)
    try {
      const result = await onrampService.getExchangeRate(currencyCode)
      if (result.success && result.rate) {
        setExchangeRate(result.rate)
      }
    } catch (error) {
      console.error("Failed to load exchange rate:", error)
    } finally {
      setLoadingRate(false)
    }
  }

  // Validate phone number
  const validatePhoneNumber = async () => {
    if (!form.phoneNumber || !form.mobileNetwork) return

    setValidation((prev) => ({ ...prev, isValidating: true, error: "" }))

    try {
      const formattedPhone = formatPhoneNumber(form.phoneNumber, form.countryCode)
      const result = await onrampService.validatePaymentMethod(
        {
          type: "MOBILE",
          shortcode: formattedPhone,
          mobile_network: form.mobileNetwork,
        },
        form.countryCode,
      )

      if (result.success) {
        setValidation({
          isValidating: false,
          isValid: true,
          accountName: result.name || "",
          error: "",
        })
      } else {
        setValidation({
          isValidating: false,
          isValid: false,
          accountName: "",
          error: result.error || "Phone number validation failed",
        })
      }
    } catch (error: any) {
      setValidation({
        isValidating: false,
        isValid: false,
        accountName: "",
        error: error.message || "Validation failed",
      })
    }
  }

  // Trigger validation when phone number or network changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (form.phoneNumber && form.mobileNetwork) {
        validatePhoneNumber()
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [form.phoneNumber, form.mobileNetwork, form.countryCode])

  const handleOnrampDeposit = async () => {
    if (!address) {
      setTransaction((prev) => ({ ...prev, error: "Please connect your wallet first." }))
      return
    }

    if (!validation.isValid) {
      setTransaction((prev) => ({ ...prev, error: "Please enter a valid phone number." }))
      return
    }

    if (!form.amount || Number.parseFloat(form.amount) <= 0) {
      setTransaction((prev) => ({ ...prev, error: "Please enter a valid amount." }))
      return
    }

    // Check if asset is supported for onramp
    const chainName = chain?.id === 42220 ? "CELO" : chain?.name?.split(" ")[0]?.toUpperCase() || "CELO"
    console.log("[OnrampDepositModal] Checking asset support:", {
      selectedAsset,
      assetSymbol,
      chainName,
      chainId: chain?.id,
    })
    const isSupported = onrampService.isAssetSupportedForOnramp(selectedAsset, chainName)
    console.log("[OnrampDepositModal] Is asset supported?", isSupported)
    if (!isSupported) {
      setTransaction((prev) => ({ ...prev, error: `${assetSymbol} is not supported for mobile money deposits.` }))
      return
    }

    // Check amount limits
    const limits = onrampService.getCountryLimits(form.countryCode)
    const amount = Number.parseFloat(form.amount)
    if (amount < limits.min || amount > limits.max) {
      setTransaction((prev) => ({ ...prev, error: `Amount must be between ${limits.min} and ${limits.max} ${form.countryCode}.` }))
      return
    }

    setTransaction((prev) => ({ ...prev, isProcessing: true, error: "" }))

    try {
      const formattedPhone = formatPhoneNumber(form.phoneNumber, form.countryCode)

      // Get vault address for the selected asset
      const tokenSymbol = assetSymbol
      const vaultAddress = onrampService.getVaultAddress(42220, tokenSymbol)

      const onrampRequest: OnrampRequest = {
        shortcode: formattedPhone,
        amount: Number.parseFloat(form.amount),
        fee: Math.round(Number.parseFloat(form.amount) * 0.1), // 10% fee estimate
        mobile_network: form.mobileNetwork,
        chain: chainName,
        asset: tokenSymbol,
        address: address,
        callback_url: `${window.location.origin}/api/onramp/callback`,
      }

      const result = await onrampService.initiateOnramp(onrampRequest, form.countryCode, vaultAddress)

      if (result.success) {
        setTransaction({
          isProcessing: false,
          isComplete: true,
          transactionCode: result.transaction_code || "",
          error: "",
        })
        setCurrentStep(4)
      } else {
        throw new Error(result.error || "Failed to initiate deposit")
      }
    } catch (error: any) {
      setTransaction({
        isProcessing: false,
        isComplete: false,
        transactionCode: "",
        error: error.message || "Failed to process deposit",
      })
    }
  }

  const handleClose = () => {
    if (!transaction.isProcessing) {
      // Call success callback when closing after transaction initiated
      if (transaction.isComplete && transaction.transactionCode && onSuccess) {
        onSuccess(transaction.transactionCode, Number.parseFloat(form.amount))
      }
      onClose()
    }
  }

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const selectedCountry = SUPPORTED_COUNTRIES[form.countryCode as keyof typeof SUPPORTED_COUNTRIES]
  const availableNetworks = selectedCountry?.networks || []

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md mx-auto bg-background border-0 shadow-lg p-0 overflow-hidden">
        <div className="flex h-5 w-full items-center justify-center bg-background">
          <div className="h-1 w-9 rounded-full bg-muted"></div>
        </div>

        <div className="px-4 pb-5">
          <div className="flex items-center justify-between pt-5 pb-3">
            {currentStep > 1 && !transaction.isComplete && (
              <button onClick={prevStep} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 text-center">
              <h1 className="text-foreground text-[15px] font-medium leading-tight tracking-[-0.015em]"> Depositing {assetSymbol} ...</h1>
              <div className="flex justify-center gap-1 mt-2">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      step <= currentStep ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
            {currentStep > 1 && !transaction.isComplete && <div className="w-7" />}
          </div>

          {transaction.error && (
            <div className="bg-destructive/20 border border-destructive text-destructive-foreground p-3 rounded-xl text-sm mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{transaction.error}</span>
            </div>
          )}

          <div className="min-h-[300px]">
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-foreground text-lg font-medium mb-2">Select country & network</h3>
                  <p className="text-muted-foreground text-sm">Choose your mobile money provider</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground text-sm font-medium mb-2 block">Country</Label>
                    <Select
                      value={form.countryCode}
                      onValueChange={(value) => {
                        setForm((prev) => ({ ...prev, countryCode: value, mobileNetwork: "" }))
                        loadExchangeRate(value)
                      }}
                    >
                      <SelectTrigger className="h-12 bg-card border-border text-foreground focus:border-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {Object.entries(SUPPORTED_COUNTRIES).map(([code, country]) => (
                          <SelectItem key={code} value={code} className="text-foreground hover:bg-card/80">
                            <span className="flex items-center gap-2">
                              <span className="text-lg">{country.flag}</span>
                              <span>{code}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-sm font-medium mb-2 block">Mobile Network</Label>
                    <Select
                      value={form.mobileNetwork}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, mobileNetwork: value }))}
                    >
                      <SelectTrigger className="h-12 bg-card border-border text-foreground focus:border-primary">
                        <SelectValue placeholder="Select network" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {availableNetworks.map((network) => (
                          <SelectItem key={network} value={network} className="text-foreground hover:bg-card/80">
                            {network}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <button
                  onClick={nextStep}
                  disabled={!form.countryCode || !form.mobileNetwork}
                  className="w-full h-12 bg-primary text-primary-foreground text-base font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-foreground text-lg font-medium mb-2">Enter phone number</h3>
                  <p className="text-muted-foreground text-sm">We'll verify your {form.mobileNetwork} account</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground text-sm font-medium mb-2 block">Phone Number</Label>
                    <div className="relative">
                      <Input
                        type="tel"
                        placeholder="0712345678"
                        value={form.phoneNumber}
                        onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                        className="h-12 bg-card border-border text-foreground focus:border-primary pr-10"
                      />
                      {validation.isValidating && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                      {validation.isValid && !validation.isValidating && (
                        <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-primary" />
                      )}
                    </div>
                    {validation.isValid && validation.accountName && (
                      <p className="text-sm text-primary mt-2 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {validation.accountName}
                      </p>
                    )}
                    {validation.error && (
                      <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {validation.error}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={nextStep}
                  disabled={!validation.isValid}
                  className="w-full h-12 bg-primary text-primary-foreground text-base font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground text-sm font-medium mb-2 block">Amount ({form.countryCode})</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="100"
                        value={form.amount}
                        onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                        className="h-16 bg-card border-border text-foreground focus:border-primary text-2xl font-medium text-center pr-16"
                        min="1"
                        step="1"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        {form.countryCode}
                      </div>
                    </div>

                    {/* Exchange Rate & Limits */}
                    <div className="mt-3 space-y-2">
                      {exchangeRate && form.amount && (
                        <div className="bg-card border border-border rounded-xl p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-sm">You receive:</span>
                            <span className="font-medium text-primary">
                              ≈ {(Number.parseFloat(form.amount) / exchangeRate).toFixed(4)} {assetSymbol}
                            </span>
                          </div>
                        </div>
                      )}

                      {form.countryCode && (
                        <p className="text-xs text-muted-foreground text-center">
                          Limits: {onrampService.getCountryLimits(form.countryCode).min}-
                          {onrampService.getCountryLimits(form.countryCode).max} {form.countryCode}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info Section */}
                {/* <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-muted-foreground">
                      <div className="font-medium text-foreground mb-2">How it works:</div>
                      <div className="space-y-1">
                        <div>1. Confirm your deposit details</div>
                        <div>2. Complete payment on your phone</div>
                        <div>3. Receive {assetSymbol} in your wallet</div>
                      </div>
                      <div className="text-primary mt-2 text-xs">
                        To: {address?.slice(0, 8)}...{address?.slice(-6)}
                      </div>
                    </div>
                  </div>
                </div> */}

                <button
                  onClick={handleOnrampDeposit}
                  disabled={
                    transaction.isProcessing ||
                    !validation.isValid ||
                    !form.amount ||
                    Number.parseFloat(form.amount) <= 0 ||
                    Number.parseFloat(form.amount) < onrampService.getCountryLimits(form.countryCode).min
                  }
                  className="w-full h-12 bg-primary text-primary-foreground text-base font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {transaction.isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4" />
                      Confirm Deposit
                    </>
                  )}
                </button>
              </div>
            )}

            {currentStep === 4 && transaction.isComplete && (
              <div className="text-center space-y-6">
                {paymentStatus === "pending" && (
                  <>
                    <div>
                      <p className="text-muted-foreground text-sm mb-4">
                        Check your phone for the M-Pesa prompt and enter your PIN to complete the payment.
                      </p>
                      {/* {transaction.transactionCode && (
                        <div className="bg-card border border-border rounded-xl p-4 mb-4">
                          <p className="text-muted-foreground text-sm mb-1">Transaction Code:</p>
                          <p className="font-mono text-sm font-medium text-foreground">{transaction.transactionCode}</p>
                        </div>
                      )} */}
                      <div className="bg-warning/20 border border-warning text-foreground p-3 rounded-xl text-sm">
                        <p className="font-medium mb-1 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Waiting for payment...
                        </p>
                        <p className="text-xs">Once you complete the payment, your {assetSymbol} will be sent to your wallet.</p>
                      </div>
                    </div>
                  </>
                )}

                {paymentStatus === "completed" && (
                  <>
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-foreground text-lg font-medium mb-2">Payment Successful!</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        Your {assetSymbol} has been sent to your wallet.
                      </p>
                      <div className="bg-card border border-border rounded-xl p-4 space-y-3 mb-4">
                        {completedTransaction?.receipt_number && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-sm">M-Pesa Receipt:</span>
                            <span className="font-mono text-sm font-medium text-foreground">{completedTransaction.receipt_number}</span>
                          </div>
                        )}
                        {completedTransaction?.amount && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-sm">Amount Paid:</span>
                            <span className="font-medium text-foreground">{completedTransaction.amount} {completedTransaction.currency_code}</span>
                          </div>
                        )}
                        {completedTransaction?.amount_in_usd && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-sm">Received:</span>
                            <span className="font-medium text-primary">{completedTransaction.amount_in_usd} {assetSymbol}</span>
                          </div>
                        )}
                      </div>
                      <div className="bg-primary/10 border border-primary text-primary p-3 rounded-xl text-sm">
                        <p className="font-medium">✓ Transaction Complete</p>
                      </div>
                    </div>
                  </>
                )}

                {paymentStatus === "failed" && (
                  <>
                    <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto">
                      <AlertCircle className="w-8 h-8 text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-foreground text-lg font-medium mb-2">Payment Failed</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        The payment was not completed. Please try again.
                      </p>
                      <div className="bg-destructive/20 border border-destructive text-destructive-foreground p-3 rounded-xl text-sm">
                        <p className="font-medium">✗ Transaction Failed</p>
                      </div>
                    </div>
                  </>
                )}

                <button
                  onClick={handleClose}
                  className="w-full h-12 bg-primary text-primary-foreground text-base font-bold rounded-xl hover:bg-primary/90 transition-colors"
                >
                  {paymentStatus === "completed" ? "Done" : "Close"}
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
