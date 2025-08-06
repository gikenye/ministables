"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveAccount } from "thirdweb/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CreditCard, 
  Smartphone, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Info,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  onrampService,
  MOBILE_NETWORKS,
  SUPPORTED_COUNTRIES,
  formatPhoneNumber,
  detectCountryFromPhone,
  type OnrampRequest,
} from "@/lib/services/onrampService";

interface OnrampDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAsset: string;
  assetSymbol: string;
  onSuccess?: (transactionCode: string, amount: number) => void;
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
  const { toast } = useToast();

  const [form, setForm] = useState({
    phoneNumber: "",
    amount: "",
    mobileNetwork: "",
    countryCode: "KES",
  });

  const [validation, setValidation] = useState({
    isValidating: false,
    isValid: false,
    accountName: "",
    error: "",
  });

  const [transaction, setTransaction] = useState({
    isProcessing: false,
    isComplete: false,
    transactionCode: "",
    error: "",
  });

  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setForm({
        phoneNumber: "",
        amount: "",
        mobileNetwork: "",
        countryCode: "KES",
      });
      setValidation({
        isValidating: false,
        isValid: false,
        accountName: "",
        error: "",
      });
      setTransaction({
        isProcessing: false,
        isComplete: false,
        transactionCode: "",
        error: "",
      });
      loadExchangeRate("KES");
    }
  }, [isOpen]);

  // Auto-detect country when phone number changes
  useEffect(() => {
    if (form.phoneNumber) {
      const detectedCountry = detectCountryFromPhone(form.phoneNumber);
      if (detectedCountry !== form.countryCode) {
        setForm(prev => ({ ...prev, countryCode: detectedCountry }));
        loadExchangeRate(detectedCountry);
      }
    }
  }, [form.phoneNumber]);

  // Load exchange rate for selected country
  const loadExchangeRate = async (currencyCode: string) => {
    setLoadingRate(true);
    try {
      const result = await onrampService.getExchangeRate(currencyCode);
      if (result.success && result.rate) {
        setExchangeRate(result.rate);
      }
    } catch (error) {
      console.error("Failed to load exchange rate:", error);
    } finally {
      setLoadingRate(false);
    }
  };

  // Validate phone number
  const validatePhoneNumber = async () => {
    if (!form.phoneNumber || !form.mobileNetwork) return;

    setValidation(prev => ({ ...prev, isValidating: true, error: "" }));

    try {
      const formattedPhone = formatPhoneNumber(form.phoneNumber, form.countryCode);
      const result = await onrampService.validatePaymentMethod(
        {
          type: "MOBILE",
          shortcode: formattedPhone,
          mobile_network: form.mobileNetwork,
        },
        form.countryCode
      );

      if (result.success) {
        setValidation({
          isValidating: false,
          isValid: true,
          accountName: result.name || "Verified",
          error: "",
        });
      } else {
        setValidation({
          isValidating: false,
          isValid: false,
          accountName: "",
          error: result.error || "Phone number validation failed",
        });
      }
    } catch (error: any) {
      setValidation({
        isValidating: false,
        isValid: false,
        accountName: "",
        error: error.message || "Validation failed",
      });
    }
  };

  // Trigger validation when phone number or network changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (form.phoneNumber && form.mobileNetwork) {
        validatePhoneNumber();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [form.phoneNumber, form.mobileNetwork, form.countryCode]);

  // Process onramp transaction
  const handleOnrampDeposit = async () => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    if (!validation.isValid) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number.",
        variant: "destructive",
      });
      return;
    }

    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount.",
        variant: "destructive",
      });
      return;
    }

    // Check if asset is supported for onramp
    const chain = onrampService.getChainForAsset(selectedAsset);
    if (!onrampService.isAssetSupportedForOnramp(selectedAsset, chain)) {
      toast({
        title: "Asset Not Supported",
        description: `${assetSymbol} is not supported for mobile money deposits.`,
        variant: "destructive",
      });
      return;
    }

    // Check amount limits - special handling for cKES mobile money
    const limits = onrampService.getCountryLimits(form.countryCode);
    const amount = parseFloat(form.amount);
    
    // For cKES mobile money, minimum is 100 cKES equivalent
    if (assetSymbol === "cKES" && form.countryCode === "KES") {
      const minCKESAmount = 100; // 100 cKES minimum for mobile money
      const cKESEquivalent = exchangeRate ? amount / exchangeRate : 0;
      
      if (cKESEquivalent < minCKESAmount) {
        toast({
          title: "Minimum Deposit Required",
          description: `Minimum deposit is 100 cKES. Please enter at least ${Math.ceil(minCKESAmount * (exchangeRate || 130))} ${form.countryCode}.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    if (amount < limits.min || amount > limits.max) {
      toast({
        title: "Amount Out of Range",
        description: `Amount must be between ${limits.min} and ${limits.max} ${form.countryCode}.`,
        variant: "destructive",
      });
      return;
    }

    setTransaction(prev => ({ ...prev, isProcessing: true, error: "" }));

    try {
      const formattedPhone = formatPhoneNumber(form.phoneNumber, form.countryCode);
      
      const onrampRequest: OnrampRequest = {
        shortcode: formattedPhone,
        amount: parseFloat(form.amount),
        fee: Math.round(parseFloat(form.amount) * 0.02), // 2% fee estimate
        mobile_network: form.mobileNetwork,
        chain: chain,
        asset: selectedAsset,
        address: address,
        callback_url: "https://minilend.vercel.app/api/onramp/callback",
      };

      const result = await onrampService.initiateOnramp(onrampRequest, form.countryCode);

      if (result.success) {
        setTransaction({
          isProcessing: false,
          isComplete: true,
          transactionCode: result.transaction_code || "",
          error: "",
        });

        toast({
          title: "Deposit Initiated",
          description: `Complete payment on your phone. ${assetSymbol} will be credited to your wallet after successful payment.`,
        });

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(result.transaction_code || "", parseFloat(form.amount));
        }
      } else {
        throw new Error(result.error || "Failed to initiate deposit");
      }
    } catch (error: any) {
      setTransaction({
        isProcessing: false,
        isComplete: false,
        transactionCode: "",
        error: error.message || "Failed to process deposit",
      });

      toast({
        title: "Deposit Failed",
        description: error.message || "Failed to initiate mobile money deposit.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (!transaction.isProcessing) {
      onClose();
    }
  };

  const selectedCountry = SUPPORTED_COUNTRIES[form.countryCode as keyof typeof SUPPORTED_COUNTRIES];
  const availableNetworks = selectedCountry?.networks || [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[380px] mx-auto bg-white border-0 shadow-2xl rounded-xl p-0 max-h-[85vh] overflow-hidden">
        {/* Compact Header */}
        <DialogHeader className="px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <CreditCard className="w-4 h-4 mr-2 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <DialogTitle className="text-gray-900 text-base font-semibold truncate">
                  Deposit {assetSymbol}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-600 mt-0.5">
                  via Mobile Money
                </DialogDescription>
              </div>
            </div>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
              disabled={transaction.isProcessing}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(85vh-140px)]">
          {!transaction.isComplete ? (
            <div className="p-4 space-y-3">
              {/* Compact Country & Network Selection */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">
                    Country
                  </Label>
                  <Select
                    value={form.countryCode}
                    onValueChange={(value) => {
                      setForm(prev => ({ ...prev, countryCode: value, mobileNetwork: "" }));
                      loadExchangeRate(value);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SUPPORTED_COUNTRIES).map(([code, country]) => (
                        <SelectItem key={code} value={code}>
                          <span className="text-sm">{country.flag} {code}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1 block">
                    Network
                  </Label>
                  <Select
                    value={form.mobileNetwork}
                    onValueChange={(value) => setForm(prev => ({ ...prev, mobileNetwork: value }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableNetworks.map((network) => (
                        <SelectItem key={network} value={network} className="text-sm">
                          {network}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  Phone Number
                </Label>
                <div className="relative">
                  <Input
                    type="tel"
                    placeholder="0712345678"
                    value={form.phoneNumber}
                    onChange={(e) => setForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    className="h-9 text-sm pr-8"
                  />
                  {validation.isValidating && (
                    <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 animate-spin text-gray-400" />
                  )}
                  {validation.isValid && !validation.isValidating && (
                    <CheckCircle className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-green-500" />
                  )}
                </div>
                {validation.isValid && validation.accountName && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {validation.accountName}
                  </p>
                )}
                {validation.error && (
                  <p className="text-xs text-red-600 mt-1">
                    {validation.error}
                  </p>
                )}
              </div>

              {/* Amount */}
              <div>
                <Label className="text-xs font-medium text-gray-700 mb-1 block">
                  Amount ({form.countryCode})
                </Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={form.amount}
                  onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="h-9 text-sm"
                  min="1"
                  step="1"
                />
                
                {/* Exchange Rate & Limits - Compact */}
                <div className="mt-1 space-y-1">
                  {exchangeRate && form.amount && (
                    <div className="bg-blue-50 rounded px-2 py-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-600">You receive:</span>
                        <span className="font-medium text-primary">
                          ≈ {(parseFloat(form.amount) / exchangeRate).toFixed(4)} {assetSymbol}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {form.countryCode && (
                    <p className="text-xs text-gray-500">
                      {assetSymbol === "cKES" && form.countryCode === "KES" ? (
                        <>Min: 100 cKES (≈{Math.ceil(100 * (exchangeRate || 130))} {form.countryCode})</>
                      ) : (
                        <>Limits: {onrampService.getCountryLimits(form.countryCode).min}-{onrampService.getCountryLimits(form.countryCode).max} {form.countryCode}</>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Compact Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                <div className="flex items-start">
                  <Info className="w-3 h-3 text-blue-600 mr-1 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800">
                    <div className="font-medium mb-1">Quick Process:</div>
                    <div>1. Enter details → 2. Confirm → 3. Pay on phone → 4. Receive {assetSymbol}</div>
                    <div className="text-blue-600 mt-1 truncate">
                      To: {address?.slice(0, 8)}...{address?.slice(-6)}
                    </div>
                  </div>
                </div>
              </div>

              {transaction.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                  <div className="flex items-start">
                    <AlertCircle className="w-3 h-3 text-red-600 mr-1 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-red-800">
                      {transaction.error}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Compact Success State */
            <div className="text-center space-y-3 p-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  Deposit Initiated!
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Complete payment on your phone. {assetSymbol} will be credited to your wallet after successful payment.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
                  <p className="text-xs text-blue-800">
                    💱 Check your wallet balance before proceeding with loan
                  </p>
                </div>
                {transaction.transactionCode && (
                  <div className="bg-gray-50 rounded-lg p-2 mb-3">
                    <p className="text-xs text-gray-600">Transaction Code:</p>
                    <p className="font-mono text-xs font-medium">
                      {transaction.transactionCode}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Compact Action Buttons */}
        <div className="border-t bg-gray-50 p-3">
          {!transaction.isComplete ? (
            <div className="flex gap-2">
              <Button
                onClick={handleClose}
                variant="outline"
                className="flex-1 h-9 text-sm bg-white"
                disabled={transaction.isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleOnrampDeposit}
                disabled={
                  transaction.isProcessing ||
                  !validation.isValid ||
                  !form.amount ||
                  parseFloat(form.amount) <= 0
                }
                className="flex-1 bg-primary hover:bg-secondary text-white h-9 text-sm"
              >
                {transaction.isProcessing ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3 h-3 mr-1" />
                    Deposit
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleClose}
              className="w-full bg-primary hover:bg-secondary text-white h-9 text-sm"
            >
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}