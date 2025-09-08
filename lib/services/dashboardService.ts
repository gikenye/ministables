"use client";

import { readContract } from "thirdweb";

/**
 * Fetch user balance for a specific token
 */
export async function fetchUserBalance(
  contract,
  userAddress: string,
  tokenAddress: string,
) {
  try {
    return await readContract({
      contract,
      method: "function getUserBalance(address user, address token) view returns (uint256)",
      params: [userAddress, tokenAddress],
    });
  } catch (error) {
    console.error("Error fetching user balance:", error);
    return BigInt(0);
  }
}

/**
 * Fetch accumulated interest for a user
 */
export async function fetchAccumulatedInterest(
  contract,
  userAddress: string
) {
  try {
    return await readContract({
      contract,
      method: "function accumulatedInterest(address) view returns (uint256)",
      params: [userAddress],
    });
  } catch (error) {
    console.error("Error fetching accumulated interest:", error);
    return BigInt(0);
  }
}

/**
 * Fetch borrow start time for a user and token
 */
export async function fetchBorrowStartTime(
  contract,
  userAddress: string,
  tokenAddress: string,
) {
  try {
    return await readContract({
      contract,
      method: "function borrowStartTime(address,address) view returns (uint256)",
      params: [userAddress, tokenAddress],
    });
  } catch (error) {
    console.error("Error fetching borrow start time:", error);
    return BigInt(0);
  }
}

/**
 * Fetch contract reserves
 */
export async function fetchContractReserves(
  contract,
  tokenAddress: string,
  userAddress: string,
) {
  try {
    return await readContract({
      contract,
      method: "function contractReserves(address,address) view returns (uint256)",
      params: [tokenAddress, userAddress],
    });
  } catch (error) {
    console.error("Error fetching contract reserves:", error);
    return BigInt(0);
  }
}

/**
 * Fetch user deposit info
 */
export async function fetchUserDeposit(
  contract,
  userAddress: string,
  tokenAddress: string,
  depositIndex: bigint,
) {
  try {
    return await readContract({
      contract,
      method: "function userDeposits(address,address,uint256) view returns (uint256,uint256)",
      params: [userAddress, tokenAddress, depositIndex],
    });
  } catch (error) {
    console.error("Error fetching user deposit:", error);
    return [BigInt(0), BigInt(0)];
  }
}

/**
 * Fetch default lock period
 */
export async function fetchDefaultLockPeriod(
  contract,
  index: bigint
) {
  try {
    return await readContract({
      contract,
      method: "function defaultLockPeriods(uint256) view returns (uint256)",
      params: [index],
    });
  } catch (error) {
    console.error("Error fetching default lock period:", error);
    return BigInt(0);
  }
}

/**
 * Fetch user borrow amount for a token
 */
export async function fetchUserBorrow(
  contract,
  userAddress: string,
  tokenAddress: string,
) {
  try {
    return await readContract({
      contract,
      method: "function userBorrows(address,address) view returns (uint256)",
      params: [userAddress, tokenAddress],
    });
  } catch (error) {
    console.error("Error fetching user borrow:", error);
    return BigInt(0);
  }
}

/**
 * Fetch user collateral amount for a token
 */
export async function fetchUserCollateral(
  contract,
  userAddress: string,
  tokenAddress: string,
) {
  try {
    return await readContract({
      contract,
      method: "function userCollateral(address,address) view returns (uint256)",
      params: [userAddress, tokenAddress],
    });
  } catch (error) {
    console.error("Error fetching user collateral:", error);
    return BigInt(0);
  }
}

/**
 * Fetch total supply for a token
 */
export async function fetchTotalSupply(
  contract,
  tokenAddress: string
) {
  try {
    return await readContract({
      contract,
      method: "function totalSupply(address) view returns (uint256)",
      params: [tokenAddress],
    });
  } catch (error) {
    console.error("Error fetching total supply:", error);
    return BigInt(0);
  }
}