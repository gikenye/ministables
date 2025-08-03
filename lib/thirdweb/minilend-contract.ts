import { prepareContractCall, prepareEvent } from "thirdweb";
import { useSendTransaction, useReadContract, useContractEvents } from "thirdweb/react";

// ================================= WRITE FUNCTIONS =================================

export const useBorrow = () => {
  const { mutate: sendTransaction } = useSendTransaction();
  
  return (contract: any, token: string, amount: bigint, collateralToken: string) => {
    return new Promise<string>((resolve, reject) => {
      const transaction = prepareContractCall({
        contract,
        method: "function borrow(address token, uint256 amount, address collateralToken)",
        params: [token, amount, collateralToken],
      });
      sendTransaction(transaction, {
        onSuccess: (result) => resolve(result.transactionHash),
        onError: (error) => reject(error)
      });
    });
  };
};

export const useDeposit = () => {
  const { mutate: sendTransaction } = useSendTransaction();
  
  return (contract: any, token: string, amount: bigint, lockPeriod: bigint) => {
    return new Promise<string>((resolve, reject) => {
      const transaction = prepareContractCall({
        contract,
        method: "function deposit(address token, uint256 amount, uint256 lockPeriod)",
        params: [token, amount, lockPeriod],
      });
      sendTransaction(transaction, {
        onSuccess: (result) => resolve(result.transactionHash),
        onError: (error) => reject(error)
      });
    });
  };
};

export const useDepositCollateral = () => {
  const { mutate: sendTransaction } = useSendTransaction();
  
  return (contract: any, token: string, amount: bigint) => {
    return new Promise<string>((resolve, reject) => {
      const transaction = prepareContractCall({
        contract,
        method: "function depositCollateral(address token, uint256 amount)",
        params: [token, amount],
      });
      sendTransaction(transaction, {
        onSuccess: (result) => resolve(result.transactionHash),
        onError: (error) => reject(error)
      });
    });
  };
};

export const useDepositUSDCollateral = () => {
  const { mutate: sendTransaction } = useSendTransaction();
  
  return (contract: any, amount: bigint) => {
    return new Promise<string>((resolve, reject) => {
      const transaction = prepareContractCall({
        contract,
        method: "function depositUSDCollateral(uint256 amount)",
        params: [amount],
      });
      sendTransaction(transaction, {
        onSuccess: (result) => resolve(result.transactionHash),
        onError: (error) => reject(error)
      });
    });
  };
};

export const useLiquidate = () => {
  const { mutate: sendTransaction } = useSendTransaction();
  
  return (contract: any, user: string, token: string, collateralToken: string) => {
    return new Promise<string>((resolve, reject) => {
      const transaction = prepareContractCall({
        contract,
        method: "function liquidate(address user, address token, address collateralToken)",
        params: [user, token, collateralToken],
      });
      sendTransaction(transaction, {
        onSuccess: (result) => resolve(result.transactionHash),
        onError: (error) => reject(error)
      });
    });
  };
};

export const useRepay = () => {
  const { mutate: sendTransaction } = useSendTransaction();
  
  return (contract: any, token: string, amount: bigint) => {
    return new Promise<string>((resolve, reject) => {
      const transaction = prepareContractCall({
        contract,
        method: "function repay(address token, uint256 amount)",
        params: [token, amount],
      });
      sendTransaction(transaction, {
        onSuccess: (result) => resolve(result.transactionHash),
        onError: (error) => reject(error)
      });
    });
  };
};

export const useSupply = () => {
  const { mutate: sendTransaction } = useSendTransaction();
  
  return (contract: any, token: string, amount: bigint, lockPeriod: bigint) => {
    return new Promise<string>((resolve, reject) => {
      const transaction = prepareContractCall({
        contract,
        method: "function supply(address token, uint256 amount, uint256 lockPeriod)",
        params: [token, amount, lockPeriod],
      });
      sendTransaction(transaction, {
        onSuccess: (result) => resolve(result.transactionHash),
        onError: (error) => reject(error)
      });
    });
  };
};

export const useWithdraw = () => {
  const { mutate: sendTransaction } = useSendTransaction();
  
  return (contract: any, token: string, amount: bigint) => {
    return new Promise<string>((resolve, reject) => {
      const transaction = prepareContractCall({
        contract,
        method: "function withdraw(address token, uint256 amount)",
        params: [token, amount],
      });
      sendTransaction(transaction, {
        onSuccess: (result) => resolve(result.transactionHash),
        onError: (error) => reject(error)
      });
    });
  };
};

// ================================= READ FUNCTIONS =================================

export const useInterestShareProtocol = (contract: any) => {
  return useReadContract({
    contract,
    method: "function INTEREST_SHARE_PROTOCOL() view returns (uint256)",
    params: [],
  });
};

export const useInterestShareProviders = (contract: any) => {
  return useReadContract({
    contract,
    method: "function INTEREST_SHARE_PROVIDERS() view returns (uint256)",
    params: [],
  });
};

export const useLiquidationFee = (contract: any) => {
  return useReadContract({
    contract,
    method: "function LIQUIDATION_FEE() view returns (uint256)",
    params: [],
  });
};

export const useLiquidationThreshold = (contract: any) => {
  return useReadContract({
    contract,
    method: "function LIQUIDATION_THRESHOLD() view returns (uint256)",
    params: [],
  });
};

export const useMaxLockPeriod = (contract: any) => {
  return useReadContract({
    contract,
    method: "function MAX_LOCK_PERIOD() view returns (uint256)",
    params: [],
  });
};

export const useMinLockPeriod = (contract: any) => {
  return useReadContract({
    contract,
    method: "function MIN_LOCK_PERIOD() view returns (uint256)",
    params: [],
  });
};

export const usePrecision = (contract: any) => {
  return useReadContract({
    contract,
    method: "function PRECISION() view returns (uint256)",
    params: [],
  });
};

export const useAccumulatedInterest = (contract: any, address: string) => {
  return useReadContract({
    contract,
    method: "function accumulatedInterest(address) view returns (uint256)",
    params: [address],
  });
};

export const useBorrowStartTime = (contract: any, user: string, token: string) => {
  return useReadContract({
    contract,
    method: "function borrowStartTime(address, address) view returns (uint256)",
    params: [user, token],
  });
};

export const useContractReserves = (contract: any, token: string, user: string) => {
  return useReadContract({
    contract,
    method: "function contractReserves(address, address) view returns (uint256)",
    params: [token, user],
  });
};

export const useDefaultLockPeriods = (contract: any, index: bigint) => {
  return useReadContract({
    contract,
    method: "function defaultLockPeriods(uint256) view returns (uint256)",
    params: [index],
  });
};

export const useDollarBackedTokens = (contract: any, index: bigint) => {
  return useReadContract({
    contract,
    method: "function dollarBackedTokens(uint256) view returns (address)",
    params: [index],
  });
};

export const useInterestRateParams = (contract: any, token: string) => {
  return useReadContract({
    contract,
    method: "function interestRateParams(address) view returns (uint256 optimalUtilization, uint256 baseRate, uint256 slope1, uint256 slope2)",
    params: [token],
  });
};

export const useIsBorrowingPaused = (contract: any, token: string) => {
  return useReadContract({
    contract,
    method: "function isBorrowingPaused(address) view returns (bool)",
    params: [token],
  });
};

export const useIsUndercollateralized = (contract: any, user: string, token: string, collateralToken: string) => {
  return useReadContract({
    contract,
    method: "function isUndercollateralized(address user, address token, address collateralToken) view returns (bool)",
    params: [user, token, collateralToken],
  });
};

export const useMaxBorrowPerToken = (contract: any, token: string) => {
  return useReadContract({
    contract,
    method: "function maxBorrowPerToken(address) view returns (uint256)",
    params: [token],
  });
};

export const useMinReserveThreshold = (contract: any, token: string) => {
  return useReadContract({
    contract,
    method: "function minReserveThreshold(address) view returns (uint256)",
    params: [token],
  });
};

export const useSupportedCollateral = (contract: any, index: bigint) => {
  return useReadContract({
    contract,
    method: "function supportedCollateral(uint256) view returns (address)",
    params: [index],
  });
};

export const useSupportedStablecoins = (contract: any, index: bigint) => {
  return useReadContract({
    contract,
    method: "function supportedStablecoins(uint256) view returns (address)",
    params: [index],
  });
};

export const useTotalBorrows = (contract: any, token: string) => {
  return useReadContract({
    contract,
    method: "function totalBorrows(address) view returns (uint256)",
    params: [token],
  });
};

export const useTotalSupply = (contract: any, token: string) => {
  return useReadContract({
    contract,
    method: "function totalSupply(address) view returns (uint256)",
    params: [token],
  });
};

export const useUserBorrows = (contract: any, user: string, token: string) => {
  return useReadContract({
    contract,
    method: "function userBorrows(address, address) view returns (uint256)",
    params: [user, token],
  });
};

export const useUserCollateral = (contract: any, user: string, token: string) => {
  return useReadContract({
    contract,
    method: "function userCollateral(address, address) view returns (uint256)",
    params: [user, token],
  });
};

export const useUserDeposits = (contract: any, user: string, token: string, index: bigint) => {
  return useReadContract({
    contract,
    method: "function userDeposits(address, address, uint256) view returns (uint256 amount, uint256 lockEnd)",
    params: [user, token, index],
  });
};

export const useGetUserBalance = (contract: any, user: string, token: string) => {
  return useReadContract({
    contract,
    method: "function getUserBalance(address user, address token) view returns (uint256)",
    params: [user, token],
  });
};

// ================================= CONTRACT EVENTS =================================

export const useBalanceUpdatedEvents = (contract: any) => {
  const preparedEvent = prepareEvent({
    signature: "event BalanceUpdated(address indexed user, address indexed token, uint256 balance, uint256 yield)",
  });

  return useContractEvents({
    contract,
    events: [preparedEvent],
  });
};

export const useBorrowCapUpdatedEvents = (contract: any) => {
  const preparedEvent = prepareEvent({
    signature: "event BorrowCapUpdated(address indexed token, uint256 oldCap, uint256 newCap)",
  });

  return useContractEvents({
    contract,
    events: [preparedEvent],
  });
};

export const useBorrowedEvents = (contract: any) => {
  const preparedEvent = prepareEvent({
    signature: "event Borrowed(address indexed user, address indexed token, uint256 amount, uint256 collateralUsed)",
  });

  return useContractEvents({
    contract,
    events: [preparedEvent],
  });
};

export const useBorrowingPausedEvents = (contract: any) => {
  const preparedEvent = prepareEvent({
    signature: "event BorrowingPaused(address indexed token, bool paused)",
  });

  return useContractEvents({
    contract,
    events: [preparedEvent],
  });
};

export const useCollateralDepositedEvents = (contract: any) => {
  const preparedEvent = prepareEvent({
    signature: "event CollateralDeposited(address indexed user, address indexed token, uint256 amount)",
  });

  return useContractEvents({
    contract,
    events: [preparedEvent],
  });
};

export const useCollateralWithdrawnEvents = (contract: any) => {
  const preparedEvent = prepareEvent({
    signature: "event CollateralWithdrawn(address indexed user, address indexed token, uint256 amount)",
  });

  return useContractEvents({
    contract,
    events: [preparedEvent],
  });
};

export const useLiquidatedEvents = (contract: any) => {
  const preparedEvent = prepareEvent({
    signature: "event Liquidated(address indexed user, address indexed token, uint256 debtAmount, uint256 collateralSeized, address collateralToken)",
  });

  return useContractEvents({
    contract,
    events: [preparedEvent],
  });
};

export const useRepaidEvents = (contract: any) => {
  const preparedEvent = prepareEvent({
    signature: "event Repaid(address indexed user, address indexed token, uint256 principal, uint256 interest)",
  });

  return useContractEvents({
    contract,
    events: [preparedEvent],
  });
};

export const useReserveThresholdUpdatedEvents = (contract: any) => {
  const preparedEvent = prepareEvent({
    signature: "event ReserveThresholdUpdated(address indexed token, uint256 oldThreshold, uint256 newThreshold)",
  });

  return useContractEvents({
    contract,
    events: [preparedEvent],
  });
};

export const useSuppliedEvents = (contract: any) => {
  const preparedEvent = prepareEvent({
    signature: "event Supplied(address indexed user, address indexed token, uint256 amount, uint256 lockPeriod)",
  });

  return useContractEvents({
    contract,
    events: [preparedEvent],
  });
};

export const useWithdrawnEvents = (contract: any) => {
  const preparedEvent = prepareEvent({
    signature: "event Withdrawn(address indexed user, address indexed token, uint256 amount, uint256 interest)",
  });

  return useContractEvents({
    contract,
    events: [preparedEvent],
  });
};