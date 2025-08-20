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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Smartphone, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Info,
  X,
  ArrowRight,
  Clock,
  TrendingUp,
  Shield,
  Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  enhancedOfframpService,
  ENHANCED_OFFRAMP_FIAT,
  formatEnhancedCurrencyAmount,
  estimateEnhancedOfframpFee,
  getTokenCategory,
  hasPreferredFiatPairing,
  type OfframpQuoteRequest,
  type OfframpInitiateRequest,
} from "@/lib/services/enhancedOfframpService";

interface EnhancedMobileMoneyWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenSymbol: string;
  tokenAddress: string;
  network: string;
  availableAmount: string;
  decimals: number;
  onWithdrawSuccess?: (orderID: string, amount: string) => void;
  onBlockchainWithdraw: (tokenAddress: string, amount: string) => Promise<string>;
  // Enhanced props for DAP integration
  userDeposits?: string;
  userBorrows?: string;
  isLocked?: boolean;
  loanAmount?: string; // For loan repayment scenarios
  transactionType?: 'withdrawal' | 'loan_repayment' | 'excess_withdrawal';
}

interface WithdrawalStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
  icon: React.ReactNode;
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
  transactionType = 'withdrawal',
}: EnhancedMobileMoneyWithdrawModalProps) {
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    phoneNumber: "",
    amount: "",
    fiatCurrency: "KES",
  });

  const [quote, setQuote] = useState<any>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transactionHash, setTransactionHash] = useState("");
  const [orderID, setOrderID] = useState("");

  const [optimizationSuggestion, setOptimizationSuggestion] = useState<any>(null);
  const [constraintValidation, setConstraintValidation] = useState<any>(null);

  const steps: WithdrawalStep[] = [
    {
      id: 1,
      title: "Setup",
      description: "Enter withdrawal details",
      completed: currentStep > 1,
      current: currentStep === 1,
      icon: <Smartphone className="w-4 h-4" />
    },
    {
      id: 2,
      title: "Review",
      description: "Confirm transaction details",
      completed: currentStep > 2,
      current: currentStep === 2,
      icon: <Shield className="w-4 h-4" />
    },
    {
      id: 3,
      title: "Process",
      description: "Blockchain transaction",
      completed: currentStep > 3,
      current: currentStep === 3,
      icon: <Zap className="w-4 h-4" />
    },
    {
      id: 4,
      title: "Complete",
      description: "Mobile money transfer",
      completed: currentStep > 4,
      current: currentStep === 4,
      icon: <CheckCircle className="w-4 h-4" />
    },
  ];

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setForm({
        phoneNumber: "",
        amount: "",
        fiatCurrency: "KES",
      });
      setQuote(null);
      setTransactionHash("");
      setOrderID("");
      setOptimizationSuggestion(null);
      setConstraintValidation(null);
    }
  }, [isOpen]);

  // Get optimization suggestions when token/fiat changes
  useEffect(() => {
    if (tokenSymbol && form.fiatCurrency) {
      const suggestion = enhancedOfframpService.getOptimalWithdrawalPath(
        tokenSymbol,
        form.amount || "1",
        form.fiatCurrency
      );
      setOptimizationSuggestion(suggestion);
    }
  }, [tokenSymbol, form.fiatCurrency]);

  // Validate constraints when amount changes
  useEffect(() => {
    if (form.amount && parseFloat(form.amount) > 0) {
      const validation = enhancedOfframpService.validateWithdrawalConstraints(
        tokenAddress,
        form.amount,
        userDeposits,
        userBorrows,
        isLocked
      );
      setConstraintValidation(validation);
    }
  }, [form.amount, tokenAddress, userDeposits, userBorrows, isLocked]);

  // Get quote when amount changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (form.amount && parseFloat(form.amount) > 0) {
        getWithdrawalQuote();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [form.amount, form.fiatCurrency]);

  const getWithdrawalQuote = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return;

    setLoadingQuote(true);

    try {
      const quoteRequest: OfframpQuoteRequest = {
        amount: form.amount,
        fiatCurrency: form.fiatCurrency,
        cryptoCurrency: tokenSymbol,
        network: network,
        category: "B2C",
        tokenAddress: tokenAddress,
      };

      const result = await enhancedOfframpService.getOfframpQuote(quoteRequest);

      if (result.success && result.data) {
        setQuote(result.data);
      } else {
        throw new Error(result.error || "Failed to get quote");
      }
    } catch (error: any) {
      toast({
        title: "Quote Error",
        description: "Unable to get current rates. Please try again.",
        variant: "destructive",
      });
      setQuote(null);
    } finally {
      setLoadingQuote(false);
    }
  };

  const validateForm = (): boolean => {
    if (!form.phoneNumber || !form.amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return false;
    }

    if (!enhancedOfframpService.validatePhoneNumber(form.phoneNumber, form.fiatCurrency)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number for your selected currency",
        variant: "destructive",
      });
      return false;
    }

    // Check constraint validation
    if (constraintValidation && !constraintValidation.valid) {
      return false; // Error already shown in UI
    }

    const amount = parseFloat(form.amount);
    const available = parseFloat(availableAmount);

    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount greater than 0",
        variant: "destructive",
      });
      return false;
    }

    if (amount > available) {
      toast({
        title: "Insufficient Balance",
        description: "The withdrawal amount exceeds your available balance",
        variant: "destructive",
      });
      return false;
    }

    const limits = enhancedOfframpService.getWithdrawalLimits(form.fiatCurrency);
    if (quote && parseFloat(quote.outputAmount) < limits.min) {
      toast({
        title: "Amount Too Small",
        description: `Minimum withdrawal is ${formatEnhancedCurrencyAmount(limits.min, form.fiatCurrency)}`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateForm() && quote) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      handleBlockchainWithdraw();
    }
  };

  const handleBlockchainWithdraw = async () => {
    setCurrentStep(3);
    setProcessing(true);

    try {
      // Calculate transaction breakdown for complex scenarios
      let loanPaymentAmount = "0";
      let excessWithdrawalAmount = form.amount;

      if (transactionType === 'loan_repayment' && loanAmount && parseFloat(loanAmount) > 0) {
        const flow = enhancedOfframpService.calculateLoanRepaymentFlow(
          loanAmount,
          availableAmount,
          form.amount,
          decimals
        );
        
        if (!flow.canRepayAndWithdraw) {
          throw new Error(`Insufficient balance. You need ${flow.shortfall} more to complete this transaction.`);
        }
        
        loanPaymentAmount = flow.loanPayment;
        excessWithdrawalAmount = flow.excessWithdrawal;
      }

      // Perform blockchain withdrawal
      const hash = await onBlockchainWithdraw(tokenAddress, form.amount);
      setTransactionHash(hash);

      // Wait for transaction confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Initiate mobile money transfer with enhanced data
      await initiateMobileMoneyTransfer(hash, loanPaymentAmount, excessWithdrawalAmount);
    } catch (error: any) {
      let userMessage = "Transaction failed. Please try again.";
      
      if (error.message?.includes('insufficient')) {
        userMessage = "Insufficient balance for this transaction.";
      } else if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        userMessage = "Transaction was cancelled.";
      } else if (error.message?.includes('network')) {
        userMessage = "Network error. Please check your connection.";
      }
      
      toast({
        title: "Transaction Failed",
        description: userMessage,
        variant: "destructive",
      });
      setCurrentStep(2); // Go back to review step
    } finally {
      setProcessing(false);
    }
  };

  const initiateMobileMoneyTransfer = async (
    hash: string, 
    loanPaymentAmount: string = "0", 
    excessWithdrawalAmount: string = "0"
  ) => {
    setCurrentStep(4);

    try {
      const formattedPhone = enhancedOfframpService.formatPhoneNumber(form.phoneNumber, form.fiatCurrency);
      
      const initiateRequest: OfframpInitiateRequest = {
        chain: network,
        hash: hash,
        partyB: formattedPhone,
        tokenAddress: tokenAddress,
        project: "ministables-dap",
        loanPaymentAmount,
        excessWithdrawalAmount,
        transactionType,
      };

      const result = await enhancedOfframpService.initiateOfframp(initiateRequest);

      if (result.success && result.data) {
        setOrderID(result.data.orderID);
        
        toast({
          title: "Enhanced Withdrawal Initiated",
          description: `Your ${tokenSymbol} will be converted to mobile money and sent to ${form.phoneNumber}`,
        });

        if (onWithdrawSuccess) {
          onWithdrawSuccess(result.data.orderID, form.amount);
        }
      } else {
        throw new Error(result.error || "Failed to initiate mobile money transfer");
      }
    } catch (error: any) {
      let userMessage = "Unable to complete mobile money transfer. Please try again.";
      
      if (error.message?.includes('phone')) {
        userMessage = "Invalid phone number. Please check and try again.";
      } else if (error.message?.includes('limit')) {
        userMessage = "Transaction amount exceeds daily limits.";
      } else if (error.message?.includes('network')) {
        userMessage = "Mobile money service temporarily unavailable.";
      }
      
      toast({
        title: "Transfer Failed",
        description: userMessage,
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (!processing) {
      onClose();
    }
  };

  const getStepIcon = (step: WithdrawalStep) => {
    if (step.completed) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    } else if (step.current && processing) {
      return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    } else if (step.current) {
      return <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-white text-xs">
        {step.icon}
      </div>;
    } else {
      return <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center">
        {step.icon}
      </div>;
    }
  };

  const tokenCategory = getTokenCategory(tokenSymbol);
  const hasOptimalPairing = hasPreferredFiatPairing(tokenSymbol, form.fiatCurrency);
  const fiatConfig = ENHANCED_OFFRAMP_FIAT[form.fiatCurrency as keyof typeof ENHANCED_OFFRAMP_FIAT];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[420px] mx-auto bg-white border-0 shadow-2xl rounded-xl p-0 max-h-[90vh] overflow-hidden">
        {/* Enhanced Header */}
        <DialogHeader className="px-4 py-3 border-b bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <Smartphone className="w-5 h-5 mr-2 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <DialogTitle className="text-gray-900 text-lg font-semibold truncate">
                  Enhanced Mobile Money Withdrawal
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-600 mt-0.5">
                  Convert {tokenSymbol} to {fiatConfig?.name || 'cash'} • {tokenCategory} token
                </DialogDescription>
              </div>
            </div>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
              disabled={processing}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Enhanced Progress Steps */}
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  {getStepIcon(step)}
                  <div className="text-xs text-center mt-1 max-w-[60px]">
                    <div className={`font-medium ${step.current ? 'text-primary' : step.completed ? 'text-green-600' : 'text-gray-500'}`}>
                      {step.title}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-gray-400 mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Step 1: Enhanced Setup */}
          {currentStep === 1 && (
            <div className="p-4 space-y-4">
              {/* Optimization Suggestion */}
              {optimizationSuggestion && !optimizationSuggestion.recommended && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <TrendingUp className="w-4 h-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium text-yellow-800 mb-1">Optimization Tip</div>
                      <div className="text-yellow-700 mb-2">{optimizationSuggestion.reason}</div>
                      {optimizationSuggestion.alternativeTokens && (
                        <div className="text-xs text-yellow-600">
                          Consider: {optimizationSuggestion.alternativeTokens.join(', ')} 
                          {optimizationSuggestion.estimatedSavings && ` (Save ${optimizationSuggestion.estimatedSavings})`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Optimal Pairing Indicator */}
              {hasOptimalPairing && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    <div className="text-sm text-green-800">
                      <span className="font-medium">Optimal Pairing!</span> {tokenSymbol} has direct support for {form.fiatCurrency}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">
                    Currency {fiatConfig?.flag}
                  </Label>
                  <Select
                    value={form.fiatCurrency}
                    onValueChange={(value) => setForm(prev => ({ ...prev, fiatCurrency: value }))}
                  >
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ENHANCED_OFFRAMP_FIAT).map(([currency, config]) => (
                        <SelectItem key={currency} value={currency}>
                          {config.flag} {currency} - {config.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">
                    Available
                  </Label>
                  <div className="h-10 px-3 py-2 bg-gray-50 border rounded-md flex items-center text-sm font-medium text-gray-700">
                    {parseFloat(availableAmount).toFixed(4)} {tokenSymbol}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">
                  Phone Number
                </Label>
                <Input
                  type="tel"
                  placeholder={form.fiatCurrency === 'KES' ? '0712345678' : '+1234567890'}
                  value={form.phoneNumber}
                  onChange={(e) => setForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className="h-10 text-sm"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">
                  Amount ({tokenSymbol})
                </Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="h-10 text-sm"
                  min="0.01"
                  step="0.01"
                  max={availableAmount}
                />
                {/* Quick percentage selectors */}
                {parseFloat(availableAmount) > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setForm(prev => ({ ...prev, amount: (parseFloat(availableAmount) * 0.1).toFixed(6) }))}
                    >
                      10%
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setForm(prev => ({ ...prev, amount: (parseFloat(availableAmount) * 0.2).toFixed(6) }))}
                    >
                      20%
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setForm(prev => ({ ...prev, amount: (parseFloat(availableAmount) * 0.5).toFixed(6) }))}
                    >
                      50%
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => setForm(prev => ({ ...prev, amount: (parseFloat(availableAmount)).toFixed(6) }))}
                    >
                      Max
                    </Button>
                  </div>
                )}
                
                {/* Enhanced Quote Display */}
                {loadingQuote && (
                  <div className="mt-2 flex items-center text-sm text-gray-600">
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    Getting enhanced quote...
                  </div>
                )}

                {quote && !loadingQuote && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-600">You'll receive:</span>
                        <span className="font-semibold text-green-700">
                          {formatEnhancedCurrencyAmount(parseFloat(quote.outputAmount), form.fiatCurrency)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mt-2">
                        <div className="flex justify-between">
                          <span>Rate:</span>
                          <span>1 {tokenSymbol} = {quote.exchangeRate} {form.fiatCurrency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fee:</span>
                          <span>{formatEnhancedCurrencyAmount(quote.fee?.feeInOutputCurrency || 0, form.fiatCurrency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Gas:</span>
                          <span>~{quote.estimatedGasFee} {network.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Time:</span>
                          <span>{quote.processingTime}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Constraint Validation */}
                {constraintValidation && !constraintValidation.valid && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start">
                      <AlertCircle className="w-4 h-4 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <div className="font-medium text-amber-800 mb-1">Unable to Process</div>
                        <div className="text-amber-700 mb-2">
                          {constraintValidation.reason.includes('exceeds') 
                            ? 'Withdrawal amount exceeds your available balance.'
                            : constraintValidation.reason.includes('Minimum')
                            ? `Minimum withdrawal amount is ${constraintValidation.reason.match(/\d+/)?.[0] || '10'} ${form.fiatCurrency}.`
                            : 'Please check your withdrawal amount and try again.'}
                        </div>
                        {constraintValidation.suggestions && (
                          <div className="text-xs text-amber-600">
                            💡 Try: Reduce withdrawal amount, Check your available balance
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>


            </div>
          )}

          {/* Step 2: Enhanced Review */}
          {currentStep === 2 && quote && (
            <div className="p-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">Enhanced Withdrawal Summary</h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">From:</span>
                    <span className="font-medium">{form.amount} {tokenSymbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">To:</span>
                    <span className="font-medium">{form.phoneNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Network:</span>
                    <span className="font-medium capitalize">{network}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Token Category:</span>
                    <span className="font-medium capitalize">{tokenCategory}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Exchange Rate:</span>
                    <span className="font-medium">1 {tokenSymbol} = {quote.exchangeRate} {form.fiatCurrency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processing Fee:</span>
                    <span className="font-medium">{formatEnhancedCurrencyAmount(quote.fee?.feeInOutputCurrency || 0, form.fiatCurrency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimated Gas:</span>
                    <span className="font-medium">{quote.estimatedGasFee} {network.toUpperCase()}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold text-base">
                    <span className="text-gray-900">You'll receive:</span>
                    <span className="text-green-600">
                      {formatEnhancedCurrencyAmount(parseFloat(quote.outputAmount), form.fiatCurrency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start">
                  <Info className="w-4 h-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <div className="font-medium mb-1">Enhanced Processing</div>
                    <div>
                      Estimated completion: {quote.processingTime} • 
                      Slippage tolerance: {quote.slippageTolerance}% • 
                      Transaction type: {transactionType.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Enhanced Processing */}
          {currentStep === 3 && (
            <div className="p-4 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Processing Enhanced Blockchain Transfer
                </h3>
                <p className="text-sm text-gray-600">
                  Transferring your {tokenSymbol} with enhanced security and optimization...
                </p>
              </div>
              {transactionHash && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Transaction Hash:</p>
                  <p className="font-mono text-xs break-all">{transactionHash}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Enhanced Completion */}
          {currentStep === 4 && (
            <div className="p-4 text-center space-y-4">
              {orderID ? (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Enhanced Withdrawal Initiated!
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Your enhanced mobile money transfer is being processed with optimal routing.
                    </p>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Enhanced Order ID:</p>
                      <p className="font-mono text-sm font-medium">{orderID}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <Clock className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Initiating Enhanced Mobile Money Transfer
                    </h3>
                    <p className="text-sm text-gray-600">
                      Setting up your optimized mobile money withdrawal...
                    </p>
                  </div>
                </>
              )}
            </div>
          )}


        </div>

        {/* Enhanced Action Buttons */}
        <div className="border-t bg-gray-50 p-4">
          {currentStep === 1 && (
            <div className="flex gap-3">
              <Button
                onClick={handleClose}
                variant="outline"
                className="flex-1 h-10 text-sm bg-white"
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleNext}
                disabled={!quote || !validateForm() || loadingQuote}
                className="flex-1 bg-primary hover:bg-secondary text-white h-10 text-sm"
              >
                {loadingQuote ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Review Enhanced Quote"
                )}
              </Button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex gap-3">
              <Button
                onClick={() => setCurrentStep(1)}
                variant="outline"
                className="flex-1 h-10 text-sm bg-white"
                disabled={processing}
              >
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={processing}
                className="flex-1 bg-primary hover:bg-secondary text-white h-10 text-sm"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Confirm Enhanced Withdrawal"
                )}
              </Button>
            </div>
          )}

          {(currentStep === 3 || currentStep === 4) && (
            <Button
              onClick={handleClose}
              disabled={processing && !orderID}
              className="w-full bg-primary hover:bg-secondary text-white h-10 text-sm"
            >
              {orderID ? "Done" : "Processing..."}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
