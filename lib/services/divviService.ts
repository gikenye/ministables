import { getReferralTag, submitReferral } from '@divvi/referral-sdk'
import { PreparedTransaction } from 'thirdweb'

const DIVVI_CONSUMER_ADDRESS = '0xc022BD0b6005Cae66a468f9a20897aDecDE04e95' as const

export function generateDivviReferralTag(userAddress: string): string {
  if (!userAddress) return ''
  
  try {
    const tag = getReferralTag({
      user: userAddress as `0x${string}`,
      consumer: DIVVI_CONSUMER_ADDRESS,
    })
    return tag.startsWith('0x') ? tag.slice(2) : tag
  } catch (error) {
    console.log('[DivviService] Tag generation skipped:', error)
    return ''
  }
}

export function appendDivviReferralTag(
  transaction: PreparedTransaction, 
  userAddress: string
): PreparedTransaction {
  const referralTag = generateDivviReferralTag(userAddress)
  if (!referralTag || !transaction.data) return transaction

  return {
    ...transaction,
    data: (transaction.data + referralTag) as `0x${string}`
  }
}

export async function reportTransactionToDivvi(txHash: string, chainId: number): Promise<void> {
  if (!txHash) return
  
  try {
    await submitReferral({
      txHash: txHash as `0x${string}`,
      chainId,
    })
    console.log('[DivviService] Referral submitted:', txHash)
  } catch (error) {
    console.log('[DivviService] Submission failed (non-critical):', error)
  }
}