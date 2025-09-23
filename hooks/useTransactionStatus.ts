import { useState, useEffect } from 'react'
import { eventService } from '@/lib/services/eventService'

export function useTransactionStatus(transactionCode?: string) {
  const [status, setStatus] = useState<'PENDING' | 'SUCCESS' | 'FAILED'>('PENDING')
  const [receipt, setReceipt] = useState<string>()

  useEffect(() => {
    if (!transactionCode) return undefined

    const unsubscribe = eventService.subscribe('transaction_update', (data) => {
      if (data.transaction_code === transactionCode) {
        setStatus(data.status)
        if (data.receipt_number) setReceipt(data.receipt_number)
      }
    })

    return unsubscribe
  }, [transactionCode])

  return { status, receipt }
}