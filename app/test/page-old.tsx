'use client';

import React, { useState, useEffect } from 'react';
import {
  getContract,
  prepareContractCall,
  waitForReceipt,
  readContract,
} from 'thirdweb';
import { transfer } from 'thirdweb/extensions/erc20';
import { celo } from 'thirdweb/chains';
import {
  useSendTransaction,
  useReadContract,
  useActiveAccount,
} from 'thirdweb/react';
import { ConnectWallet } from '@/components/ConnectWallet';
import {
  AlertCircle,
  TrendingUp,
  DollarSign,
  Shield,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { client } from '@/lib/thirdweb/client';
import { parseUnits } from 'viem';

const CONTRACT_ADDRESS = '0x4e1B2f1b9F5d871301D41D7CeE901be2Bd97693c';
const USDC_CONTRACT_ADDRESS = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C';
const CKES_CONTRACT_ADDRESS = '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0';
const ORACLE_CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_BACKEND_ORACLE_ADDRESS as string) || '';

const contract = getContract({
  client,
  chain: celo,
  address: CONTRACT_ADDRESS,
});

const usdcContract = getContract({
  client,
  chain: celo,
  address: USDC_CONTRACT_ADDRESS,
});

const ckesContract = getContract({
  client,
  chain: celo,
  address: CKES_CONTRACT_ADDRESS,
});

const oracleContract = getContract({
  client,
  chain: celo,
  address: ORACLE_CONTRACT_ADDRESS,
});

const TOKENS = {
  USDC: USDC_CONTRACT_ADDRESS,
  cKES: CKES_CONTRACT_ADDRESS,
};

interface TestResult {
  step: number;
  description: string;
  status: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARNING';
  timestamp: string;
  data: any;
  id: number;
}

interface ContractData {
  liquidationThreshold: string;
  totalSupplyUSDC: string;
  totalBorrowscKES: string;
  isPaused: boolean;
  usdcPrice: string;
  ckesPrice: string;
  contractCkesBalance: string;
}

interface UserBalances {
  usdcCollateral: string;
  cKESBorrows: string;
  isUndercollateralized: boolean;
  usdcBalance: string;
  usdcAllowance: string;
  ckesBalance: string;
  ckesAllowance: string;
}

const MinilendTestingDashboard = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [runningTests, setRunningTests] = useState<{ [key: string]: boolean }>({});
  const [contractData, setContractData] = useState<ContractData>({
    liquidationThreshold: '0',
    totalSupplyUSDC: '0',
    totalBorrowscKES: '0',
    isPaused: false,
    usdcPrice: '0',
    ckesPrice: '0',
    contractCkesBalance: '0',
  });
  const [userBalances, setUserBalances] = useState<UserBalances>({
    usdcCollateral: '0',
    cKESBorrows: '0',
    isUndercollateralized: false,
    usdcBalance: '0',
    usdcAllowance: '0',
    ckesBalance: '0',
    ckesAllowance: '0',
  });

  const activeAccount = useActiveAccount();
  const { mutate: sendTransaction } = useSendTransaction();
  const [recipient, setRecipient] = useState<string>('');
  const [usdcAmount, setUsdcAmount] = useState<string>('1');

  const TEST_AMOUNTS = {
    USDC_DEPOSIT: '10000', // 0.01 USDC (6 decimals)
    cKES_BORROW: '800000000000000', // 0.0008 cKES (18 decimals)
    USDC_APPROVAL: '10000', // 0.01 USDC for approval
    CKES_APPROVAL: '800000000000000', // 0.0008 cKES for approval
  };

  const MAX_RETRIES = 1;
  const POLL_INTERVAL = 500; // 0.5 seconds
  const MAX_POLL_ATTEMPTS = 6; // 3 seconds total
  const GAS_LIMIT_MULTIPLIER = 1.1; // 10% buffer for gas limit

  // Utility to serialize BigInt values
  const serializeBigInt = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map(serializeBigInt);
    if (typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [key, serializeBigInt(value)])
      );
    }
    return obj;
  };

  const addTestResult = (step: number, description: string, status: TestResult['status'], data: any = null) => {
    const result: TestResult = {
      step,
      description,
      status,
      timestamp: new Date().toISOString(),
      data,
      id: Date.now() + Math.random(),
    };
    console.log(`[Step ${step}] ${description}`, { status, data: serializeBigInt(data) });
    setTestResults((prev) => [...prev, result]);
  };

  const { data: liquidationThreshold } = useReadContract({
    contract,
    method: 'function LIQUIDATION_THRESHOLD() view returns (uint256)',
    params: [],
  });

  const { data: totalSupplyUSDC } = useReadContract({
    contract,
    method: 'function totalSupply(address) view returns (uint256)',
    params: [TOKENS.USDC],
  });

  const { data: totalBorrowscKES } = useReadContract({
    contract,
    method: 'function totalBorrows(address) view returns (uint256)',
    params: [TOKENS.cKES],
  });

  const { data: isPaused } = useReadContract({
    contract,
    method: 'function isBorrowingPaused(address) view returns (bool)',
    params: [TOKENS.cKES],
  });

  const { data: usdcPriceData } = useReadContract({
    contract: oracleContract,
    method: 'function getMedianRate(address) view returns (uint256 rate, uint256 timestamp)',
    params: [TOKENS.USDC],
  });

  const { data: ckesPriceData } = useReadContract({
    contract: oracleContract,
    method: 'function getMedianRate(address) view returns (uint256 rate, uint256 timestamp)',
    params: [TOKENS.cKES],
  });

  const { data: contractCkesBalance } = useReadContract({
    contract: ckesContract,
    method: 'function balanceOf(address account) view returns (uint256)',
    params: [CONTRACT_ADDRESS],
  });

  const { data: userUSDCCollateral } = useReadContract({
    contract,
    method: 'function userCollateral(address, address) view returns (uint256)',
    params: [activeAccount?.address || '0x0', TOKENS.USDC],
  });

  const { data: usercKESBorrows } = useReadContract({
    contract,
    method: 'function userBorrows(address, address) view returns (uint256)',
    params: [activeAccount?.address || '0x0', TOKENS.cKES],
  });

  const { data: isUndercollateralized } = useReadContract({
    contract,
    method: 'function isUndercollateralized(address user, address token, address collateralToken) view returns (bool)',
    params: [activeAccount?.address || '0x0', TOKENS.cKES, TOKENS.USDC],
  });

  const { data: usdcBalance } = useReadContract({
    contract: usdcContract,
    method: 'function balanceOf(address account) view returns (uint256)',
    params: [activeAccount?.address || '0x0'],
  });

  const { data: usdcAllowance } = useReadContract({
    contract: usdcContract,
    method: 'function allowance(address owner, address spender) view returns (uint256)',
    params: [activeAccount?.address || '0x0', CONTRACT_ADDRESS],
  });

  const { data: ckesBalance } = useReadContract({
    contract: ckesContract,
    method: 'function balanceOf(address account) view returns (uint256)',
    params: [activeAccount?.address || '0x0'],
  });

  const { data: ckesAllowance } = useReadContract({
    contract: ckesContract,
    method: 'function allowance(address owner, address spender) view returns (uint256)',
    params: [activeAccount?.address || '0x0', CONTRACT_ADDRESS],
  });

  useEffect(() => {
    setContractData({
      liquidationThreshold: liquidationThreshold?.toString() || '0',
      totalSupplyUSDC: totalSupplyUSDC?.toString() || '0',
      totalBorrowscKES: totalBorrowscKES?.toString() || '0',
      isPaused: isPaused || false,
      usdcPrice: usdcPriceData?.[0]?.toString() || '0',
      ckesPrice: ckesPriceData?.[0]?.toString() || '0',
      contractCkesBalance: contractCkesBalance?.toString() || '0',
    });
  }, [liquidationThreshold, totalSupplyUSDC, totalBorrowscKES, isPaused, usdcPriceData, ckesPriceData, contractCkesBalance]);

  useEffect(() => {
    setUserBalances({
      usdcCollateral: userUSDCCollateral?.toString() || '0',
      cKESBorrows: usercKESBorrows?.toString() || '0',
      isUndercollateralized: isUndercollateralized || false,
      usdcBalance: usdcBalance?.toString() || '0',
      usdcAllowance: usdcAllowance?.toString() || '0',
      ckesBalance: ckesBalance?.toString() || '0',
      ckesAllowance: ckesAllowance?.toString() || '0',
    });
  }, [userUSDCCollateral, usercKESBorrows, isUndercollateralized, usdcBalance, usdcAllowance, ckesBalance, ckesAllowance]);

  const waitForTransaction = async (txHash: string, step: number): Promise<any> => {
    try {
      const receipt = await waitForReceipt({
        client,
        chain: celo,
        transactionHash: txHash as `0x${string}`,
      });
      if (receipt.status === 'reverted') {
        const errorMessage = `Transaction reverted: ${txHash}`;
        addTestResult(step, errorMessage, 'ERROR', { transactionHash: txHash, receipt });
        throw new Error(errorMessage);
      }
      return receipt;
    } catch (error: any) {
      const errorMessage = error?.reason || error?.message || 'Transaction confirmation failed';
      addTestResult(step, `Transaction failed: ${errorMessage}`, 'ERROR', { transactionHash: txHash, error });
      throw error;
    }
  };

  const pollForStateUpdate = async (
    checkCondition: () => boolean,
    description: string,
    step: number,
    fetchData: () => Promise<any>,
  ): Promise<void> => {
    if (checkCondition()) {
      addTestResult(step, `${description} updated`, 'SUCCESS');
      return;
    }

    for (let attempts = 0; attempts < MAX_POLL_ATTEMPTS; attempts++) {
      await fetchData();
      if (checkCondition()) {
        addTestResult(step, `${description} updated`, 'SUCCESS');
        return;
      }
      if (attempts < MAX_POLL_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      }
    }
    addTestResult(step, `Timed out waiting for ${description} update`, 'WARNING');
  };

  const executeStepWithRetry = async (
    stepNumber: number,
    stepFunction: () => Promise<void>,
    maxRetries: number = MAX_RETRIES,
  ) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await stepFunction();
        return;
      } catch (error: any) {
        const errorMessage = error?.reason || error?.message || 'Unknown error occurred';
        console.error(`Step ${stepNumber} attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          addTestResult(stepNumber, `Step ${stepNumber} failed after ${maxRetries} attempts: ${errorMessage}`, 'ERROR', error);
          throw error;
        }
        addTestResult(stepNumber, `Step ${stepNumber} attempt ${attempt} failed, retrying...`, 'WARNING', errorMessage);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  };

  const setTestRunning = (testName: string, isRunning: boolean) => {
    setRunningTests(prev => ({ ...prev, [testName]: isRunning }));
  };

  const runIndividualTest = async (testName: string, stepNumber: number, testFunction: () => Promise<void>) => {
    if (!activeAccount) {
      addTestResult(stepNumber, 'No wallet connected', 'ERROR', 'Please connect wallet first');
      return;
    }

    setTestRunning(testName, true);
    try {
      await executeStepWithRetry(stepNumber, testFunction);
    } catch (error) {
      addTestResult(stepNumber, `${testName} failed`, 'ERROR', error);
    } finally {
      setTestRunning(testName, false);
    }
  };

  const runStep0_CheckBalanceAndApproval = async () => {
    addTestResult(0, 'Checking wallet USDC and cKES balance and approval', 'INFO');

    try {
      const requiredUSDCBalance = BigInt(TEST_AMOUNTS.USDC_DEPOSIT);
      const requiredUSDCAllowance = BigInt(TEST_AMOUNTS.USDC_APPROVAL);
      const requiredCKESBalance = BigInt(TEST_AMOUNTS.CKES_APPROVAL);
      const requiredCKESAllowance = BigInt(TEST_AMOUNTS.CKES_APPROVAL);
      const currentUSDCBalance = BigInt(usdcBalance?.toString() || '0');
      const currentUSDCAllowance = BigInt(usdcAllowance?.toString() || '0');
      const currentCKESBalance = BigInt(ckesBalance?.toString() || '0');
      const currentCKESAllowance = BigInt(ckesAllowance?.toString() || '0');

      addTestResult(0, `Wallet USDC balance: ${currentUSDCBalance.toString()}, cKES balance: ${currentCKESBalance.toString()}`, 'INFO', {
        usdcBalance: currentUSDCBalance.toString(),
        ckesBalance: currentCKESBalance.toString(),
      });

      if (currentUSDCBalance < requiredUSDCBalance) {
        const errorMessage = `Insufficient USDC balance: ${currentUSDCBalance.toString()} < ${requiredUSDCBalance.toString()}`;
        addTestResult(0, errorMessage, 'ERROR');
        throw new Error(errorMessage);
      }

      if (currentCKESBalance < requiredCKESBalance) {
        const errorMessage = `Insufficient cKES balance: ${currentCKESBalance.toString()} < ${requiredCKESBalance.toString()}`;
        addTestResult(0, errorMessage, 'ERROR');
        throw new Error(errorMessage);
      }

      if (currentUSDCAllowance < requiredUSDCAllowance) {
        addTestResult(0, 'Approving USDC for contract', 'INFO');
        const transaction = prepareContractCall({
          contract: usdcContract,
          method: 'function approve(address spender, uint256 amount)',
          params: [CONTRACT_ADDRESS, requiredUSDCAllowance],
          gas: BigInt(80000),
        });

        const txHash = await new Promise<string>((resolve, reject) => {
          sendTransaction(transaction, {
            onSuccess: (result) => resolve(result.transactionHash),
            onError: (error: any) => reject(error),
          });
        });

        addTestResult(0, 'USDC approval transaction sent', 'INFO', { transactionHash: txHash });
        const receipt = await waitForTransaction(txHash, 0);
        addTestResult(0, 'USDC approval confirmed', 'SUCCESS', receipt);

        await pollForStateUpdate(
          () => BigInt(usdcAllowance?.toString() || '0') >= requiredUSDCAllowance,
          'USDC allowance',
          0,
          async () => {
            const allowance = await readContract({
              contract: usdcContract,
              method: 'function allowance(address owner, address spender) view returns (uint256)',
              params: [activeAccount!.address, CONTRACT_ADDRESS],
            });
            return allowance;
          }
        );
      } else {
        addTestResult(0, 'Sufficient USDC allowance', 'SUCCESS', { allowance: currentUSDCAllowance.toString() });
      }

      if (currentCKESAllowance < requiredCKESAllowance) {
        addTestResult(0, 'Approving cKES for contract', 'INFO');
        const transaction = prepareContractCall({
          contract: ckesContract,
          method: 'function approve(address spender, uint256 amount)',
          params: [CONTRACT_ADDRESS, requiredCKESAllowance],
          gas: BigInt(80000),
        });

        const txHash = await new Promise<string>((resolve, reject) => {
          sendTransaction(transaction, {
            onSuccess: (result) => resolve(result.transactionHash),
            onError: (error: any) => reject(error),
          });
        });

        addTestResult(0, 'cKES approval transaction sent', 'INFO', { transactionHash: txHash });
        const receipt = await waitForTransaction(txHash, 0);
        addTestResult(0, 'cKES approval confirmed', 'SUCCESS', receipt);

        await pollForStateUpdate(
          () => BigInt(ckesAllowance?.toString() || '0') >= requiredCKESAllowance,
          'cKES allowance',
          0,
          async () => {
            const allowance = await readContract({
              contract: ckesContract,
              method: 'function allowance(address owner, address spender) view returns (uint256)',
              params: [activeAccount!.address, CONTRACT_ADDRESS],
            });
            return allowance;
          }
        );
      } else {
        addTestResult(0, 'Sufficient cKES allowance', 'SUCCESS', { allowance: currentCKESAllowance.toString() });
      }
    } catch (error: any) {
      const errorMessage = error?.reason || error?.message || 'Failed to check balance or approve tokens';
      addTestResult(0, errorMessage, 'ERROR', error);
      throw error;
    }
  };

  const runStep1_ReadContractState = async () => {
    addTestResult(1, 'Reading initial contract state and oracle prices', 'INFO');

    try {

      console.log('[Step 1] Oracle Prices:', {
        usdcPrice: usdcPriceData?.[0]?.toString() || '0',
        usdcTimestamp: usdcPriceData?.[1]?.toString() || '0',
        ckesPrice: ckesPriceData?.[0]?.toString() || '0',
        ckesTimestamp: ckesPriceData?.[1]?.toString() || '0',
      });

      if (contractData.isPaused) {
        addTestResult(1, 'Borrowing for cKES is paused', 'ERROR', 'Cannot proceed with testing while borrowing is paused');
        throw new Error('Borrowing is paused');
      }

      if (BigInt(contractData.usdcPrice || '0') === BigInt(0)) {
        addTestResult(1, 'USDC price not available from oracle', 'ERROR', {
          usdcPrice: contractData.usdcPrice,
          timestamp: usdcPriceData?.[1]?.toString() || '0',
        });
        throw new Error('USDC price not available');
      }

      if (BigInt(contractData.ckesPrice || '0') === BigInt(0)) {
        addTestResult(1, 'cKES price not available from oracle', 'ERROR', {
          ckesPrice: contractData.ckesPrice,
          timestamp: ckesPriceData?.[1]?.toString() || '0',
        });
        throw new Error('cKES price not available');
      }

      if (BigInt(contractData.contractCkesBalance || '0') < BigInt(TEST_AMOUNTS.cKES_BORROW)) {
        addTestResult(1, 'Contract has insufficient cKES balance for borrowing', 'ERROR', {
          contractCkesBalance: contractData.contractCkesBalance,
          required: TEST_AMOUNTS.cKES_BORROW,
        });
        throw new Error('Insufficient contract cKES balance');
      }

      if (contractData.liquidationThreshold && contractData.liquidationThreshold !== '0') {
        addTestResult(1, 'Contract state and oracle prices read successfully', 'SUCCESS', {
          ...contractData,
          usdcPrice: formatAmount(contractData.usdcPrice, 18) + ' CELO',
          ckesPrice: formatAmount(contractData.ckesPrice, 18) + ' CELO',
        });
      } else {
        addTestResult(1, 'Failed to read contract state', 'WARNING', 'Data not available or still loading');
      }
    } catch (error: any) {
      const errorMessage = error?.reason || error?.message || 'Error reading contract state';
      addTestResult(1, errorMessage, 'ERROR', error);
      throw error;
    }
  };

  const runStep2_DepositCollateral = async () => {
    addTestResult(2, `Depositing ${formatAmount(TEST_AMOUNTS.USDC_DEPOSIT, 6)} USDC as collateral`, 'INFO');

    const requiredDeposit = BigInt(TEST_AMOUNTS.USDC_DEPOSIT);
    const currentBalance = BigInt(usdcBalance?.toString() || '0');
    const currentAllowance = BigInt(usdcAllowance?.toString() || '0');

    addTestResult(2, `Pre-deposit check - Balance: ${formatAmount(currentBalance.toString(), 6)} USDC, Allowance: ${formatAmount(currentAllowance.toString(), 6)} USDC`, 'INFO');

    if (currentBalance < requiredDeposit) {
      const errorMessage = `Insufficient USDC balance: ${currentBalance.toString()} < ${requiredDeposit.toString()}`;
      addTestResult(2, errorMessage, 'ERROR');
      throw new Error(errorMessage);
    }

    if (currentAllowance < requiredDeposit) {
      const errorMessage = `Insufficient USDC allowance: ${currentAllowance.toString()} < ${requiredDeposit.toString()}`;
      addTestResult(2, errorMessage, 'ERROR');
      throw new Error(errorMessage);
    }

    const transaction = prepareContractCall({
      contract,
      method: 'function depositCollateral(address token, uint256 amount)',
      params: [TOKENS.USDC, requiredDeposit],
      gas: BigInt(200000),
    });

    try {
      const txHash = await new Promise<string>((resolve, reject) => {
        sendTransaction(transaction, {
          onSuccess: (result) => resolve(result.transactionHash),
          onError: (error: any) => reject(error),
        });
      });

      addTestResult(2, 'Collateral deposit transaction sent', 'INFO', { transactionHash: txHash });

      const receipt = await waitForTransaction(txHash, 2);
      addTestResult(2, 'Collateral deposit confirmed', 'SUCCESS', receipt);

      await pollForStateUpdate(
        () => BigInt(userBalances.usdcCollateral || '0') >= requiredDeposit,
        'USDC collateral',
        2,
        async () => {
          const collateral = await readContract({
            contract,
            method: 'function userCollateral(address, address) view returns (uint256)',
            params: [activeAccount!.address, TOKENS.USDC],
          });
          return collateral;
        }
      );
    } catch (error: any) {
      const errorMessage = error?.reason || error?.message || 'Collateral deposit failed';
      addTestResult(2, `Collateral deposit failed: ${errorMessage}`, 'ERROR', error);
      throw error;
    }
  };

  const runStep3_BorrowcKES = async () => {
    addTestResult(3, `Borrowing ${formatAmount(TEST_AMOUNTS.cKES_BORROW)} cKES`, 'INFO');

    // Debug: Log oracle prices, contract state, and collateral
    console.log('[Step 3] Debug Info:', {
      usdcPrice: contractData.usdcPrice,
      ckesPrice: contractData.ckesPrice,
      isPaused: contractData.isPaused,
      contractCkesBalance: contractData.contractCkesBalance,
      userUSDCCollateral: userBalances.usdcCollateral,
      usdcCollateralFormatted: formatAmount(userBalances.usdcCollateral, 6),
    });

    // Pre-borrow checks
    if (contractData.isPaused) {
      const errorMessage = 'Borrowing for cKES is paused';
      addTestResult(3, errorMessage, 'ERROR');
      throw new Error(errorMessage);
    }

    if (BigInt(contractData.contractCkesBalance || '0') < BigInt(TEST_AMOUNTS.cKES_BORROW)) {
      const errorMessage = `Contract cKES balance too low: ${contractData.contractCkesBalance} < ${TEST_AMOUNTS.cKES_BORROW}`;
      addTestResult(3, errorMessage, 'ERROR');
      throw new Error(errorMessage);
    }

    // Pre-borrow collateralization check using oracle prices
    const collateralAmount = BigInt(userBalances.usdcCollateral || '0');
    const borrowAmount = BigInt(TEST_AMOUNTS.cKES_BORROW);
    const usdcPrice = BigInt(contractData.usdcPrice || '0');
    const ckesPrice = BigInt(contractData.ckesPrice || '0');
    const liquidationThreshold = BigInt(contractData.liquidationThreshold || '150');

    // Convert amounts to CELO value
    const collateralValueInCelo = (collateralAmount * usdcPrice) / BigInt(10 ** 6); // USDC has 6 decimals
    const loanValueInCelo = (borrowAmount * ckesPrice) / BigInt(10 ** 18); // cKES has 18 decimals
    const requiredCollateralValueInCelo = (loanValueInCelo * liquidationThreshold) / BigInt(100);
    const requiredCollateralInUsdc = (requiredCollateralValueInCelo * BigInt(10 ** 6)) / usdcPrice;

    addTestResult(3, `Pre-borrow check - Collateral: ${formatAmount(collateralAmount.toString(), 6)} USDC (${formatAmount(collateralValueInCelo.toString(), 18)} CELO), Required: ${formatAmount(requiredCollateralInUsdc.toString(), 6)} USDC (${formatAmount(requiredCollateralValueInCelo.toString(), 18)} CELO)`, 'INFO', {
      collateralAmount: collateralAmount.toString(),
      collateralValueInCelo: collateralValueInCelo.toString(),
      borrowAmount: borrowAmount.toString(),
      loanValueInCelo: loanValueInCelo.toString(),
      usdcPrice: formatAmount(usdcPrice.toString(), 18),
      ckesPrice: formatAmount(ckesPrice.toString(), 18),
    });

    if (collateralValueInCelo < requiredCollateralValueInCelo) {
      const errorMessage = `Insufficient collateral: ${formatAmount(collateralAmount.toString(), 6)} USDC (${formatAmount(collateralValueInCelo.toString(), 18)} CELO) < ${formatAmount(requiredCollateralInUsdc.toString(), 6)} USDC (${formatAmount(requiredCollateralValueInCelo.toString(), 18)} CELO) required for ${formatAmount(borrowAmount.toString())} cKES`;
      addTestResult(3, errorMessage, 'ERROR');
      throw new Error(errorMessage);
    }

    const transaction = prepareContractCall({
      contract,
      method: 'function borrow(address token, uint256 amount, address collateralToken)',
      params: [TOKENS.cKES, borrowAmount, TOKENS.USDC],
      gas: BigInt(1000000),
    });

    try {
      const txHash = await new Promise<string>((resolve, reject) => {
        sendTransaction(transaction, {
          onSuccess: (result) => resolve(result.transactionHash),
          onError: (error: any) => reject(error),
        });
      });

      addTestResult(3, 'Borrow transaction sent', 'INFO', { transactionHash: txHash });

      const receipt = await waitForTransaction(txHash, 3);
      addTestResult(3, 'Borrow confirmed', 'SUCCESS', receipt);

      await pollForStateUpdate(
        () => BigInt(userBalances.cKESBorrows || '0') >= borrowAmount,
        'cKES borrows',
        3,
        async () => {
          const borrows = await readContract({
            contract,
            method: 'function userBorrows(address, address) view returns (uint256)',
            params: [activeAccount!.address, TOKENS.cKES],
          });
          return borrows;
        }
      );
    } catch (error: any) {
      const errorMessage = error?.reason || error?.message || 'Borrow transaction failed';
      addTestResult(3, `Borrow failed: ${errorMessage}`, 'ERROR', error);
      throw error;
    }
  };

  const runStep4_CheckHealth = async () => {
    addTestResult(4, 'Checking position health', 'INFO');

    // Skip delay for health check

    const healthStatus = userBalances.isUndercollateralized ? 'UNHEALTHY' : 'HEALTHY';
    const status = userBalances.isUndercollateralized ? 'WARNING' : 'SUCCESS';

    addTestResult(4, `Position is ${healthStatus}`, status, userBalances);
  };

  const runStep5_PartialRepay = async () => {
    const repayAmount = BigInt(TEST_AMOUNTS.cKES_BORROW) / BigInt(2);
    addTestResult(5, `Partial repayment of ${formatAmount(repayAmount.toString())} cKES`, 'INFO');

    const ckesPrice = BigInt(contractData.ckesPrice || '0');
    const repayValueInCelo = (repayAmount * ckesPrice) / BigInt(10 ** 18);
    addTestResult(5, `Repay value: ${formatAmount(repayAmount.toString())} cKES (${formatAmount(repayValueInCelo.toString(), 18)} CELO)`, 'INFO');

    const currentCKESBalance = BigInt(ckesBalance?.toString() || '0');
    if (currentCKESBalance < repayAmount) {
      const errorMessage = `Insufficient cKES balance for repayment: ${currentCKESBalance.toString()} < ${repayAmount.toString()}`;
      addTestResult(5, errorMessage, 'ERROR');
      throw new Error(errorMessage);
    }

    const currentDebt = BigInt(userBalances.cKESBorrows || '0');
    if (currentDebt === BigInt(0)) {
      addTestResult(5, 'No outstanding cKES debt to repay', 'WARNING');
      return;
    }

    const transaction = prepareContractCall({
      contract,
      method: 'function repay(address token, uint256 amount)',
      params: [TOKENS.cKES, repayAmount],
      gas: BigInt(200000),
    });

    try {
      const txHash = await new Promise<string>((resolve, reject) => {
        sendTransaction(transaction, {
          onSuccess: (result) => resolve(result.transactionHash),
          onError: (error: any) => reject(error),
        });
      });

      addTestResult(5, 'Repayment transaction sent', 'INFO', { transactionHash: txHash });

      const receipt = await waitForTransaction(txHash, 5);
      addTestResult(5, 'Partial repayment confirmed', 'SUCCESS', receipt);

      await pollForStateUpdate(
        () => BigInt(userBalances.cKESBorrows || '0') <= BigInt(TEST_AMOUNTS.cKES_BORROW) - repayAmount,
        'cKES borrows after repayment',
        5,
        async () => {
          const borrows = await readContract({
            contract,
            method: 'function userBorrows(address, address) view returns (uint256)',
            params: [activeAccount!.address, TOKENS.cKES],
          });
          return borrows;
        }
      );
    } catch (error: any) {
      const errorMessage = error?.reason || error?.message || 'Repayment transaction failed';
      addTestResult(5, `Repayment failed: ${errorMessage}`, 'ERROR', error);
      throw error;
    }
  };

  const runCompleteTest = async () => {
    if (!activeAccount) {
      addTestResult(0, 'No wallet connected', 'ERROR', 'Please connect wallet first');
      return;
    }

    setTestRunning('complete', true);
    setTestResults([]);

    const testSteps = [
      { name: 'Balance Check', fn: runStep0_CheckBalanceAndApproval, step: 0 },
      { name: 'Contract State', fn: runStep1_ReadContractState, step: 1 },
      { name: 'Deposit Collateral', fn: runStep2_DepositCollateral, step: 2 },
      { name: 'Borrow cKES', fn: runStep3_BorrowcKES, step: 3 },
      { name: 'Check Health', fn: runStep4_CheckHealth, step: 4 },
      { name: 'Partial Repay', fn: runStep5_PartialRepay, step: 5 },
    ];

    for (const { name, fn, step } of testSteps) {
      try {
        await executeStepWithRetry(step, fn);
      } catch (error) {
        setTestRunning('complete', false);
        addTestResult(step + 1, 'Test suite aborted due to error', 'ERROR', error);
        return;
      }
    }

    setTestRunning('complete', false);
    addTestResult(6, 'Test suite completed', 'SUCCESS', `${testSteps.length} steps executed`);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'ERROR':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'WARNING':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'INFO':
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatAmount = (amount: string, decimals = 18) => {
    try {
      if (!amount || amount === '0') return '0';
      const formatted = (BigInt(amount) / BigInt(10 ** decimals)).toString();
      return parseFloat(formatted).toFixed(6);
    } catch (error) {
      console.error('Error formatting amount:', error);
      return '0';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🌾 Minilend Protocol Testing Dashboard
          </h1>
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 text-yellow-500 mr-2" />
              <p className="text-sm text-yellow-700">
                Warning: This is a Celo mainnet test involving real funds. Ensure your wallet has sufficient CELO for gas, at least 0.01 USDC for collateral, and 0.0008 cKES for testing. Collateral requirements may vary based on oracle prices.
              </p>
            </div>
          </div>
          <div className="w-full sm:w-auto sm:text-right">
            <ConnectWallet />
          </div>
          <p className="text-gray-600">
            Production testing suite for Minilend protocol on Celo Mainnet
          </p>
          <div className="mt-4 text-sm text-gray-500">
            Contract: {CONTRACT_ADDRESS} | Oracle: {ORACLE_CONTRACT_ADDRESS}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Account Status
            </h2>
            {activeAccount && (
              <div className="text-sm text-gray-600">
                Connected: {activeAccount.address.slice(0, 6)}...{activeAccount.address.slice(-4)}
              </div>
            )}
          </div>

          {!activeAccount ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Please connect your wallet to continue</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">USDC Balance</span>
                </div>
                <div className="text-2xl font-bold text-blue-900">
                  {formatAmount(userBalances.usdcBalance, 6)} USDC
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">USDC Collateral</span>
                </div>
                <div className="text-2xl font-bold text-blue-900">
                  {formatAmount(userBalances.usdcCollateral, 6)} USDC
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">cKES Borrowed</span>
                </div>
                <div className="text-2xl font-bold text-purple-900">
                  {formatAmount(userBalances.cKESBorrows)} cKES
                </div>
              </div>
              <div className={`rounded-lg p-4 ${userBalances.isUndercollateralized ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className={`w-4 h-4 ${userBalances.isUndercollateralized ? 'text-red-600' : 'text-green-600'}`} />
                  <span className={`text-sm font-medium ${userBalances.isUndercollateralized ? 'text-red-800' : 'text-green-800'}`}>
                    Health Status
                  </span>
                </div>
                <div className={`text-2xl font-bold ${userBalances.isUndercollateralized ? 'text-red-900' : 'text-green-900'}`}>
                  {userBalances.isUndercollateralized ? 'Unhealthy' : 'Healthy'}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-800">USDC Allowance</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatAmount(userBalances.usdcAllowance, 6)} USDC
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-800">cKES Balance</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatAmount(userBalances.ckesBalance)} cKES
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5" />
            Contract Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Liquidation Threshold</div>
              <div className="text-lg font-semibold">{contractData.liquidationThreshold}%</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total USDC Supply</div>
              <div className="text-lg font-semibold">{formatAmount(contractData.totalSupplyUSDC, 6)} USDC</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total cKES Borrows</div>
              <div className="text-lg font-semibold">{formatAmount(contractData.totalBorrowscKES)} cKES</div>
            </div>
            <div className={`rounded-lg p-4 ${contractData.isPaused ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className="text-sm text-gray-600 mb-1">cKES Borrowing Status</div>
              <div className={`text-lg font-semibold ${contractData.isPaused ? 'text-red-900' : 'text-green-900'}`}>
                {contractData.isPaused ? 'Paused' : 'Active'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">USDC Price (CELO)</div>
              <div className="text-lg font-semibold">{formatAmount(contractData.usdcPrice, 18)} CELO</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">cKES Price (CELO)</div>
              <div className="text-lg font-semibold">{formatAmount(contractData.ckesPrice, 18)} CELO</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Contract cKES Balance</div>
              <div className="text-lg font-semibold">{formatAmount(contractData.contractCkesBalance)} cKES</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Quick Wallet Actions</h2>
          {!activeAccount ? (
            <div className="text-sm text-gray-600">Connect a wallet to send transactions.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-2">Send USDC</h3>
                <div className="space-y-3">
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="Recipient address (0x...)"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <input
                      className="flex-1 border rounded px-3 py-2"
                      placeholder="Amount (e.g. 1.0)"
                      value={usdcAmount}
                      onChange={(e) => setUsdcAmount(e.target.value)}
                    />
                    <button
                      className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      disabled={!recipient}
                      onClick={async () => {
                        try {
                          const token = getContract({ client, chain: celo, address: USDC_CONTRACT_ADDRESS });
                          const tx = prepareContractCall({
                            contract: token,
                            method: 'function transfer(address to, uint256 amount)',
                            params: [recipient as `0x${string}`, parseUnits(usdcAmount || '0', 6)],
                          });
                          await new Promise<void>((resolve, reject) => {
                            sendTransaction(tx, {
                              onSuccess: (res) => {
                                addTestResult(100, 'Sent USDC', 'SUCCESS', { transactionHash: res.transactionHash });
                                resolve();
                              },
                              onError: (error: any) => reject(error),
                            });
                          });
                        } catch (error: any) {
                          addTestResult(100, 'Send USDC failed', 'ERROR', error?.message || error);
                        }
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Test Suite</h2>
            <div className="flex gap-2">
              <button
                onClick={clearResults}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Clear Results
              </button>
              <button
                onClick={runCompleteTest}
                disabled={!activeAccount || runningTests.complete || contractData.isPaused}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {runningTests.complete ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Running All Tests...
                  </>
                ) : (
                  'Run Complete Test Suite'
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => runIndividualTest('Balance Check', 0, runStep0_CheckBalanceAndApproval)}
              disabled={!activeAccount || runningTests['Balance Check']}
              className="p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:bg-gray-100 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-green-800">Step 0: Balance Check</h3>
                {runningTests['Balance Check'] && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                )}
              </div>
              <p className="text-sm text-green-600">Check USDC/cKES balance and approvals</p>
            </button>

            <button
              onClick={() => runIndividualTest('Contract State', 1, runStep1_ReadContractState)}
              disabled={!activeAccount || runningTests['Contract State']}
              className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-blue-800">Step 1: Contract State</h3>
                {runningTests['Contract State'] && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
              </div>
              <p className="text-sm text-blue-600">Read contract state and oracle prices</p>
            </button>

            <button
              onClick={() => runIndividualTest('Deposit Collateral', 2, runStep2_DepositCollateral)}
              disabled={!activeAccount || runningTests['Deposit Collateral']}
              className="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:bg-gray-100 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-purple-800">Step 2: Deposit Collateral</h3>
                {runningTests['Deposit Collateral'] && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                )}
              </div>
              <p className="text-sm text-purple-600">Deposit USDC as collateral</p>
            </button>

            <button
              onClick={() => runIndividualTest('Borrow cKES', 3, runStep3_BorrowcKES)}
              disabled={!activeAccount || runningTests['Borrow cKES']}
              className="p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:bg-gray-100 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-orange-800">Step 3: Borrow cKES</h3>
                {runningTests['Borrow cKES'] && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                )}
              </div>
              <p className="text-sm text-orange-600">Borrow cKES against USDC collateral</p>
            </button>

            <button
              onClick={() => runIndividualTest('Check Health', 4, runStep4_CheckHealth)}
              disabled={!activeAccount || runningTests['Check Health']}
              className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 disabled:bg-gray-100 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-yellow-800">Step 4: Check Health</h3>
                {runningTests['Check Health'] && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                )}
              </div>
              <p className="text-sm text-yellow-600">Check position health status</p>
            </button>

            <button
              onClick={() => runIndividualTest('Partial Repay', 5, runStep5_PartialRepay)}
              disabled={!activeAccount || runningTests['Partial Repay']}
              className="p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:bg-gray-100 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-red-800">Step 5: Partial Repay</h3>
                {runningTests['Partial Repay'] && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                )}
              </div>
              <p className="text-sm text-red-600">Partially repay cKES loan</p>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>

          {testResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No test results yet. Run the test suite to see results.
            </div>
          ) : (
            <div className="space-y-3">
              {testResults.map((result) => (
                <div key={result.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span className="font-medium">Step {result.step}</span>
                      <span className="text-gray-600">{result.description}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {result.data && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      <pre className="whitespace-pre-wrap">
                        {typeof result.data === 'string' ? result.data : JSON.stringify(serializeBigInt(result.data), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MinilendTestingDashboard;