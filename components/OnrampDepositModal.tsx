"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActiveAccount } from "thirdweb/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Smartphone, AlertCircle, CheckCircle, Loader2, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  onrampService,
  SUPPORTED_COUNTRIES,
  formatPhoneNumber,
  detectCountryFromPhone,
  type OnrampRequest,
} from "@/lib/services/onrampService"
import { getContractAddress } from "@/config/chainConfig"
import { celo } from "thirdweb/chains"

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
  const { toast } = useToast()

  // Log what we're receiving
  console.log("[OnrampDepositModal] Props received:", {
    selectedAsset,
    assetSymbol,
    isOpen
  })

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
      loadExchangeRate("KES")
    }
  }, [isOpen])

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
          accountName: result.name || "Verified",
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
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      })
      return
    }

    if (!validation.isValid) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number.",
        variant: "destructive",
      })
      return
    }

    if (!form.amount || Number.parseFloat(form.amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount.",
        variant: "destructive",
      })
      return
    }

    // Check if asset is supported for onramp
    const chain = onrampService.getChainForAsset(assetSymbol)
    if (!onrampService.isAssetSupportedForOnramp(assetSymbol, chain)) {
      toast({
        title: "Asset Not Supported",
        description: `${assetSymbol} is not supported for mobile money deposits.`,
        variant: "destructive",
      })
      return
    }

    // Check amount limits
    const limits = onrampService.getCountryLimits(form.countryCode)
    const amount = Number.parseFloat(form.amount)
    if (amount < limits.min || amount > limits.max) {
      toast({
        title: "Amount Out of Range",
        description: `Amount must be between ${limits.min} and ${limits.max} ${form.countryCode}.`,
        variant: "destructive",
      })
      return
    }

    setTransaction((prev) => ({ ...prev, isProcessing: true, error: "" }))

    try {
      const formattedPhone = formatPhoneNumber(form.phoneNumber, form.countryCode)
      const minilendContractAddress = getContractAddress(celo.id)

      const onrampRequest: OnrampRequest = {
        shortcode: formattedPhone,
        amount: Number.parseFloat(form.amount),
        fee: Math.round(Number.parseFloat(form.amount) * 0.02), // 2% fee estimate
        mobile_network: form.mobileNetwork,
        chain: chain,
        asset: assetSymbol,
        address: address,
        callback_url: `${window.location.origin}/api/onramp/callback`,
      }

      const result = await onrampService.initiateOnramp(
        onrampRequest, 
        form.countryCode,
        minilendContractAddress,
        address
      )

      if (result.success) {
        setTransaction({
          isProcessing: false,
          isComplete: true,
          transactionCode: result.transaction_code || "",
          error: "",
        })
        setCurrentStep(4)

        toast({
          title: "Deposit Initiated",
          description: "Complete payment on your phone. Assets will be automatically deposited to your Minilend account.",
        })

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(result.transaction_code || "", Number.parseFloat(form.amount))
        }
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

      toast({
        title: "Deposit Failed",
        description: error.message || "Failed to initiate mobile money deposit.",
        variant: "destructive",
      })
    }
  }

  const handleClose = () => {
    if (!transaction.isProcessing) {
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
      <DialogContent className="w-full max-w-md mx-auto bg-[#162013] border-0 shadow-lg p-0 overflow-hidden">
        <div className="flex h-5 w-full items-center justify-center bg-[#162013]">
          <div className="h-1 w-9 rounded-full bg-[#426039]"></div>
        </div>

        <div className="px-4 pb-5">
          <div className="flex items-center justify-between pt-5 pb-3">
            {currentStep > 1 && !transaction.isComplete && (
              <button onClick={prevStep} className="p-1 text-[#a2c398] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 text-center">
              <h1 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">Get {assetSymbol}</h1>
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
            {currentStep > 1 && !transaction.isComplete && <div className="w-7" />}
          </div>

          {transaction.error && (
            <div className="bg-red-900/20 border border-red-700 text-red-300 p-3 rounded-xl text-sm mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{transaction.error}</span>
            </div>
          )}

          <div className="min-h-[300px]">
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">Select country & network</h3>
                  <p className="text-[#a2c398] text-sm">Choose your mobile money provider</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-[#a2c398] text-sm font-medium mb-2 block">Country</Label>
                    <Select
                      value={form.countryCode}
                      onValueChange={(value) => {
                        setForm((prev) => ({ ...prev, countryCode: value, mobileNetwork: "" }))
                        loadExchangeRate(value)
                      }}
                    >
                      <SelectTrigger className="h-12 bg-[#21301c] border-[#426039] text-white focus:border-[#54d22d]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#21301c] border-[#426039]">
                        {Object.entries(SUPPORTED_COUNTRIES).map(([code, country]) => (
                          <SelectItem key={code} value={code} className="text-white hover:bg-[#2a3d24]">
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
                    <Label className="text-[#a2c398] text-sm font-medium mb-2 block">Mobile Network</Label>
                    <Select
                      value={form.mobileNetwork}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, mobileNetwork: value }))}
                    >
                      <SelectTrigger className="h-12 bg-[#21301c] border-[#426039] text-white focus:border-[#54d22d]">
                        <SelectValue placeholder="Select network" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#21301c] border-[#426039]">
                        {availableNetworks.map((network) => (
                          <SelectItem key={network} value={network} className="text-white hover:bg-[#2a3d24]">
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
                  className="w-full h-12 bg-[#54d22d] text-[#162013] text-base font-bold rounded-xl hover:bg-[#4bc428] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">Enter phone number</h3>
                  <p className="text-[#a2c398] text-sm">We'll verify your {form.mobileNetwork} account</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-[#a2c398] text-sm font-medium mb-2 block">Phone Number</Label>
                    <div className="relative">
                      <Input
                        type="tel"
                        placeholder="0712345678"
                        value={form.phoneNumber}
                        onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                        className="h-12 bg-[#21301c] border-[#426039] text-white focus:border-[#54d22d] pr-10"
                      />
                      {validation.isValidating && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-[#a2c398]" />
                      )}
                      {validation.isValid && !validation.isValidating && (
                        <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#54d22d]" />
                      )}
                    </div>
                    {validation.isValid && validation.accountName && (
                      <p className="text-sm text-[#54d22d] mt-2 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {validation.accountName}
                      </p>
                    )}
                    {validation.error && (
                      <p className="text-sm text-red-400 mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {validation.error}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={nextStep}
                  disabled={!validation.isValid}
                  className="w-full h-12 bg-[#54d22d] text-[#162013] text-base font-bold rounded-xl hover:bg-[#4bc428] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">Enter amount</h3>
                  <p className="text-[#a2c398] text-sm">How much {form.countryCode} do you want to deposit?</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-[#a2c398] text-sm font-medium mb-2 block">Amount ({form.countryCode})</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="100"
                        value={form.amount}
                        onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                        className="h-16 bg-[#21301c] border-[#426039] text-white focus:border-[#54d22d] text-2xl font-medium text-center pr-16"
                        min="1"
                        step="1"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a2c398] text-sm">
                        {form.countryCode}
                      </div>
                    </div>

                    {/* Exchange Rate & Limits */}
                    <div className="mt-3 space-y-2">
                      {exchangeRate && form.amount && (
                        <div className="bg-[#21301c] border border-[#426039] rounded-xl p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[#a2c398] text-sm">You receive:</span>
                            <span className="font-medium text-[#54d22d]">
                              ≈ {(Number.parseFloat(form.amount) / exchangeRate).toFixed(4)} {assetSymbol}
                            </span>
                          </div>
                        </div>
                      )}

                      {form.countryCode && (
                        <p className="text-xs text-[#a2c398] text-center">
                          Limits: {onrampService.getCountryLimits(form.countryCode).min}-
                          {onrampService.getCountryLimits(form.countryCode).max} {form.countryCode}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info Section */}
                <div className="bg-[#21301c] border border-[#426039] rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-[#54d22d] mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-[#a2c398]">
                      <div className="font-medium text-white mb-2">How it works:</div>
                      <div className="space-y-1">
                        <div>1. Confirm your deposit details</div>
                        <div>2. Complete payment on your phone</div>
                        <div>3. Assets auto-deposited to Minilend</div>
                      </div>
                      <div className="text-[#54d22d] mt-2 text-xs">
                        Auto-deposit to your Minilend account
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleOnrampDeposit}
                  disabled={
                    transaction.isProcessing ||
                    !validation.isValid ||
                    !form.amount ||
                    Number.parseFloat(form.amount) <= 0
                  }
                  className="w-full h-12 bg-[#54d22d] text-[#162013] text-base font-bold rounded-xl hover:bg-[#4bc428] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
                <div className="w-16 h-16 bg-[#54d22d]/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-[#54d22d]" />
                </div>
                <div>
                  <h3 className="text-white text-lg font-medium mb-2">Deposit Initiated!</h3>
                  <p className="text-[#a2c398] text-sm mb-4">
                    Complete the payment on your phone to receive {assetSymbol} in your wallet.
                  </p>
                  {transaction.transactionCode && (
                    <div className="bg-[#21301c] border border-[#426039] rounded-xl p-4 mb-4">
                      <p className="text-[#a2c398] text-sm mb-1">Transaction Code:</p>
                      <p className="font-mono text-sm font-medium text-white">{transaction.transactionCode}</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleClose}
                  className="w-full h-12 bg-[#54d22d] text-[#162013] text-base font-bold rounded-xl hover:bg-[#4bc428] transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
