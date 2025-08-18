"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  WifiOff,
  Shield,
  BarChart3,
  LucideIcon,
} from "lucide-react";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { ThirdwebConnectWalletButton } from "@/components/ThirdwebConnectWalletButton";
import {
  useBorrow,
  useDeposit,
  useDepositCollateral,
  useRepay,
  useWithdraw,
  useSupportedStablecoins,
  useSupportedCollateral,
  useUserBorrows,
  useUserCollateral,
  useUserDeposits,
} from "../lib/thirdweb/minilend-contract";
import { getContract, prepareContractCall, waitForReceipt, readContract } from "thirdweb";
import { client } from "@/lib/thirdweb/client";
import { celo } from "thirdweb/chains";
import { parseUnits } from "viem";
import { extractTransactionError } from "@/lib/utils/errorMapping";
import { isDataSaverEnabled, enableDataSaver } from "@/lib/serviceWorker";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";
import { oracleService } from "@/lib/services/oracleService";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LoadingIndicator,
  DataAwareRender,
} from "@/components/ui/loading-indicator";

import { TxStatusModal, TxStep } from "@/components/TxStatusModal";
import { SaveMoneyModal } from "@/components/SaveMoneyModal";
import { BorrowMoneyModal } from "@/components/BorrowMoneyModal";
import { PayBackModal } from "@/components/PayBackModal";
import { FundsWithdrawalModal } from "@/components/FundsWithdrawalModal";


// Types
interface ActionCard {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
}

interface TokenInfo {
  symbol: string;
  decimals: number;
}

interface TransactionModalState {
  isOpen: boolean;
  type: "success" | "error" | "pending";
  message: string;
  txHash: string | undefined;
}

// Action Cards Grid Component
const ActionCardsGrid = ({ actionCards, onCardClick }: { actionCards: ActionCard[], onCardClick: (id: string) => void }) => {
  const renderCard = useCallback((card: ActionCard) => {
    const IconComponent = card.icon;
    const handleClick = () => onCardClick(card.id);
    
    return (
      <Card key={card.id} className="group cursor-pointer border-0 shadow-md sm:shadow-lg hover:shadow-xl sm:hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 sm:hover:-translate-y-2 bg-white/80 backdrop-blur-sm overflow-hidden" onClick={handleClick}>
        <CardContent className="p-3 sm:p-6 text-center relative">
          <div className={`w-10 h-10 sm:w-16 sm:h-16 ${card.color} rounded-lg sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-4 group-hover:scale-110 transition-transform duration-300`}>
            <IconComponent className={`w-5 h-5 sm:w-8 sm:h-8 ${card.iconColor}`} />
          </div>
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-0.5 sm:mb-2">{card.title}</h3>
          <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{card.description}</p>
          <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
        </CardContent>
      </Card>
    );
  }, [onCardClick]);

  return (
    <DataAwareRender
      lowBandwidthFallback={
        <div className="grid grid-cols-2 gap-3 max-w-4xl mx-auto px-2 sm:px-0">
          {actionCards.map(renderCard)}
        </div>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto px-2 sm:px-0">
        {actionCards.map(renderCard)}
      </div>
    </DataAwareRender>
  );
};

export default function HomePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const account = useActiveAccount();
  const address = account?.address;
  const isConnected = !!account;
  const { mutate: sendTransaction } = useSendTransaction();

  // Get contract instance
  const contract = getContract({
    client,
    chain: celo,
    address: MINILEND_ADDRESS,
  });

  // Contract functions
  const borrowFn = useBorrow();
  const depositFn = useDeposit();
  const depositCollateralFn = useDepositCollateral();
  const repayFn = useRepay();
  const withdrawFn = useWithdraw();

  // Supported stablecoins from deployment config
  const ALL_SUPPORTED_TOKENS = [
      "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0", // cKES
      // "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787", // cREAL
      // "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08", // eXOF
      // "0x8A567e2aE79CA692Bd748aB832081C45de4041eA", // cCOP
      // "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313", // cGHS
      // "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B", // PUSO
      "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
      // "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
      "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
      "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
      // "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3", // USDGLO
      "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71", // cNGN
  ];

  const FALLBACK_STABLECOINS = useMemo(() => ALL_SUPPORTED_TOKENS.slice(0, 4), []);

  // Valid collateral assets from deployment config
  const FALLBACK_COLLATERAL = useMemo(() => [
    "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", // USDC
    "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
    "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73", // cEUR
    "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", // USDT
    // "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3", // USDGLO
  ], []);

  // Read supported tokens from contract (first few indices)
  const stablecoin0 = useSupportedStablecoins(contract, BigInt(0));
  const stablecoin1 = useSupportedStablecoins(contract, BigInt(1));
  const stablecoin2 = useSupportedStablecoins(contract, BigInt(2));
  const collateral0 = useSupportedCollateral(contract, BigInt(0));
  const collateral1 = useSupportedCollateral(contract, BigInt(1));

  // Get supported tokens with fallback
  const supportedStablecoins = useMemo(() => {
    const tokens = [stablecoin0.data, stablecoin1.data, stablecoin2.data]
      .filter(token => token && token !== '0x0000000000000000000000000000000000000000');
    return tokens.length > 0 ? tokens : FALLBACK_STABLECOINS;
  }, [stablecoin0.data, stablecoin1.data, stablecoin2.data, FALLBACK_STABLECOINS]);

  const supportedCollateral = useMemo(() => {
    const tokens = [collateral0.data, collateral1.data]
      .filter(token => token && token !== '0x0000000000000000000000000000000000000000');
    return tokens.length > 0 ? tokens : FALLBACK_COLLATERAL;
  }, [collateral0.data, collateral1.data, FALLBACK_COLLATERAL]);

  // All unique tokens
  const allTokens = useMemo(() => {
    return [...new Set([...supportedStablecoins, ...supportedCollateral])];
  }, [supportedStablecoins, supportedCollateral]);

  // Get actual wallet balances from ERC20 contracts
  const [walletBalances, setWalletBalances] = useState<Record<string, string>>({});
  
  
  useEffect(() => {
    const fetchWalletBalances = async () => {
      if (!address || !isConnected) return;
      
      const balances: Record<string, string> = {};
      
      for (const token of allTokens) {
        if (!token) continue;
        try {
          const tokenContract = getContract({
            client,
            chain: celo,
            address: token,
          });
          
          const balance = await readContract({
            contract: tokenContract,
            method: "function balanceOf(address) view returns (uint256)",
            params: [address],
          });
          
          balances[token] = balance.toString();
        } catch (error: unknown) {
          console.error(`Error fetching balance for ${token}:`, error);
          balances[token] = "0";
        }
      }
      
      setWalletBalances(balances);
    };

    fetchWalletBalances();
  }, [address, isConnected, allTokens, client]);
  
  const userBorrow0 = useUserBorrows(contract, address || "", allTokens[0] || "");
  const userBorrow1 = useUserBorrows(contract, address || "", allTokens[1] || "");
  const userBorrow2 = useUserBorrows(contract, address || "", allTokens[2] || "");
  
  const userCollateral0 = useUserCollateral(contract, address || "", allTokens[0] || "");
  const userCollateral1 = useUserCollateral(contract, address || "", allTokens[1] || "");
  const userCollateral2 = useUserCollateral(contract, address || "", allTokens[2] || "");
  
  const userDeposit0 = useUserDeposits(contract, address || "", allTokens[0] || "", BigInt(0));
  const userDeposit1 = useUserDeposits(contract, address || "", allTokens[1] || "", BigInt(0));
  const userDeposit2 = useUserDeposits(contract, address || "", allTokens[2] || "", BigInt(0));

  // Use wallet balances for SaveMoneyModal
  const userBalances = walletBalances;

  const userBorrows = useMemo(() => {
    const borrows: Record<string, string> = {};
    if (allTokens[0]) borrows[allTokens[0]] = userBorrow0.data?.toString() || "0";
    if (allTokens[1]) borrows[allTokens[1]] = userBorrow1.data?.toString() || "0";
    if (allTokens[2]) borrows[allTokens[2]] = userBorrow2.data?.toString() || "0";
    return borrows;
  }, [userBorrow0.data, userBorrow1.data, userBorrow2.data, allTokens]);

  const userCollaterals = useMemo(() => {
    const collaterals: Record<string, string> = {};
    if (allTokens[0]) collaterals[allTokens[0]] = userCollateral0.data?.toString() || "0";
    if (allTokens[1]) collaterals[allTokens[1]] = userCollateral1.data?.toString() || "0";
    if (allTokens[2]) collaterals[allTokens[2]] = userCollateral2.data?.toString() || "0";
    return collaterals;
  }, [userCollateral0.data, userCollateral1.data, userCollateral2.data, allTokens]);

  const userDeposits = useMemo(() => {
    const deposits: Record<string, string> = {};
    if (allTokens[0] && userDeposit0.data) deposits[allTokens[0]] = userDeposit0.data[0]?.toString() || "0";
    if (allTokens[1] && userDeposit1.data) deposits[allTokens[1]] = userDeposit1.data[0]?.toString() || "0";
    if (allTokens[2] && userDeposit2.data) deposits[allTokens[2]] = userDeposit2.data[0]?.toString() || "0";
    return deposits;
  }, [userDeposit0.data, userDeposit1.data, userDeposit2.data, allTokens]);

  const depositLockEnds = useMemo(() => {
    const lockEnds: Record<string, number> = {};
    if (allTokens[0] && userDeposit0.data) lockEnds[allTokens[0]] = Number(userDeposit0.data[1]) || 0;
    if (allTokens[1] && userDeposit1.data) lockEnds[allTokens[1]] = Number(userDeposit1.data[1]) || 0;
    if (allTokens[2] && userDeposit2.data) lockEnds[allTokens[2]] = Number(userDeposit2.data[1]) || 0;
    return lockEnds;
  }, [userDeposit0.data, userDeposit1.data, userDeposit2.data, allTokens]);

  // Token info mapping
  const tokenInfos = useMemo((): Record<string, TokenInfo> => {
    const tokenMap: Record<string, TokenInfo> = {
      "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": { symbol: "USDC", decimals: 6 },
      "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": { symbol: "USDT", decimals: 6 },
      "0x765DE816845861e75A25fCA122bb6898B8B1282a": { symbol: "cUSD", decimals: 18 },
      "0x471EcE3750Da237f93B8E339c536989b8978a438": { symbol: "CELO", decimals: 18 },
      "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": { symbol: "cKES", decimals: 18 },
      "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71": { symbol: "cNGN", decimals: 18 },

      // "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": { symbol: "cEUR", decimals: 18 },
      // "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": { symbol: "cREAL", decimals: 18 },
      // "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08": { symbol: "eXOF", decimals: 18 },
      // "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B": { symbol: "PUSO", decimals: 18 },
      // "0x8A567e2aE79CA692Bd748aB832081C45de4041eA": { symbol: "cCOP", decimals: 18 },
      // "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313": { symbol: "cGHS", decimals: 18 },
      // "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": { symbol: "USDGLO", decimals: 18 },
    };
    return tokenMap;
  }, []);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txSteps, setTxSteps] = useState<TxStep[]>([]);
  const [txTitle, setTxTitle] = useState<string>("Transaction");

  const openTx = (title: string, steps: TxStep[]) => {
    setTxTitle(title);
    setTxSteps(steps);
    setTxModalOpen(true);
  };

  const setStepStatus = (stepId: string, status: TxStep["status"]) => {
    setTxSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status } : s)));
  };
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationSkipped, setVerificationSkipped] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [dataSaverEnabled, setDataSaverEnabled] = useState(false);


  // Check if any critical hooks are loading (only check first few to reduce loading time)
  const loading = useMemo(() => {
    return (
      userBorrow0.isLoading || userDeposit0.isLoading
    );
  }, [
    userBorrow0.isLoading, userDeposit0.isLoading
  ]);

  useEffect(() => {
    if (isConnected && address && !session?.user?.address) {
      signIn("self-protocol", {
        address,
        verificationData: "",
        redirect: false,
      });
    }
  }, [isConnected, address, session]);

  // Check localStorage for verification skip state
  useEffect(() => {
    const skipped = localStorage.getItem('verification-skipped') === 'true';
    setVerificationSkipped(skipped);
  }, []);

  // Remove forced verification - make it optional
  useEffect(() => {
    if (sessionStatus === "loading") return;
    // Don't show verification if user has skipped it or is already verified
    setNeedsVerification(isConnected && !session?.user?.verified && !verificationSkipped);
  }, [isConnected, session, sessionStatus, verificationSkipped]);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    updateStatus();
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  useEffect(() => {
    setDataSaverEnabled(isDataSaverEnabled());
  }, []);

  const toggleDataSaver = () => {
    const newState = !dataSaverEnabled;
    setDataSaverEnabled(newState);
    enableDataSaver(newState);
  };

  const getTokenInfo = (tokenAddress: string): TokenInfo => {
    return tokenInfos[tokenAddress] || { symbol: "UNKNOWN", decimals: 18 };
  };

  const executeWithOracleValidation = async (
    transactionFn: () => Promise<string>,
    options: {
      tokens: string[];
      onOracleError: (error: string) => void;
    }
  ): Promise<string> => {
    try {
      // Validate oracle prices for all tokens
      const isValid = await oracleService.validateMultipleTokens(options.tokens);
      if (!isValid) {
        throw new Error("Unable to get current market prices. Please try again in a moment.");
      }
      
      return await transactionFn();
    } catch (error: unknown) {
      const errorMessage = extractTransactionError(error as Error);
      console.error('Transaction execution error:', error);
      
      if (errorMessage.includes("Oracle") || errorMessage.includes("price")) {
        options.onOracleError(errorMessage);
      } else {
        // Handle other types of errors with appropriate user feedback
        options.onOracleError(errorMessage);
      }
      throw error;
    }
  };

  const handleSaveMoney = async (token: string, amount: string, lockPeriod: number) => {
    if (!token || !amount || lockPeriod <= 0) {
      setTransactionModal({ isOpen: true, type: 'error', message: 'Invalid input parameters', txHash: undefined });
      return;
    }

    const tokenInfo = getTokenInfo(token);
    const amountWei = parseUnits(amount, tokenInfo.decimals);

    try {
      openTx('Saving', [
        { id: 'approve', label: 'Approving token...', status: 'pending' },
        { id: 'save', label: 'Saving...', status: 'idle' },
      ]);
      
      // First approve the token
      const tokenContract = getContract({
        client,
        chain: celo,
        address: token,
      });
      
      const approveTransaction = prepareContractCall({
        contract: tokenContract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [MINILEND_ADDRESS, amountWei],
      });
      
      const approveResult: any = await new Promise((resolve, reject) =>
        sendTransaction(approveTransaction, {
          onSuccess: resolve,
          onError: reject,
        })
      );
      await waitForReceipt({ client, chain: celo, transactionHash: approveResult.transactionHash as `0x${string}` });
      setStepStatus('approve', 'success');
      setStepStatus('save', 'pending');
      
      const txHash = await executeWithOracleValidation(
        async () => {
          return await depositFn(contract, token, amountWei, BigInt(lockPeriod));
        },
        { 
          tokens: [token],
          onOracleError: (error) => {
            setStepStatus('save', 'error');
          }
        }
      );
      
      // Wait for transaction confirmation
      await waitForReceipt({ client, chain: celo, transactionHash: txHash as `0x${string}` });
      setStepStatus('save', 'success');
    } catch (error: unknown) {
      const errorMessage = extractTransactionError(error as Error);
      console.error('Save money error:', error);
      setStepStatus('approve', 'error');
    }
  };

  const handleBorrowMoney = async (token: string, amount: string, collateralToken: string) => {
    if (!token || !amount || !collateralToken) {
      setTransactionModal({ isOpen: true, type: 'error', message: 'Invalid input parameters', txHash: undefined });
      return;
    }

    try {
      setTransactionModal({ isOpen: true, type: 'pending', message: 'Borrowing money...', txHash: undefined });
      
      const tokenInfo = getTokenInfo(token);
      const amountWei = parseUnits(amount, tokenInfo.decimals);
      const txHash = await borrowFn(contract, token, amountWei, collateralToken);
      
      // Wait for transaction confirmation
      await waitForReceipt({ client, chain: celo, transactionHash: txHash as `0x${string}` });
      
      const borrowTokenInfo = getTokenInfo(token);
      setTransactionModal({ 
        isOpen: true, 
        type: 'success', 
        message: `Successfully borrowed ${amount} ${borrowTokenInfo.symbol}!`, 
        txHash 
      });
    } catch (error: unknown) {
      const errorMessage = extractTransactionError(error as Error);
      console.error('Borrow money error:', error);
      setTransactionModal({ isOpen: true, type: 'error', message: errorMessage, txHash: undefined });
    }
  };

  const handleDepositCollateral = async (token: string, amount: string) => {
    if (!token || !amount) {
      setTransactionModal({ isOpen: true, type: 'error', message: 'Invalid input parameters', txHash: undefined });
      return;
    }

    const tokenInfo = getTokenInfo(token);
    const amountWei = parseUnits(amount, tokenInfo.decimals);

    try {
      openTx('Depositing collateral', [
        { id: 'approve', label: 'Approving token...', status: 'pending' },
        { id: 'deposit', label: 'Depositing collateral...', status: 'idle' },
      ]);
      
      // First approve the token
      const tokenContract = getContract({
        client,
        chain: celo,
        address: token,
      });
      
      const approveTransaction = prepareContractCall({
        contract: tokenContract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [MINILEND_ADDRESS, amountWei],
      });
      
      const approveResult: any = await new Promise((resolve, reject) =>
        sendTransaction(approveTransaction, {
          onSuccess: resolve,
          onError: reject,
        })
      );
      await waitForReceipt({ client, chain: celo, transactionHash: approveResult.transactionHash as `0x${string}` });
      setStepStatus('approve', 'success');
      setStepStatus('deposit', 'pending');
      
      const txHash = await depositCollateralFn(contract, token, amountWei);
      
      await waitForReceipt({ client, chain: celo, transactionHash: txHash as `0x${string}` });
      setStepStatus('deposit', 'success');
    } catch (error: unknown) {
      const errorMessage = extractTransactionError(error as Error);
      console.error('Deposit collateral error:', error);
      setStepStatus('approve', 'error');
    }
  };

  const handlePayBack = async (token: string, amount: string) => {
    if (!token || !amount) {
      setTransactionModal({ isOpen: true, type: 'error', message: 'Invalid input parameters', txHash: undefined });
      return;
    }

    const tokenInfo = getTokenInfo(token);
    const amountWei = parseUnits(amount, tokenInfo.decimals);

    try {
      openTx('Pay back loan', [
        { id: 'approve', label: 'Approving token...', status: 'pending' },
        { id: 'repay', label: 'Paying back loan...', status: 'idle' },
      ]);
      
      // First approve the token
      const tokenContract = getContract({
        client,
        chain: celo,
        address: token,
      });
      
      const approveTransaction = prepareContractCall({
        contract: tokenContract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [MINILEND_ADDRESS, amountWei],
      });
      
      const approveResult: any = await new Promise((resolve, reject) =>
        sendTransaction(approveTransaction, {
          onSuccess: resolve,
          onError: reject,
        })
      );
      await waitForReceipt({ client, chain: celo, transactionHash: approveResult.transactionHash as `0x${string}` });
      setStepStatus('approve', 'success');
      setStepStatus('repay', 'pending');
      
      const txHash = await executeWithOracleValidation(
        async () => {
          return await repayFn(contract, token, amountWei);
        },
        { 
          tokens: [token],
          onOracleError: (error) => {
            setStepStatus('repay', 'error');
          }
        }
      );
      
      // Wait for transaction confirmation
      await waitForReceipt({ client, chain: celo, transactionHash: txHash as `0x${string}` });
      setStepStatus('repay', 'success');
    } catch (error: unknown) {
      const errorMessage = extractTransactionError(error as Error);
      console.error('Pay back error:', error);
      setStepStatus('approve', 'error');
    }
  };

  const handleWithdraw = async (token: string, amount: string) => {
    if (!token || !amount) {
      setTransactionModal({ isOpen: true, type: 'error', message: 'Invalid input parameters', txHash: undefined });
      return;
    }

    try {
      openTx('Withdraw', [
        { id: 'withdraw', label: 'Withdrawing...', status: 'pending' },
      ]);
      
      const txHash = await executeWithOracleValidation(
        async () => {
          const tokenInfo = getTokenInfo(token);
          const amountWei = parseUnits(amount, tokenInfo.decimals);
          return await withdrawFn(contract, token, amountWei);
        },
        { 
          tokens: [token],
          onOracleError: (error) => {
            setStepStatus('withdraw', 'error');
          }
        }
      );
      
      // Wait for transaction confirmation
      await waitForReceipt({ client, chain: celo, transactionHash: txHash as `0x${string}` });
      setStepStatus('withdraw', 'success');
    } catch (error: unknown) {
      const errorMessage = extractTransactionError(error as Error);
      console.error('Withdraw error:', error);
      setStepStatus('withdraw', 'error');
    }
  };

  const handleCardClick = useCallback((cardId: string) => {
    if (cardId === "history") {
      router.push("/dashboard");
    } else {
      setActiveModal(cardId);
    }
  }, [router]);

  const actionCards = useMemo((): ActionCard[] => [
    {
      id: "save",
      title: "Save Money",
      description: "Earn interest on your savings",
      icon: TrendingUp,
      color: "bg-gradient-to-br from-green-500 to-emerald-600",
      iconColor: "text-green-100",
    },
    {
      id: "borrow",
      title: "Borrow Money",
      description: "Get a loan with collateral",
      icon: ArrowDownLeft,
      color: "bg-gradient-to-br from-blue-500 to-cyan-600",
      iconColor: "text-blue-100",
    },
    {
      id: "withdraw",
      title: "Withdraw",
      description: "Take out your savings",
      icon: ArrowUpRight,
      color: "bg-gradient-to-br from-orange-500 to-amber-600",
      iconColor: "text-orange-100",
    },
    {
      id: "payback",
      title: "Pay Back",
      description: "Repay your loans",
      icon: ArrowUpRight,
      color: "bg-gradient-to-br from-purple-500 to-violet-600",
      iconColor: "text-purple-100",
    },
  ], []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-3 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img
                src="/minilend-logo.png"
                alt="Minilend Logo"
                className="w-10 h-10 object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-primary">
                MiniLend
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">
                Grow Your Money
              </p>
            </div>
          </div>

          <div className="flex-shrink-0">
            <ThirdwebConnectWalletButton size="sm" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-3 py-6 sm:px-4 sm:py-8 max-w-6xl mx-auto">
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleDataSaver}
            className="flex items-center text-xs sm:text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md"
          >
            <WifiOff className="w-3 h-3 mr-1" />
            Data Saver: {dataSaverEnabled ? "ON" : "OFF"}
          </button>
        </div>

        {!isOnline && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 mb-4 text-sm flex items-center">
            <WifiOff className="w-4 h-4 mr-2" />
            <p>You are currently offline. Some features may be limited.</p>
          </div>
        )}

        {needsVerification && isConnected && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 mb-4 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Shield className="w-4 h-4 mr-2" />
                <p>Verify you're human for enhanced security (optional)</p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  size="sm"
                  onClick={() => router.push("/self")}
                  className="bg-primary hover:bg-primary/90 text-white text-xs px-3 py-1 h-7"
                >
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    localStorage.setItem('verification-skipped', 'true');
                    setVerificationSkipped(true);
                    setNeedsVerification(false);
                  }}
                  className="text-gray-600 hover:text-gray-800 text-xs px-3 py-1 h-7"
                >
                  Skip
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading && isConnected ? (
          <LoadingIndicator size="md" text="Loading account..." delay={100} />
        ) : !isConnected ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl sm:shadow-2xl max-w-md w-full mx-3">
              <CardContent className="p-5 sm:p-8 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Wallet className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-primary mb-2 sm:mb-3">
                  Open App
                </h2>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                  Launch App to start saving in dollars and borrowing money 
                  using your local stablecoin
                </p>

                <ThirdwebConnectWalletButton size="lg" />
                {typeof window !== "undefined" && !window.ethereum && (
                  <p className="text-gray-500 text-xs sm:text-sm mt-4">
                    Don&apos;t have a wallet?{" "}
                    <a
                      href="https://metamask.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:text-secondary"
                    >
                      Install MetaMask
                    </a>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
                Welcome to MiniLend
              </h2>
              <p className="text-gray-600 text-base sm:text-lg">
                Choose an action to get started
              </p>
              {session?.user?.verified ? (
                <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified Human
                </div>
              ) : isConnected && (
                <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  <Shield className="w-3 h-3 mr-1" />
                  Unverified
                </div>
              )}
            </div>
            {/* Action Cards Grid */}
            <ActionCardsGrid actionCards={actionCards} onCardClick={handleCardClick} />

            {/* Quick Stats */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-2xl mx-auto border-0 shadow-md sm:shadow-lg">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 text-center">
                Quick Actions
              </h3>
              <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="w-full bg-white/80 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all duration-200 rounded-xl"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                {/* <Button
                  variant="outline"
                  className="w-full bg-white/80 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all duration-200 rounded-xl"
                  onClick={() =>
                    window.open(
                      "https://celoscan.io/address/0x4e1B2f1b9F5d871301D41D7CeE901be2Bd97693c",
                      "_blank"
                    )
                  }
                >
                  View on CeloScan
                </Button> */}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <SaveMoneyModal
        isOpen={activeModal === "save"}
        onClose={() => setActiveModal(null)}
        onSave={handleSaveMoney}
        userBalances={userBalances}
        tokenInfos={tokenInfos}
        loading={loading}
      />
      <BorrowMoneyModal
        isOpen={activeModal === "borrow"}
        onClose={() => setActiveModal(null)}
        onBorrow={handleBorrowMoney}
        onDepositCollateral={handleDepositCollateral}
        userBalances={userBalances}
        userCollaterals={userCollaterals}
        tokenInfos={tokenInfos}
        loading={loading}

      />
      <PayBackModal
        isOpen={activeModal === "payback"}
        onClose={() => setActiveModal(null)}
        onPayBack={handlePayBack}
        tokenInfos={tokenInfos}
        loading={loading}
        userBalances={userBalances}
      />
      <FundsWithdrawalModal
        isOpen={activeModal === "withdraw"}
        onClose={() => setActiveModal(null)}
        onWithdraw={handleWithdraw}
        userDeposits={userDeposits}
        depositLockEnds={depositLockEnds}
        tokenInfos={tokenInfos}
        loading={loading}
      />
      <TxStatusModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        steps={txSteps}
        title={txTitle}
      />
    </div>
  );
}
