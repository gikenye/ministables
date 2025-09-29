import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/mongodb'
import { eventService } from '@/lib/services/eventService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transaction_code, status, amount, phone_number, receipt_number } = body
    
    if (transaction_code) {
      // Store in database
      const transactionsCollection = await getCollection('transactions')
      await transactionsCollection.updateOne(
        { transaction_code },
        {
          $set: {
            status: status?.toUpperCase(),
            amount,
            phone_number,
            receipt_number,
            updated_at: new Date()
          },
          $setOnInsert: {
            created_at: new Date()
          }
        },
        { upsert: true }
      )
      
      // Emit real-time event
      eventService.emit('transaction_update', {
        transaction_code,
        status: status?.toUpperCase(),
        receipt_number
      })
      
      // Send notification
      if (status === 'completed') {
        eventService.emit('notification', {
          type: 'success',
          message: `Money sent to ${phone_number}`,
          receipt: receipt_number
        })
      } else if (status === 'failed') {
        eventService.emit('notification', {
          type: 'error',
          message: 'Payment failed. Please try again.'
        })
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Pretium callback error:', error)
    return NextResponse.json({ error: 'Invalid callback' }, { status: 400 })
  }
}