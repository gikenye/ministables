"use client";

import { prepareContractCall, readContract } from "thirdweb";

/**
 * Fetch user balance for a specific token
 */
export async function fetchUserBalance(
  contract,
  userAddress: string,
  tokenAddress: string,
) {
  const tx = prepareContractCall({
    contract,
    method: "function getUserBalance(address user, address token)",
    params: [userAddress, tokenAddress],
  });
  return await readContract(tx);
}

/**
 * Fetch accumulated interest for a user
 */
export async function fetchAccumulatedInterest(
  contract,
  userAddress: string
) {
  const tx = prepareContractCall({
    contract,
    method: "function accumulatedInterest(address)",
    params: [userAddress],
  });
  return await readContract(tx);
}

/**
 * Fetch borrow start time for a user and token
 */
export async function fetchBorrowStartTime(
  contract,
  userAddress: string,
  tokenAddress: string,
) {
  const tx = prepareContractCall({
    contract,
    method: "function borrowStartTime(address,address)",
    params: [userAddress, tokenAddress],
  });
  return await readContract(tx);
}

/**
 * Fetch contract reserves
 */
export async function fetchContractReserves(
  contract,
  tokenAddress: string,
  userAddress: string,
) {
  const tx = prepareContractCall({
    contract,
    method: "function contractReserves(address,address)",
    params: [tokenAddress, userAddress],
  });
  return await readContract(tx);
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
  console.log(`fetchUserDeposit called for user ${userAddress}, token ${tokenAddress}`);
  try {
    const tx = prepareContractCall({
      contract,
      method: "function userDeposits(address,address,uint256)",
      params: [userAddress, tokenAddress, depositIndex],
    });
    console.log("fetchUserDeposit prepared transaction:", tx);
    const result = await readContract(tx);
    console.log(`fetchUserDeposit result:`, result);
    return result;
  } catch (error) {
    console.error(`Error in fetchUserDeposit for token ${tokenAddress}:`, error);
    throw error;
  }
}

/**
 * Fetch default lock period
 */
export async function fetchDefaultLockPeriod(
  contract,
  index: bigint
) {
  const tx = prepareContractCall({
    contract,
    method: "function defaultLockPeriods(uint256)",
    params: [index],
  });
  return await readContract(tx);
}

/**
 * Fetch user borrow amount for a token
 */
export async function fetchUserBorrow(
  contract,
  userAddress: string,
  tokenAddress: string,
) {
  const tx = prepareContractCall({
    contract,
    method: "function userBorrows(address,address)",
    params: [userAddress, tokenAddress],
  });
  return await readContract(tx);
}

/**
 * Fetch user collateral amount for a token
 */
export async function fetchUserCollateral(
  contract,
  userAddress: string,
  tokenAddress: string,
) {
  const tx = prepareContractCall({
    contract,
    method: "function userCollateral(address,address)",
    params: [userAddress, tokenAddress],
  });
  return await readContract(tx);
}

/**
 * Fetch total supply for a token
 */
export async function fetchTotalSupply(
  contract,
  tokenAddress: string
) {
  const tx = prepareContractCall({
    contract,
    method: "function totalSupply(address)",
    params: [tokenAddress],
  });
  return await readContract(tx);
}