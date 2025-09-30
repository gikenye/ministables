"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useActiveAccount } from "thirdweb/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Smartphone, AlertCircle, CheckCircle, Loader2, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ScrollUsdcOnrampModalProps {
  isOpen: boolean
  onClose: () => void
  selectedAsset: string
  assetSymbol: string
  onSuccess?: (transactionCode: string, amount: number) => void
}

// Supported countries and networks for Scroll USDC onramp
const SUPPORTED_COUNTRIES = {
  KES: { name: "Kenya", flag: "🇰🇪", networks: ["Safaricom"] },
  UGX: { name: "Uganda", flag: "🇺🇬", networks: ["MTN"] },
  CDF: { name: "Congo", flag: "🇨🇩", networks: ["MTN"] },
} as const;

const COUNTRY_LIMITS = {
  KES: { min: 20, max: 250000 },
  UGX: { min: 500, max: 5000000 },
  CDF: { min: 100, max: 1000000 },
} as const;

export function ScrollUsdcOnrampModal({
  isOpen,
  onClose,
  selectedAsset,
  assetSymbol,
  onSuccess,
}: ScrollUsdcOnrampModalProps) {
  const account = useActiveAccount()
  const address = account?.address
  const { toast } = useToast()

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

  // Load exchange rate for selected country
  const loadExchangeRate = async (currencyCode: string) => {
    setLoadingRate(true)
    try {
      // For now, use mock exchange rates
      const mockRates = {
        KES: 130, // 1 USDC = 130 KES
        UGX: 3700, // 1 USDC = 3700 UGX
        CDF: 2500, // 1 USDC = 2500 CDF
      }
      setExchangeRate(mockRates[currencyCode as keyof typeof mockRates] || 130)
    } catch (error) {
      console.error("Failed to load exchange rate:", error)
      setExchangeRate(130) // Fallback rate
    } finally {
      setLoadingRate(false)
    }
  }

  // Auto-detect country when phone number changes
  useEffect(() => {
    if (form.phoneNumber) {
      const cleaned = form.phoneNumber.replace(/\D/g, "");
      let detectedCountry = form.countryCode;
      
      if (cleaned.startsWith("254") || (cleaned.startsWith("07") && cleaned.length === 9)) {
        detectedCountry = "KES";
      } else if (cleaned.startsWith("256") || (cleaned.startsWith("07") && cleaned.length === 9)) {
        detectedCountry = "UGX";
      } else if (cleaned.startsWith("243")) {
        detectedCountry = "CDF";
      }
      
      if (detectedCountry !== form.countryCode) {
        setForm((prev) => ({ ...prev, countryCode: detectedCountry }))
        loadExchangeRate(detectedCountry)
      }
    }
  }, [form.phoneNumber])

  // Format phone number for API
  const formatPhoneNumber = (phone: string, countryCode: string = "KES"): string => {
    let cleaned = phone.replace(/\D/g, "");
    
    switch (countryCode) {
      case "KES":
        if (cleaned.startsWith("254")) {
          cleaned = "0" + cleaned.substring(3);
        } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
          cleaned = "0" + cleaned;
        }
        break;
      case "UGX":
        if (cleaned.startsWith("256")) {
          cleaned = "0" + cleaned.substring(3);
        } else if (cleaned.startsWith("7")) {
          cleaned = "0" + cleaned;
        }
        break;
      case "CDF":
        if (cleaned.startsWith("243")) {
          cleaned = "0" + cleaned.substring(3);
        }
        break;
    }
    
    return cleaned;
  }

  // Validate phone number (mock validation for now)
  const validatePhoneNumber = async () => {
    if (!form.phoneNumber || !form.mobileNetwork) return

    setValidation((prev) => ({ ...prev, isValidating: true, error: "" }))

    try {
      // Mock validation - in real implementation, this would call an API
      await new Promise(resolve => setTimeout(resolve, 1500)) // Simulate API call
      
      const formattedPhone = formatPhoneNumber(form.phoneNumber, form.countryCode)
      
      // Simple validation
      if (formattedPhone.length >= 9) {
        setValidation({
          isValidating: false,
          isValid: true,
          accountName: "Verified User",
          error: "",
        })
      } else {
        setValidation({
          isValidating: false,
          isValid: false,
          accountName: "",
          error: "Invalid phone number format",
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

  const handleScrollUsdcOnramp = async () => {
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

    // Check amount limits
    const limits = COUNTRY_LIMITS[form.countryCode as keyof typeof COUNTRY_LIMITS] || { min: 1, max: 1000000 };
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

      // Create recipient mapping first
      const mappingResponse = await fetch("/api/usdc/recipients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mapping_type: 'onramp',
          user_address: address,
          phone_number: formattedPhone,
          mobile_network: form.mobileNetwork,
          currency_code: form.countryCode,
          asset: assetSymbol,
          chain: 'SCROLL'
        }),
      });

      if (!mappingResponse.ok) {
        throw new Error("Failed to create recipient mapping");
      }

      // Mock transaction code generation (in real implementation, this would be from payment provider)
      const transactionCode = `SCROLL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      setTransaction({
        isProcessing: false,
        isComplete: true,
        transactionCode: transactionCode,
        error: "",
      })
      setCurrentStep(4)

      toast({
        title: "Onramp Initiated",
        description: `Please complete the payment on your phone. Send ${form.amount} ${form.countryCode} to complete your USDC onramp.`,
      })

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(transactionCode, Number.parseFloat(form.amount))
      }

    } catch (error: any) {
      setTransaction({
        isProcessing: false,
        isComplete: false,
        transactionCode: "",
        error: error.message || "Failed to process onramp",
      })

      toast({
        title: "Onramp Failed",
        description: error.message || "Failed to initiate Scroll USDC onramp.",
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
              <p className="text-[#a2c398] text-sm">Scroll Network</p>
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
                          Limits: {COUNTRY_LIMITS[form.countryCode as keyof typeof COUNTRY_LIMITS]?.min || 1}-
                          {COUNTRY_LIMITS[form.countryCode as keyof typeof COUNTRY_LIMITS]?.max || 1000000} {form.countryCode}
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
                        <div>3. Receive {assetSymbol} on Scroll network</div>
                      </div>
                      <div className="text-[#54d22d] mt-2 text-xs">
                        To: {address?.slice(0, 8)}...{address?.slice(-6)}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleScrollUsdcOnramp}
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
                  <h3 className="text-white text-lg font-medium mb-2">Onramp Initiated!</h3>
                  <p className="text-[#a2c398] text-sm mb-4">
                    Complete the mobile money payment to receive {assetSymbol} on Scroll network.
                  </p>
                  {transaction.transactionCode && (
                    <div className="bg-[#21301c] border border-[#426039] rounded-xl p-4 mb-4">
                      <p className="text-[#a2c398] text-sm mb-1">Transaction Code:</p>
                      <p className="font-mono text-sm font-medium text-white">{transaction.transactionCode}</p>
                    </div>
                  )}
                  <div className="bg-[#1a2917] border border-[#426039] rounded-xl p-3">
                    <p className="text-[#a2c398] text-xs">
                      Your {assetSymbol} will appear in your wallet once the mobile money payment is completed and processed on Scroll network.
                    </p>
                  </div>
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