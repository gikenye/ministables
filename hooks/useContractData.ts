import { useReadContract } from "thirdweb/react";

export function useUserCollateral(contract: any, userAddress: string, tokenAddress: string) {
  return useReadContract({
    contract,
    method: "function userCollateral(address, address) view returns (uint256)",
    params: [userAddress, tokenAddress],
  });
}

export function useUserBorrows(contract: any, userAddress: string, tokenAddress: string) {
  return useReadContract({
    contract,
    method: "function userBorrows(address, address) view returns (uint256)",
    params: [userAddress, tokenAddress],
  });
}

export function useTotalSupply(contract: any, tokenAddress: string) {
  return useReadContract({
    contract,
    method: "function totalSupply(address) view returns (uint256)",
    params: [tokenAddress],
  });
}

export function useUserBalance(contract: any, userAddress: string, tokenAddress: string) {
  return useReadContract({
    contract,
    method: "function getUserBalance(address user, address token) returns (uint256)",
    params: [userAddress, tokenAddress],
  });
}

export function useUserDeposits(contract: any, userAddress: string, tokenAddress: string, index: number = 0) {
  return useReadContract({
    contract,
    method: "function userDeposits(address, address, uint256) view returns (uint256 amount, uint256 lockEnd)",
    params: [userAddress, tokenAddress, BigInt(index)],
  });
}