import { useState } from "react";
import { getContract, prepareContractCall, waitForReceipt } from "thirdweb";
import { getApprovalForTransaction } from "thirdweb/extensions/erc20";
import { parseUnits } from "viem";
import { reportInfo, reportError } from "@/lib/services/errorReportingService";
import { getBestStablecoinForDeposit } from "@/lib/services/balanceService";
import { getVaultAddress, hasVaultContracts } from "@/config/chainConfig";
import { vaultABI, withdrawMethodABI } from "@/lib/constants";
import { executeWithGasSponsorship, logGasInfo } from "@/lib/utils/gasSponsorship";

interface WalletOperationsProps {
  account: any;
  chain: any;
  defaultToken: any;
  client: any;
  sendTransaction: any;
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
    onError: (error: Error) => void
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
      // Select the best stablecoin for deposit
      onStatus("Setting up your deposit...");
      const bestToken = await getBestStablecoinForDeposit(
        account.address,
        chain.id
      );

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
        decimals: bestToken.decimals,
      };

      const walletBalance = bestToken.balance;
      const inputAmountKES = parseFloat(depositAmount);

      onStatus("processing...");

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
      const usdAmount = inputAmountKES * usdPerKES;

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
        amount: depositAmount,
        tokenSymbol: selectedToken.symbol,
        chainId: chain?.id,
        userId: account?.address,
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
        }
      }

      onStatus("Completing your deposit...");
      const depositResult = await sendTransaction(depositTx);

      if (depositResult?.transactionHash) {
        onStatus("Almost done...");
        const depositReceipt = await waitForReceipt({
          client,
          chain,
          transactionHash: depositResult.transactionHash,
        });
        onStatus("Success!");
        onSuccess(depositReceipt, usdAmount, selectedToken);
      }
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
        { sponsorGas }
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

  return {
    prepareQuickSaveDepositTransaction,
    handleQuickSaveDeposit,
    handleVaultWithdrawal,
    pendingDeposit,
    setPendingDeposit,
  };
}
