import { useState } from "react";
import { ethers } from "ethers";
import { getContract, prepareContractCall, waitForReceipt } from "thirdweb";
import { getApprovalForTransaction } from "thirdweb/extensions/erc20";
import { parseUnits } from "viem";
import {
  reportInfo,
  reportWarning,
  reportError,
} from "@/lib/services/errorReportingService";
import { getBestStablecoinForDeposit } from "@/lib/services/balanceService";
import { getVaultAddress, hasVaultContracts } from "@/config/chainConfig";
import { erc20TransferABI, vaultABI, withdrawMethodABI } from "@/lib/constants";
import {
  executeWithGasSponsorship,
  GasSponsorshipError,
  logGasInfo,
} from "@/lib/utils/gasSponsorship";
import { activityService } from "@/lib/services/activityService";

interface WalletOperationsProps {
  account: any;
  chain: any;
  defaultToken: any;
  client: any;
  sendTransaction: any;
}

type DepositMethod = "ONCHAIN" | "MPESA";

interface QuickSaveDepositOptions {
  depositMethod?: DepositMethod;
  token?: {
    address: string;
    symbol: string;
    decimals: number;
    balance?: number;
  } | null;
}

/**
 * Custom hook for wallet operations like deposits and withdrawals
 */
export function useWalletOperations({
  account,
  chain,
  defaultToken,
  client,
  sendTransaction,
}: WalletOperationsProps) {
  const [pendingDeposit, setPendingDeposit] = useState(false);

  /**
   * Prepare a deposit transaction for vault
   */
  const prepareQuickSaveDepositTransaction = async (
    amount: string,
    token?: any
  ) => {
    const selectedToken = token || defaultToken;
    if (!selectedToken || !account || !chain) {
      throw new Error("Missing required parameters");
    }

    const chainId = chain.id;
    const isVaultChain = hasVaultContracts(chainId);

    if (!isVaultChain) {
      throw new Error("This chain is not yet supported for deposits");
    }

    const decimals = selectedToken.decimals || 18;
    const amountWei = parseUnits(amount, decimals);
    const tokenSymbol = selectedToken.symbol;

    try {
      const vaultAddress = getVaultAddress(chainId, tokenSymbol);

      const vaultContract = getContract({
        client,
        chain: chain,
        address: vaultAddress,
        abi: vaultABI,
      });

      // Use 30-day lock period for Quick Save (lockTierId = 1)
      const lockTierId = 1;

      const depositTx = prepareContractCall({
        contract: vaultContract,
        method: "deposit",
        params: [amountWei, BigInt(lockTierId)],
        erc20Value: {
          tokenAddress: selectedToken.address,
          amountWei,
        },
      });

      return depositTx;
    } catch (error) {
      reportError("Error preparing vault transaction", {
        component: "useWalletOperations",
        operation: "prepareQuickSaveDepositTransaction",
        chainId: chain?.id,
        tokenSymbol: selectedToken.symbol,
        additional: { error },
      });
      throw error;
    }
  };

  /**
   * Handle deposit from quick save or goal
   */
  const handleQuickSaveDeposit = async (
    depositAmount: string,
    onStatus: (status: string) => void,
    onSuccess: (receipt: any, usdAmount: number, token: any) => void,
    onError: (error: Error) => void,
    options: QuickSaveDepositOptions = {}
  ) => {
    if (!account) {
      setPendingDeposit(true);
      onStatus("Connecting wallet automatically...");
      return;
    }

    if (!chain) {
      onError(new Error("Network not available"));
      return;
    }

    try {
      const depositMethod = options.depositMethod || "ONCHAIN";
      const inputAmount = Number.parseFloat(depositAmount);

      if (!inputAmount || inputAmount <= 0) {
        onError(new Error("Enter a valid amount"));
        return;
      }

      // Select the best stablecoin for deposit
      onStatus("Setting up your deposit...");
      const bestToken =
        options.token ||
        (await getBestStablecoinForDeposit(account.address, chain.id));

      if (!bestToken) {
        onError(
          new Error(
            "You have $0 in your wallet. To deposit, please add funds using Mobile Money or transfer from another wallet."
          )
        );
        return;
      }

      // Use the selected token
      const selectedToken = {
        address: bestToken.address,
        symbol: bestToken.symbol,
        decimals: bestToken.decimals || defaultToken?.decimals || 18,
      };

      const walletBalance =
        typeof bestToken.balance === "number" ? bestToken.balance : 0;
      let usdAmount = inputAmount;

      onStatus("processing...");

      if (depositMethod !== "ONCHAIN") {
        // Convert KES amount to USD equivalent using exchange rate API
        const exchangeRateResponse = await fetch("/api/onramp/exchange-rate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ currency_code: "KES" }),
        });

        if (!exchangeRateResponse.ok) {
          throw new Error(
            "Failed to get exchange rate for KES to USD conversion"
          );
        }

        const exchangeRateData = await exchangeRateResponse.json();

        if (!exchangeRateData.success || !exchangeRateData.data) {
          throw new Error("Invalid exchange rate response");
        }

        // The API returns buying_rate and selling_rate in KES per USD
        // selling_rate: 130.59 means 1 USD = 130.59 KES, so 1 KES = 1/130.59 USD
        const sellingRate = exchangeRateData.data.data?.selling_rate;

        if (!sellingRate || sellingRate <= 0) {
          throw new Error(
            "Exchange rate data does not contain valid selling rate"
          );
        }

        const usdPerKES = 1 / sellingRate;
        usdAmount = inputAmount * usdPerKES;
      }

      // Check if converted USD amount exceeds wallet balance
      if (usdAmount > walletBalance) {
        onError(
          new Error(
            `Amount exceeds available balance of $${walletBalance.toFixed(
              2
            )} in ${selectedToken.symbol}`
          )
        );
        return;
      }

      // Report transaction start for monitoring
      reportInfo("Deposit started", {
        component: "useWalletOperations",
        operation: "handleQuickSaveDeposit",
        amount: usdAmount.toString(),
        tokenSymbol: selectedToken.symbol,
        chainId: chain?.id,
        userId: account?.address,
        additional: {
          inputAmount: depositAmount,
          inputCurrency: depositMethod === "ONCHAIN" ? "USD" : "KES",
        },
      });

      onStatus("Setting up your deposit...");
      const depositTx = await prepareQuickSaveDepositTransaction(
        usdAmount.toString(),
        selectedToken
      );

      // Get approval if needed
      const approveTx = await getApprovalForTransaction({
        transaction: depositTx as any,
        account: account,
      });

      const executeDepositFlow = async () => {
        if (approveTx) {
          onStatus("Authorizing transaction...");
          const approveResult = await sendTransaction(approveTx);

          if (approveResult?.transactionHash) {
            onStatus("Processing authorization...");
            await waitForReceipt({
              client,
              chain,
              transactionHash: approveResult.transactionHash,
            });
          } else {
            throw new Error("Approval transaction failed");
          }
        }

        onStatus("Completing your deposit...");
        const depositResult = await sendTransaction(depositTx);

        if (!depositResult?.transactionHash) {
          throw new Error("Deposit transaction failed");
        }

        onStatus("Almost done...");
        const depositReceipt = await waitForReceipt({
          client,
          chain,
          transactionHash: depositResult.transactionHash,
        });
        onStatus("Success!");
        return depositReceipt;
      };

      const isSponsorshipError = (error: unknown) =>
        error instanceof GasSponsorshipError ||
        (error instanceof Error && error.name === "GasSponsorshipError");

      const getGasShortfall = async (gasLimit: number) => {
        if (typeof window === "undefined" || !window.ethereum) return null;

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const [balance, feeData] = await Promise.all([
          provider.getBalance(account.address),
          provider.getFeeData(),
        ]);
        const maxFeePerGas =
          feeData.maxFeePerGas || feeData.gasPrice || ethers.BigNumber.from(0);
        if (maxFeePerGas.lte(0)) return null;

        const estimatedGasCost = maxFeePerGas.mul(gasLimit);
        return balance.lt(estimatedGasCost)
          ? estimatedGasCost.sub(balance)
          : null;
      };

      const sponsorGasLimit = approveTx ? 250000 : 180000;
      const gasShortfall = await getGasShortfall(sponsorGasLimit);
      const shouldSponsor = gasShortfall === null || gasShortfall.gt(0);

      let depositReceipt: any;

      if (shouldSponsor) {
        onStatus("Requesting gas sponsorship...");
        await logGasInfo(account.address, sponsorGasLimit);
        try {
          depositReceipt = await executeWithGasSponsorship(
            account.address,
            executeDepositFlow,
            {
              sponsorGas: true,
              gasLimit: sponsorGasLimit,
              chainId: chain.id,
            }
          );
        } catch (error) {
          if (!isSponsorshipError(error)) {
            throw error;
          }
          reportWarning("Gas sponsorship failed; retrying with wallet gas", {
            component: "useWalletOperations",
            operation: "handleQuickSaveDeposit",
            chainId: chain?.id,
            userId: account?.address,
            additional: {
              gasLimit: sponsorGasLimit,
              gasShortfall: gasShortfall ? gasShortfall.toString() : "unknown",
            },
          });
          depositReceipt = await executeDepositFlow();
        }
      } else {
        depositReceipt = await executeDepositFlow();
      }

      onSuccess(depositReceipt, usdAmount, selectedToken);
    } catch (err: any) {
      onError(err);
    }
  };

  const handleVaultWithdrawal = async (
    tokenSymbol: string,
    depositIds: number[],
    sponsorGas: boolean = true
  ) => {
    if (!account?.address) {
      throw new Error("Wallet not connected. Please connect your wallet to withdraw.");
    }
    if (!chain?.id) {
      throw new Error("Network not detected. Please ensure you're connected to a supported network.");
    }
    if (!depositIds || depositIds.length === 0) {
      throw new Error("No deposits selected for withdrawal.");
    }

    const userAddress = account.address;
    const vaultAddress = getVaultAddress(chain.id, tokenSymbol);
    if (!vaultAddress) {
      throw new Error(`No vault address found for ${tokenSymbol} on chain ${chain.id}`);
    }

    try {
      await logGasInfo(userAddress);

        await executeWithGasSponsorship(
          userAddress,
          async () => {
          for (const depositId of depositIds) {
            const vaultContract = getContract({ client, chain, address: vaultAddress });
            const withdrawTx = prepareContractCall({
              contract: vaultContract,
              method: withdrawMethodABI,
              params: [BigInt(depositId)],
            });
            const result = await sendTransaction(withdrawTx);
            await waitForReceipt({ client, chain, transactionHash: result.transactionHash });
            
            // Track withdrawal activity
            activityService.trackWithdrawal(
              0, // Amount will be updated when we get the actual withdrawal amount
              tokenSymbol,
              result.transactionHash,
              undefined,
              userAddress
            );
            
            await fetch(`/api/goals/vault-withdraw`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: userAddress,
                chainId: chain.id,
                depositId,
                transactionHash: result.transactionHash,
                withdrawnAmount: "0",
                yieldEarned: "0",
              }),
            });
          }
        },
        { sponsorGas, chainId: chain.id }
      );
    } catch (error) {
      reportError("Vault withdrawal failed", {
        component: "useWalletOperations",
        operation: "handleVaultWithdrawal",
        chainId: chain?.id,
        tokenSymbol,
        additional: { error, depositIds },
      });
      throw error;
    }
  };

  const handleSettlementTransfer = async (
    tokenAddress: string,
    amount: string,
    toAddress: string,
    decimals?: number
  ): Promise<string> => {
    if (!account?.address) {
      throw new Error("Wallet not connected. Please connect your wallet to transfer.");
    }
    if (!chain?.id) {
      throw new Error("Network not detected. Please ensure you're connected to a supported network.");
    }
    if (!tokenAddress || !toAddress) {
      throw new Error("Missing token or destination address.");
    }

    const tokenDecimals = typeof decimals === "number" ? decimals : defaultToken?.decimals || 18;
    const amountWei = parseUnits(amount, tokenDecimals);

    try {
      const tokenContract = getContract({
        client,
        chain,
        address: tokenAddress,
        abi: [erc20TransferABI],
      });

      const transferTx = prepareContractCall({
        contract: tokenContract,
        method: erc20TransferABI,
        params: [toAddress, amountWei],
      });

      const result = await sendTransaction(transferTx);
      if (!result?.transactionHash) {
        throw new Error("Transfer failed to submit");
      }

      await waitForReceipt({
        client,
        chain,
        transactionHash: result.transactionHash,
      });

      return result.transactionHash;
    } catch (error) {
      reportError("Settlement transfer failed", {
        component: "useWalletOperations",
        operation: "handleSettlementTransfer",
        chainId: chain?.id,
        tokenSymbol: defaultToken?.symbol,
        additional: { error, tokenAddress, toAddress },
      });
      throw error;
    }
  };

  return {
    prepareQuickSaveDepositTransaction,
    handleQuickSaveDeposit,
    handleVaultWithdrawal,
    handleSettlementTransfer,
    pendingDeposit,
    setPendingDeposit,
  };
}
