"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  Plus,
  Copy,
} from "lucide-react";
import {
  useActiveAccount,
  useSendTransaction,
  useWalletBalance,
} from "thirdweb/react";
import { OnrampDepositModal } from "./OnrampDepositModal";
import { onrampService } from "@/lib/services/onrampService";
import { reportTransactionToDivvi } from "@/lib/services/divviService";
import { getReferralTag } from "@divvi/referral-sdk";

// Define the vault contract ABI for deposit function (Aave-integrated vaults on Celo)
export const vaultABI = [
  {
    inputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "lockTierId", type: "uint256" },
    ],
    name: "deposit",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Define the legacy contract ABI for deposit function (Scroll and older deployments)
export const legacyDepositABI = [
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "lockPeriod", type: "uint256" },
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

import {
  getContract,
  prepareContractCall,
  type PreparedTransaction,
  waitForReceipt,
} from "thirdweb";
import { getApprovalForTransaction } from "thirdweb/extensions/erc20";
import { client } from "@/lib/thirdweb/client";

import { parseUnits } from "viem";
import { useChain } from "@/components/ChainProvider";
import { getExplorerUrl, getVaultAddress } from "@/config/chainConfig";
import { aaveRatesService } from "@/lib/services/aaveRatesService";

interface SaveMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading?: boolean;
  requiresAuth?: boolean;
}

export function SaveMoneyModal({
  isOpen,
  onClose,
  loading: _loading = false,
  requiresAuth = false,
}: SaveMoneyModalProps) {
  const account = useActiveAccount();
  const { chain, contractAddress, tokens, tokenInfos } = useChain();

  // Only show deposit-appropriate tokens per chain
  const supportedStablecoins = useMemo(() => {
    if (chain?.id === 42220) {
      // Celo
      const allowedSymbols = ["USDC", "USDT", "CUSD"];
      return tokens
        .filter((t) => allowedSymbols.includes(t.symbol.toUpperCase()))
        .map((t) => t.address);
    } else if (chain?.id === 534352) {
      // Scroll
      const allowedSymbols = ["USDC", "WETH"];
      return tokens
        .filter((t) => allowedSymbols.includes(t.symbol.toUpperCase()))
        .map((t) => t.address);
    }
    return tokens.map((t) => t.address);
  }, [tokens, chain?.id]);
  const [currentStep, setCurrentStep] = useState(0);
  const [depositMethod, setDepositMethod] = useState<"mpesa" | "wallet" | "">(
    ""
  );

  // Debug log to check current step
  if (process.env.NODE_ENV === "development") {
    console.log(
      "[SaveMoneyModal] Current step:",
      currentStep,
      "Deposit method:",
      depositMethod
    );
  }
  const [form, setForm] = useState({
    token: "",
    amount: "",
    lockPeriod: "0", // No lock default
  });

  const [error, setError] = useState<string | null>(null);
  const [showOnrampModal, setShowOnrampModal] = useState(false);
  const [selectedTokenForOnramp, setSelectedTokenForOnramp] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<string | null>(
    null
  );
  const [depositSuccess, setDepositSuccess] = useState<{
    token: string;
    amount: string;
    lockPeriod: string;
    transactionHash?: string;
  } | null>(null);
  const [baseAPY, setBaseAPY] = useState<number>(0);
  const [apyLoading, setApyLoading] = useState<boolean>(false);
  const [tokenAPYs, setTokenAPYs] = useState<Record<string, number>>({});
  const [fetchingTokenAPYs, setFetchingTokenAPYs] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);

  // Use the working setup's wallet balance hook
  const { data: walletBalanceData, isLoading: isBalanceLoading } =
    useWalletBalance({
      client,
      chain,
      address: account?.address,
      tokenAddress: form.token || undefined,
    });

  // Use the working setup's transaction hook
  const { mutateAsync: sendTransaction, isPending: isTransactionPending } =
    useSendTransaction({ payModal: false });

  useEffect(() => {
    if (isOpen) {
      // Force reset all state
      setCurrentStep(0);
      setDepositMethod("");
      setForm({ token: "", amount: "", lockPeriod: "0" });
      setError(null);
      setIsSaving(false);
      setTransactionStatus(null);
      setDepositSuccess(null);
      setBaseAPY(0);
      setApyLoading(false);
      setShowOnrampModal(false);
      setSelectedTokenForOnramp("");
    }
  }, [isOpen]);

  // Clear modal state when the chain changes to prevent using token addresses
  // or balances from the previously selected chain.
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setDepositMethod("");
      setError(null);
      setIsSaving(false);
      setTransactionStatus(null);
      setDepositSuccess(null);
      setForm({ token: "", amount: "", lockPeriod: "0" });
      setShowOnrampModal(false);
      setSelectedTokenForOnramp("");
      setBaseAPY(0);
      setApyLoading(false);
    }
  }, [chain?.id]);

  // Fetch APY when token is selected
  useEffect(() => {
    if (form.token && chain?.id) {
      const tokenSymbol = tokenInfos[form.token]?.symbol;
      if (tokenSymbol) {
        setApyLoading(true);
        aaveRatesService
          .getAPY(chain.id, tokenSymbol)
          .then(setBaseAPY)
          .finally(() => setApyLoading(false));
      }
    }
  }, [form.token, chain?.id, tokenInfos]);

  // Fetch APYs for all tokens when on step 1
  useEffect(() => {
    if (
      currentStep === 1 &&
      chain?.id &&
      supportedStablecoins.length > 0 &&
      !fetchingTokenAPYs
    ) {
      setFetchingTokenAPYs(true);
      const fetchAllAPYs = async () => {
        const apys: Record<string, number> = {};
        for (const token of supportedStablecoins) {
          const symbol = tokenInfos[token]?.symbol;
          if (symbol) {
            try {
              const apy = await aaveRatesService.getAPY(chain.id, symbol);
              apys[token] = apy;
            } catch (error) {
              apys[token] = 0;
            }
          }
        }
        setTokenAPYs(apys);
        setFetchingTokenAPYs(false);
      };
      fetchAllAPYs();
    }
  }, [currentStep, chain?.id]);

  const prepareDepositTransaction = async () => {
    if (!form.token || !form.amount || !form.lockPeriod || !account) {
      throw new Error("Missing required parameters");
    }

    const chainId = chain?.id || 42220;
    const isCelo = chainId === 42220;
    const decimals = tokenInfos[form.token]?.decimals || 18;
    const amountWei = parseUnits(form.amount, decimals);
    const tokenSymbol = tokenInfos[form.token]?.symbol;

    if (process.env.NODE_ENV === "development") {
      console.log("[SaveMoneyModal] Starting save with params:", {
        chainId,
        isCelo,
        tokenAddress: form.token?.substring(0, 10) + "...",
        tokenSymbol,
        amount: "REDACTED",
        lockPeriod: form.lockPeriod,
      });
    }

    let depositTx: any;

    if (isCelo) {
      // Celo: Use new vault-based system with Aave integration
      try {
        const vaultAddress = getVaultAddress(chainId, tokenSymbol);

        if (process.env.NODE_ENV === "development") {
          console.log("[SaveMoneyModal] Using Aave vault for Celo:", {
            token: tokenSymbol,
            vault: vaultAddress?.substring(0, 10) + "...",
          });
        }

        const vaultContract = getContract({
          client,
          chain: chain,
          address: vaultAddress,
          abi: vaultABI,
        });

        // Map lock periods to lock tier IDs (0, 30, 90, 180 days -> 0, 1, 2, 3)
        const lockTierMap: Record<string, number> = {
          "0": 0, // No lock
          "2592000": 1, // 30 days
          "7776000": 2, // 90 days
          "15552000": 3, // 180 days
        };
        const lockTierId = lockTierMap[form.lockPeriod] ?? 0;

        if (process.env.NODE_ENV === "development") {
          console.log(
            "[SaveMoneyModal] Preparing Aave vault deposit with lockTier:",
            lockTierId
          );
        }

        // Create the deposit transaction for vault (amount, lockTierId)
        depositTx = prepareContractCall({
          contract: vaultContract,
          method: "deposit",
          params: [amountWei, BigInt(lockTierId)],
          erc20Value: {
            tokenAddress: form.token,
            amountWei,
          },
        });
      } catch (error) {
        console.error(
          "[SaveMoneyModal] Error preparing Celo vault transaction:",
          error
        );
        throw error;
      }
    } else {
      // Scroll or other chains: Use legacy contract system
      if (process.env.NODE_ENV === "development") {
        console.log("[SaveMoneyModal] Using legacy contract for Scroll");
      }

      const legacyContract = getContract({
        client,
        chain: chain,
        address: contractAddress,
        abi: legacyDepositABI,
      });

      // Legacy system uses lockPeriod in seconds directly
      depositTx = prepareContractCall({
        contract: legacyContract,
        method: "deposit",
        params: [
          form.token, // token address
          amountWei,
          BigInt(form.lockPeriod), // lockPeriod in seconds
        ],
        erc20Value: {
          tokenAddress: form.token,
          amountWei,
        },
      });
    }

    return depositTx;
  };

  const handleTransactionError = (error: Error) => {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[SaveMoneyModal] Transaction error:",
        error?.message || "Unknown error"
      );
    }

    let userMessage = "Transaction failed. Please try again.";

    if (error.message.includes("TransactionError: Error - E3")) {
      const currentSymbol = tokenInfos[form.token]?.symbol || "selected asset";
      userMessage = `There was an issue processing ${currentSymbol}. Please select a different deposit asset and try again.`;
      setCurrentStep(1);
    } else if (error.message.includes("receipt not found")) {
      userMessage =
        "Transaction is taking longer than expected. It may still complete successfully. Please check your wallet or try again.";
    } else if (
      error.message.includes("user rejected") ||
      error.message.includes("User rejected")
    ) {
      userMessage = "Transaction was cancelled.";
    } else if (error.message.includes("insufficient funds")) {
      userMessage = "Insufficient funds for this transaction.";
    } else if (error.message.includes("transfer amount exceeds allowance")) {
      userMessage = "Token approval failed. Please try again.";
    } else if (error.message.includes("network")) {
      userMessage =
        "Network error. Please check your connection and try again.";
    }

    setError(userMessage);
  };

  const handleTransactionSuccess = async (
    receipt: any,
    isApproval: boolean = false
  ) => {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "[SaveMoneyModal] Transaction successful:",
        receipt?.transactionHash || "unknown"
      );
    }

    if (!isApproval) {
      // Set the success state with current form data and transaction hash
      setDepositSuccess({
        token: form.token,
        amount: form.amount,
        lockPeriod: form.lockPeriod,
        transactionHash: receipt.transactionHash,
      });
      // Move to success step
      setCurrentStep(5);
    }
  };

  const handleTransactionSent = (
    _result: any,
    _isApproval: boolean = false
  ) => {};

  const handleSave = async () => {
    if (!form.token || !form.amount || !form.lockPeriod) return;
    if (requiresAuth) {
      setError("Please sign in to complete this transaction");
      return;
    }
    if (!account) {
      setError("Please sign in first");
      return;
    }

    // Validate balance
    const erc20Balance = parseFloat(walletBalanceData?.displayValue || "0");
    const inputAmount = parseFloat(form.amount);
    if (inputAmount > erc20Balance) {
      setError(
        `Amount exceeds available balance of ${erc20Balance} ${walletBalanceData?.symbol || ""}`
      );
      return;
    }

    setIsSaving(true);
    setError(null);
    setTransactionStatus("Setting up your deposit...");

    try {
      const depositTx = await prepareDepositTransaction();

      const approveTx = await getApprovalForTransaction({
        transaction: depositTx as any,
        account: account!,
      });

      if (approveTx) {
        setTransactionStatus("Authorizing transaction...");
        const approveResult = await sendTransaction(approveTx);
        handleTransactionSent(approveResult, true);

        if (approveResult?.transactionHash) {
          setTransactionStatus("Processing authorization...");
          const approvalReceipt = await waitForReceipt({
            client,
            chain,
            transactionHash: approveResult.transactionHash,
          });
          handleTransactionSuccess(approvalReceipt, true);
        }
      }

      setTransactionStatus("Completing your deposit...");

      // Generate Divvi referral tag
      let referralTag = "";
      try {
        referralTag = getReferralTag({
          user: account.address as `0x${string}`,
          consumer:
            "0xc022BD0b6005Cae66a468f9a20897aDecDE04e95" as `0x${string}`,
        });
        referralTag = referralTag.startsWith("0x")
          ? referralTag.slice(2)
          : referralTag;
      } catch (error) {
        console.log("[SaveMoneyModal] Divvi tag generation skipped:", error);
      }

      // Resolve the data function and append referral tag
      const depositTxWithTag =
        referralTag && typeof depositTx.data === "function"
          ? {
              ...depositTx,
              data: async () => (await depositTx.data()) + referralTag,
            }
          : depositTx;

      const depositResult = await sendTransaction(depositTxWithTag);
      handleTransactionSent(depositResult, false);

      if (depositResult?.transactionHash) {
        setTransactionStatus("Almost done...");
        const depositReceipt = await waitForReceipt({
          client,
          chain,
          transactionHash: depositResult.transactionHash,
        });
        setTransactionStatus("Success!");
        handleTransactionSuccess(depositReceipt, false);

        // Report to Divvi after successful transaction
        reportTransactionToDivvi(depositResult.transactionHash, chain.id);
      }
    } catch (err: any) {
      setTransactionStatus(null);
      handleTransactionError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMakeAnotherDeposit = () => {
    setDepositSuccess(null);
    setCurrentStep(0);
    setDepositMethod("");
    setForm({
      token: "",
      amount: "",
      lockPeriod: "0",
    });
    setError(null);
    setTransactionStatus(null);
  };

  const handleCloseSuccess = () => {
    setForm({
      token: "",
      amount: "",
      lockPeriod: "0",
    });
    setDepositMethod("");
    setDepositSuccess(null);
    onClose();
  };

  const getLockPeriodText = (seconds: string) => {
    const totalSeconds = Number.parseInt(seconds);
    if (totalSeconds === 0) {
      return "No lock";
    } else if (totalSeconds < 3600) {
      return `${totalSeconds} seconds`;
    } else if (totalSeconds < 86400) {
      const hours = Math.floor(totalSeconds / 3600);
      return `${hours} hours`;
    } else {
      const days = totalSeconds / 86400;
      return `${days} days`;
    }
  };

  const defaultLockPeriods = ["0", "2592000", "7776000", "15552000"]; // 0, 30, 90, 180 days

  const walletBalance = parseFloat(walletBalanceData?.displayValue || "0");

  const formatDisplayNumber = (value: number): string => {
    if (!isFinite(value)) return "0.0000";
    return value.toFixed(4);
  };

  const setAmountByPercent = (ratio: number) => {
    if (!walletBalance || walletBalance <= 0) return;
    const raw = walletBalance * ratio;
    const value = formatDisplayNumber(raw);
    setForm({ ...form, amount: value });
  };

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 1:
        return depositMethod !== "";
      case 2:
        return form.token !== "";
      case 3:
        return form.token !== "" && form.amount !== "";
      case 4:
        return (
          form.token !== "" && form.amount !== "" && form.lockPeriod !== ""
        );
      case 5:
        return depositSuccess !== null;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (currentStep < 5 && canProceedToStep(currentStep + 1)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getAPY = (period: string) => {
    if (!form.token || !chain?.id) return "0.00%";
    const tokenSymbol = tokenInfos[form.token]?.symbol;
    if (!tokenSymbol) return "0.00%";

    return aaveRatesService.getAPYWithBoost(
      chain.id,
      tokenSymbol,
      period,
      baseAPY
    );
  };

  const handleOnrampSuccess = () => {
    setShowOnrampModal(false);
    // Optionally set the token and continue to amount step
    setForm((prev) => ({ ...prev, token: selectedTokenForOnramp }));
    setCurrentStep(2);
  };

  const hasZeroBalance = () => {
    if (isBalanceLoading || !form.token) return false;
    return walletBalance === 0;
  };

  const isAssetSupportedForOnramp = (tokenAddress: string) => {
    try {
      const tokenSymbol = tokenInfos[tokenAddress]?.symbol;
      if (!tokenSymbol) return false;

      const chainName = chain?.name || String(chain?.id);
      return onrampService.isAssetSupportedForOnramp(tokenSymbol, chainName);
    } catch (error) {
      console.error("Error checking onramp support:", error);
      return false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md mx-auto bg-background border-0 shadow-lg p-0 overflow-hidden [&>button]:text-foreground [&>button]:hover:text-muted-foreground">
        <div className="flex h-5 w-full items-center justify-center bg-background">
          <div className="h-1 w-9 rounded-full bg-border"></div>
        </div>

        <div className="px-4 pb-5">
          <DialogTitle className="sr-only">Start Earning</DialogTitle>
          <DialogDescription className="sr-only">
            Start earning by choosing a token, entering an amount, selecting a
            lock period, and confirming your deposit.
          </DialogDescription>
          <div className="flex items-center justify-between pt-5 pb-3">
            {currentStep > 0 && currentStep !== 5 && (
              <button
                onClick={prevStep}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 text-center">
              <h1 className="text-foreground text-[22px] font-bold leading-tight tracking-[-0.015em]">
                {currentStep === 0 && "How to Deposit"}
                {currentStep === 1 && "Choose Asset"}
                {currentStep === 2 && "Enter Amount"}
                {currentStep === 3 && "Lock Period"}
                {currentStep === 4 && "Review"}
                {currentStep === 5 && "Success!"}
              </h1>
              <div className="flex justify-center gap-2 mt-2">
                {[0, 1, 2, 3, 4, 5].map((step) => (
                  <div
                    key={step}
                    className={`min-w-8 h-7 px-2 inline-flex items-center justify-center rounded-md text-sm font-semibold transition-colors ${
                      step === currentStep
                        ? "bg-primary text-primary-foreground"
                        : step < currentStep
                          ? "bg-card text-foreground"
                          : "bg-card text-muted-foreground border border-border"
                    }`}
                  >
                    {step === 5 ? <Check className="w-4 h-4" /> : step + 1}
                  </div>
                ))}
              </div>
            </div>
            {currentStep > 0 && currentStep !== 5 && <div className="w-7" />}
          </div>

          {error && (
            <div className="bg-destructive/20 border border-destructive text-destructive-foreground p-3 rounded-xl text-sm mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {requiresAuth && (
            <div className="bg-warning/20 border border-warning text-foreground p-3 rounded-xl text-sm mb-4">
              Sign in required to complete transactions
            </div>
          )}

          <div className="min-h-[300px]">
            {currentStep === 0 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDepositMethod("mpesa");
                      setTimeout(nextStep, 300);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all border ${
                      depositMethod === "mpesa"
                        ? "bg-primary text-primary-foreground border-primary scale-[0.98]"
                        : "bg-card text-foreground border-border hover:border-primary hover:bg-card/80"
                    }`}
                  >
                    <img
                      src="https://img.icons8.com/color/48/mpesa.png"
                      alt="M-Pesa"
                      className="w-10 h-10"
                    />
                    <div className="flex-1 text-left">
                      <div className="font-medium">M-Pesa</div>
                      <div
                        className={`text-sm ${depositMethod === "mpesa" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                      >
                        Deposit directly from M-Pesa
                      </div>
                    </div>
                    {depositMethod === "mpesa" && <Check className="w-5 h-5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDepositMethod("wallet");
                      setTimeout(nextStep, 300);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all border ${
                      depositMethod === "wallet"
                        ? "bg-primary text-primary-foreground border-primary scale-[0.98]"
                        : "bg-card text-foreground border-border hover:border-primary hover:bg-card/80"
                    }`}
                  >
                    <img
                      src="https://images.ctfassets.net/clixtyxoaeas/ZBdtfds3uyHpY4r7MWzCL/d3f307181b6bf92b0d886297f409066a/mUSD-hero.png"
                      alt="Wallet"
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="flex-1 text-left">
                      <div className="font-medium">Wallet or Exchange</div>
                      <div
                        className={`text-sm ${depositMethod === "wallet" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                      >
                        Directly to USDT, USDC or cUSD
                      </div>
                    </div>
                    {depositMethod === "wallet" && (
                      <Check className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  {supportedStablecoins.map((token) => {
                    const symbol = tokenInfos[token]?.symbol || "Unknown";
                    const isSelected = form.token === token;
                    const showBalance = isSelected && !isBalanceLoading;
                    const zeroBalance = isSelected && hasZeroBalance();

                    const onrampSupported = isAssetSupportedForOnramp(token);

                    return (
                      <div key={token} className="w-full">
                        <div
                          className={`w-full rounded-xl border transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card text-foreground border-border hover:border-primary hover:bg-card/80"
                          }`}
                        >
                          <div className="flex items-center gap-3 p-3">
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, token })}
                              className="flex items-center gap-3 flex-1 text-left"
                            >
                              {tokenInfos[token]?.icon ? (
                                <img
                                  src={tokenInfos[token].icon}
                                  alt={symbol}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                                  {symbol.charAt(0)}
                                </div>
                              )}
                              <div className="flex-1">
                                <div className="font-medium">{symbol}</div>
                                {isSelected && depositMethod === "wallet" && (
                                  <div
                                    className={`text-sm ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                                  >
                                    {isBalanceLoading ? (
                                      <span className="flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Loading...
                                      </span>
                                    ) : (
                                      `Balance: ${formatDisplayNumber(walletBalance)}`
                                    )}
                                  </div>
                                )}
                              </div>
                              {!isSelected && (
                                <div className="text-right">
                                  {tokenAPYs[token] !== undefined ? (
                                    <div
                                      className={`text-lg font-bold ${isSelected ? "text-primary-foreground" : "text-primary"}`}
                                    >
                                      {aaveRatesService.getAPYWithBoost(
                                        chain.id,
                                        symbol,
                                        "15552000",
                                        tokenAPYs[token]
                                      )}
                                    </div>
                                  ) : (
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  )}
                                  <div
                                    className={`text-xs ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                                  >
                                    APY
                                  </div>
                                </div>
                              )}
                              {isSelected && (
                                <Check className="w-5 h-5 ml-auto" />
                              )}
                            </button>
                          </div>

                          {isSelected && (
                            <div
                              className={`px-3 pb-3 ${isSelected ? "text-primary-foreground" : "text-foreground"}`}
                            >
                              {depositMethod === "mpesa" ? (
                                <button
                                  onClick={() => {
                                    console.log(
                                      "[SaveMoneyModal] Opening onramp modal:",
                                      {
                                        tokenAddress: token,
                                        tokenSymbol: symbol,
                                      }
                                    );
                                    setSelectedTokenForOnramp(token);
                                    setShowOnrampModal(true);
                                  }}
                                  className="w-full h-9 bg-background text-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-colors md:h-8"
                                >
                                  Continue with {symbol}
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        account?.address || ""
                                      );
                                      setCopied(true);
                                      setTimeout(() => setCopied(false), 2000);
                                    }}
                                    className="flex-1 h-9 bg-transparent border border-current text-xs rounded-lg hover:opacity-80 transition-colors md:h-8 flex items-center justify-center gap-1.5"
                                  >
                                    {copied ? (
                                      <>
                                        <Check className="w-3 h-3 animate-in fade-in duration-200" />
                                        Copied!
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        {account?.address
                                          ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
                                          : "Copy"}
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={nextStep}
                                    className="flex-1 h-9 bg-background text-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-colors md:h-8"
                                  >
                                    Continue
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm">
                    {isBalanceLoading ? (
                      <span className="flex items-center justify-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Loading balance...
                      </span>
                    ) : (
                      `Balance: ${formatDisplayNumber(walletBalance)} ${tokenInfos[form.token]?.symbol}`
                    )}
                  </p>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setForm({ ...form, amount: value });
                      }
                    }}
                    className="w-full h-16 rounded-xl text-foreground bg-card border-2 border-border focus:border-primary focus:outline-0 focus:ring-0 pl-4 pr-20 text-2xl font-medium text-center"
                    autoFocus
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {tokenInfos[form.token]?.symbol}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setAmountByPercent(0.25)}
                    className="h-10 bg-card text-foreground text-sm rounded-lg hover:bg-card/90 transition-colors"
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountByPercent(0.5)}
                    className="h-10 bg-card text-foreground text-sm rounded-lg hover:bg-card/90 transition-colors"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountByPercent(0.75)}
                    className="h-10 bg-card text-foreground text-sm rounded-lg hover:bg-card/90 transition-colors"
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const maxAmount = formatDisplayNumber(walletBalance);
                      setForm({ ...form, amount: maxAmount });
                    }}
                    className="h-10 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Max
                  </button>
                </div>

                <button
                  onClick={nextStep}
                  disabled={!form.amount}
                  className="w-full h-12 bg-primary text-primary-foreground text-base font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-foreground text-lg font-medium mb-2">
                    Lock period
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Longer = higher rewards
                  </p>
                </div>

                <div className="space-y-3">
                  {defaultLockPeriods.map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, lockPeriod: period });
                        setTimeout(nextStep, 300);
                      }}
                      className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border ${
                        form.lockPeriod === period
                          ? "bg-primary text-primary-foreground border-primary scale-[0.98]"
                          : "bg-card text-foreground border-border hover:border-primary hover:bg-card/80"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-left">
                          {getLockPeriodText(period)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-lg font-bold ${
                            form.lockPeriod === period
                              ? "text-primary-foreground"
                              : "text-primary"
                          }`}
                        >
                          {apyLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            getAPY(period)
                          )}
                        </div>
                        <div
                          className={`text-xs ${form.lockPeriod === period ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                        >
                          APY
                        </div>
                      </div>
                      {form.lockPeriod === period && (
                        <Check className="w-5 h-5 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-foreground text-lg font-medium mb-2">
                    Deposit {tokenInfos[form.token]?.symbol}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Review your deposit
                  </p>
                </div>

                <div className="bg-card rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Depositing</span>
                    <div className="text-right">
                      <div className="text-foreground font-medium">
                        {form.amount}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {tokenInfos[form.token]?.symbol}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Lock period</span>
                    <div className="text-foreground font-medium">
                      {getLockPeriodText(form.lockPeriod)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground">You'll earn</span>
                    <div className="text-right">
                      <div className="text-primary font-bold text-lg">
                        {apyLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          getAPY(form.lockPeriod)
                        )}
                      </div>
                      <div className="text-muted-foreground text-sm">APY</div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={
                    requiresAuth ||
                    !account ||
                    !form.token ||
                    !form.amount ||
                    !form.lockPeriod ||
                    isSaving ||
                    isTransactionPending
                  }
                  className="w-full h-12 bg-primary text-primary-foreground text-base font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving || isTransactionPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {transactionStatus || "Processing..."}
                    </span>
                  ) : requiresAuth ? (
                    "Sign In Required"
                  ) : (
                    "Complete Deposit"
                  )}
                </button>
              </div>
            )}

            {currentStep === 5 && depositSuccess && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-foreground text-lg font-medium mb-2">
                    Deposit Successful!
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Your funds have been deposited and are now earning rewards
                  </p>
                </div>

                <div className="bg-card rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Deposited</span>
                    <div className="text-right">
                      <div className="text-foreground font-medium">
                        {depositSuccess.amount}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {tokenInfos[depositSuccess.token]?.symbol}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Lock period</span>
                    <div className="text-foreground font-medium">
                      {getLockPeriodText(depositSuccess.lockPeriod)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground">Earning</span>
                    <div className="text-right">
                      <div className="text-primary font-bold text-lg">
                        {getAPY(depositSuccess.lockPeriod)}
                      </div>
                      <div className="text-muted-foreground text-sm">APY</div>
                    </div>
                  </div>

                  {depositSuccess.transactionHash && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground">Transaction</span>
                      <a
                        href={`${getExplorerUrl(chain?.id || 42220)}/tx/${depositSuccess.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-sm hover:underline truncate max-w-32"
                      >
                        {`${depositSuccess.transactionHash.slice(0, 6)}...${depositSuccess.transactionHash.slice(-4)}`}
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleMakeAnotherDeposit}
                    className="w-full h-12 bg-primary text-primary-foreground text-base font-bold rounded-xl hover:bg-primary/90 transition-colors"
                  >
                    Make Another Deposit
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseSuccess}
                    className="w-full h-12 bg-transparent border border-border text-foreground text-base font-medium rounded-xl hover:bg-card transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <OnrampDepositModal
          isOpen={showOnrampModal}
          onClose={() => setShowOnrampModal(false)}
          selectedAsset={tokenInfos[selectedTokenForOnramp]?.symbol || ""}
          assetSymbol={tokenInfos[selectedTokenForOnramp]?.symbol || ""}
          onSuccess={handleOnrampSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
