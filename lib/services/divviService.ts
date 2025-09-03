import { getReferralTag, submitReferral } from '@divvi/referral-sdk'
import { PreparedTransaction } from 'thirdweb'

// Divvi consumer address provided by the user
const DIVVI_CONSUMER_ADDRESS = '0x76E195168791800Ea73F9eae388690868bd0e54d' as const

/**
 * Generates a Divvi referral tag for the current user
 * @param userAddress - The address of the user making the transaction
 * @returns The referral tag to append to transaction data
 */
export function generateDivviReferralTag(userAddress: string): string {
  if (!userAddress) return ''
  
  return getReferralTag({
    user: userAddress as `0x${string}`,
    consumer: DIVVI_CONSUMER_ADDRESS,
  })
}

/**
 * Appends a Divvi referral tag to a transaction
 * @param transaction - The prepared transaction to modify
 * @param userAddress - The address of the user making the transaction
 * @returns The modified transaction with referral data appended
 */
export function appendDivviReferralTag(
  transaction: PreparedTransaction, 
  userAddress: string
): PreparedTransaction {
  // Generate the referral tag
  const referralTag = generateDivviReferralTag(userAddress)
  if (!referralTag || !transaction.data) return transaction

  // Create a new transaction object with modified data
  // Make sure the original transaction data is preserved correctly
  // We shouldn't modify the data directly as it may corrupt the transaction format
  
  // Instead, attach the referral tag as metadata so we know it needs to be submitted separately
  const modifiedTransaction = {
    ...transaction,
    // Store the referral tag as metadata rather than modifying the transaction data
    divviReferralTag: referralTag
  }

  console.log('[DivviService] Referral tag saved as transaction metadata')
  return modifiedTransaction as PreparedTransaction
}

/**
 * Reports a transaction to Divvi for referral tracking
 * @param txHash - The transaction hash
 * @param chainId - The chain ID where the transaction was executed
 */
export async function reportTransactionToDivvi(txHash: string, chainId: number): Promise<void> {
  if (!txHash) return
  
  try {
    await submitReferral({
      txHash: txHash as `0x${string}`,
      chainId,
    })
    console.log('[DivviService] Transaction reported successfully:', txHash)
  } catch (error) {
    console.error('[DivviService] Error reporting transaction:', error)
  }
}