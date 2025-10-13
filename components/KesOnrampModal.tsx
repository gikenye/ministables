"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Check, AlertCircle, Loader2, Copy } from "lucide-react"
import { useActiveAccount } from "thirdweb/react"

interface KesOnrampModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface KesOnrampStep {
  step: number
  title: string
  description: string
}

interface MobileNetwork {
  value: string
  label: string
  icon: string
}

interface PretiumCollectResponse {
  code: number
  message: string
  data: {
    transaction_code: string
    status: string
    message: string
  }
}

const ONRAMP_STEPS: KesOnrampStep[] = [
  { step: 1, title: "Phone Number", description: "Enter your M-Pesa phone number" },
  { step: 2, title: "Amount", description: "Enter KES amount to convert to USDC" },
  { step: 3, title: "Payment", description: "Complete M-Pesa payment" },
  { step: 4, title: "Confirmation", description: "Receive USDC in your wallet" }
]

const MOBILE_NETWORKS: MobileNetwork[] = [
  { value: "SAFARICOM", label: "Safaricom M-Pesa", icon: "🟢" },
  { value: "AIRTEL", label: "Airtel Money", icon: "🔴" }
]

export function KesOnrampModal({ isOpen, onClose, onSuccess }: KesOnrampModalProps) {
  const account = useActiveAccount()
  
  const [currentStep, setCurrentStep] = useState(1)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [mobileNetwork, setMobileNetwork] = useState("SAFARICOM")
  const [kesAmount, setKesAmount] = useState("")
  const [usdcAmount, setUsdcAmount] = useState("")
  const [exchangeRate] = useState(130) // KES per USDC
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [transactionCode, setTransactionCode] = useState("")
  const [shortcode] = useState("600000")
  const [trackingPayment, setTrackingPayment] = useState(false)

  // Reset modal state when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setPhoneNumber("")
      setKesAmount("")
      setUsdcAmount("")
      setError("")
      setTransactionCode("")
      setTrackingPayment(false)
    }
  }, [isOpen])

  // Listen for payment completion events
  useEffect(() => {
    if (!transactionCode) return

    const handleKesUpdate = (data: { transaction_code: string; status: string; message?: string }) => {
      if (data.transaction_code === transactionCode) {
        if (data.status === 'COMPLETED' || data.status === 'SUCCESS') {
          // Payment successful - wait for USDC transfer
          setTrackingPayment(true)
          setCurrentStep(4)
        } else if (data.status === 'FAILED') {
          setError(`Payment failed: ${data.message || 'Please try again'}`)
          setLoading(false)
          setTrackingPayment(false)
        }
      }
    }

    const handleOnrampCompletion = (data: { user_address?: string }) => {
      if (data.user_address?.toLowerCase() === account?.address?.toLowerCase()) {
        // USDC received successfully
        setTimeout(() => {
          onSuccess()
        }, 2000)
      }
    }

    // Use polling instead of event listeners for now
    const pollForUpdates = setInterval(() => {
      // Poll your API for transaction status
      fetch(`/api/pretium/kes/status/${transactionCode}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'COMPLETED' || data.status === 'SUCCESS') {
            handleKesUpdate(data)
            clearInterval(pollForUpdates)
          } else if (data.status === 'FAILED') {
            handleKesUpdate(data)
            clearInterval(pollForUpdates)
          }
        })
        .catch(console.error)
    }, 5000) // Poll every 5 seconds

    return () => {
      clearInterval(pollForUpdates)
    }
  }, [transactionCode, account?.address, onSuccess])
  // Calculate USDC amount when KES amount changes
  useEffect(() => {
    if (kesAmount && !isNaN(parseFloat(kesAmount))) {
      const usdcValue = (parseFloat(kesAmount) / exchangeRate).toFixed(6)
      setUsdcAmount(usdcValue)
    } else {
      setUsdcAmount("")
    }
  }, [kesAmount, exchangeRate])

  const validatePhoneNumber = (phone: string): boolean => {
    // Kenyan phone number validation
    const kenyanPhoneRegex = /^(\+254|254|0)([71][0-9]{8})$/
    return kenyanPhoneRegex.test(phone.replace(/\s/g, ''))
  }

  const formatPhoneNumber = (phone: string): string => {
    // Convert to +254 format
    let cleaned = phone.replace(/\s/g, '').replace(/^\+/, '')
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1)
    } else if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned
    }
    return '+' + cleaned
  }

  const handleNextStep = async (): Promise<void> => {
    setError("")

    if (currentStep === 1) {
      // Validate phone number
      if (!phoneNumber.trim()) {
        setError("Please enter your phone number")
        return
      }
      if (!validatePhoneNumber(phoneNumber)) {
        setError("Please enter a valid Kenyan phone number")
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      // Validate amount
      if (!kesAmount || isNaN(parseFloat(kesAmount))) {
        setError("Please enter a valid KES amount")
        return
      }
      const amount = parseFloat(kesAmount)
      if (amount < 100) {
        setError("Minimum amount is KES 100")
        return
      }
      if (amount > 100000) {
        setError("Maximum amount is KES 100,000")
        return
      }
      setCurrentStep(3)
      await initiateKesCollection()
    }
  }

  const initiateKesCollection = async (): Promise<void> => {
    if (!account?.address) {
      setError("Please connect your wallet")
      return
    }

    setLoading(true)
    try {
      // First, create recipient mapping for this onramp
      const mappingResponse = await fetch('/api/usdc/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_address: account.address,
          mapping_type: 'onramp',
          mobile_network: mobileNetwork,
          shortcode: shortcode,
          conversion_rate: exchangeRate,
          expected_kes_amount: parseFloat(kesAmount),
          expected_usdc_amount: parseFloat(usdcAmount)
        })
      })

      if (!mappingResponse.ok) {
        throw new Error('Failed to create recipient mapping')
      }

      // Initiate KES collection via Pretium
      const response = await fetch('/api/pretium/kes/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortcode: shortcode,
          amount: parseFloat(kesAmount),
          mobile_network: mobileNetwork,
          callback_url: `${window.location.origin}/api/pretium/callback/kes/log-collect`
        })
      })

      const result: PretiumCollectResponse = await response.json()

      if (!response.ok || result.code !== 200) {
        throw new Error(result.message || 'Failed to initiate KES collection')
      }

      setTransactionCode(result.data.transaction_code)
      
      setLoading(false)
    } catch (error) {
      console.error('KES collection error:', error)
      setError(error instanceof Error ? error.message : 'Failed to initiate payment')
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text).catch(console.error)
  }

  const goBack = (): void => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setError("")
    }
  }

  const handleClose = (): void => {
    if (!loading && !trackingPayment) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#0a0f0a] border-[#1a2e1a] text-white">
        <div className="flex items-center gap-3 mb-6">
          {currentStep > 1 && !loading && !trackingPayment && (
            <button
              onClick={goBack}
              className="p-2 hover:bg-[#1a2e1a] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <DialogTitle className="text-xl font-semibold text-white">
              Deposit USDC with KES
            </DialogTitle>
            <p className="text-sm text-gray-400 mt-1">
              Pay with M-Pesa to receive USDC on Scroll
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {ONRAMP_STEPS.map((step, index) => (
            <div key={step.step} className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step.step 
                  ? currentStep === step.step 
                    ? "bg-[#3a5d3a] text-white border-2 border-[#4ade80]" 
                    : "bg-[#4ade80] text-[#0a0f0a]"
                  : "bg-[#1a2e1a] text-gray-400"
              }`}>
                {currentStep > step.step ? <Check className="w-4 h-4" /> : step.step}
              </div>
              <div className="text-xs text-center mt-2">
                <div className={currentStep >= step.step ? "text-white" : "text-gray-400"}>
                  {step.title}
                </div>
              </div>
              {index < ONRAMP_STEPS.length - 1 && (
                <div className={`absolute h-0.5 w-20 mt-4 ${
                  currentStep > step.step ? "bg-[#4ade80]" : "bg-[#1a2e1a]"
                }`} style={{ marginLeft: "60px" }} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {/* Step 1: Phone Number */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mobile Network
              </label>
              <div className="space-y-2">
                {MOBILE_NETWORKS.map((network) => (
                  <label key={network.value} className="flex items-center gap-3 p-3 border border-[#1a2e1a] rounded-lg hover:border-[#3a5d3a] cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="network"
                      value={network.value}
                      checked={mobileNetwork === network.value}
                      onChange={(e) => setMobileNetwork(e.target.value)}
                      className="w-4 h-4 text-[#4ade80] border-gray-600 focus:ring-[#4ade80]"
                    />
                    <span className="text-lg">{network.icon}</span>
                    <span className="text-white">{network.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+254712345678"
                className="w-full px-4 py-3 bg-[#1a2e1a] border border-[#2a3e2a] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4ade80] focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter the phone number registered with {MOBILE_NETWORKS.find(n => n.value === mobileNetwork)?.label}
              </p>
            </div>

            <button
              onClick={handleNextStep}
              disabled={loading}
              className="w-full h-12 bg-[#4ade80] text-[#0a0f0a] font-medium rounded-lg hover:bg-[#22c55e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Amount */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                KES Amount
              </label>
              <input
                type="number"
                value={kesAmount}
                onChange={(e) => setKesAmount(e.target.value)}
                placeholder="1000"
                min="100"
                max="100000"
                className="w-full px-4 py-3 bg-[#1a2e1a] border border-[#2a3e2a] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4ade80] focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Minimum: KES 100 • Maximum: KES 100,000
              </p>
            </div>

            <div className="bg-[#1a2e1a] rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-300">Exchange Rate</span>
                <span className="text-white">1 USDC = KES {exchangeRate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">You will receive</span>
                <span className="text-[#4ade80] font-medium">
                  {usdcAmount ? `${usdcAmount} USDC` : '0 USDC'}
                </span>
              </div>
            </div>

            <button
              onClick={handleNextStep}
              disabled={loading || !kesAmount || parseFloat(kesAmount) < 100}
              className="w-full h-12 bg-[#4ade80] text-[#0a0f0a] font-medium rounded-lg hover:bg-[#22c55e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                'Continue to Payment'
              )}
            </button>
          </div>
        )}

        {/* Step 3: Payment Instructions */}
        {currentStep === 3 && transactionCode && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-medium text-white mb-2">Complete M-Pesa Payment</h3>
              <p className="text-gray-400 text-sm">
                Follow the instructions below to complete your payment
              </p>
            </div>

            <div className="bg-[#1a2e1a] rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-300">Amount:</span>
                <span className="text-white font-medium">KES {kesAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Paybill:</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{shortcode}</span>
                  <button
                    onClick={() => copyToClipboard(shortcode)}
                    className="p-1 hover:bg-[#2a3e2a] rounded"
                  >
                    <Copy className="w-3 h-3 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Reference:</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{transactionCode}</span>
                  <button
                    onClick={() => copyToClipboard(transactionCode)}
                    className="p-1 hover:bg-[#2a3e2a] rounded"
                  >
                    <Copy className="w-3 h-3 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h4 className="text-blue-400 font-medium mb-2">Payment Instructions:</h4>
              <ol className="text-sm text-blue-300 space-y-1">
                <li>1. Go to M-Pesa on your phone</li>
                <li>2. Select "Lipa na M-Pesa" → "Pay Bill"</li>
                <li>3. Enter Business Number: <strong>{shortcode}</strong></li>
                <li>4. Enter Account Number: <strong>{transactionCode}</strong></li>
                <li>5. Enter Amount: <strong>KES {kesAmount}</strong></li>
                <li>6. Enter your M-Pesa PIN and confirm</li>
              </ol>
            </div>

            <div className="flex items-center justify-center py-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Waiting for payment confirmation...</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Success/Completion */}
        {currentStep === 4 && (
          <div className="text-center space-y-4">
            {trackingPayment ? (
              <>
                <div className="w-16 h-16 bg-[#4ade80] rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-[#0a0f0a]" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">Payment Confirmed!</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Processing USDC transfer to your wallet...
                  </p>
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Sending USDC to your wallet...</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-[#4ade80] rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-[#0a0f0a]" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white mb-2">USDC Received!</h3>
                  <p className="text-gray-400 text-sm">
                    {usdcAmount} USDC has been sent to your wallet on Scroll network
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}