import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
import { getDatabase } from '@/lib/mongodb'
import { eventService } from '@/lib/services/eventService'
import { ActivityIndexer } from '@/lib/backend/services/activity-indexer.service'
import { isValidAddress } from '@/lib/backend/utils'

export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    
    // Try to parse as JSON first, then fallback to form data or query params
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      try {
        body = await request.json()
      } catch (jsonError) {
        console.log('Failed to parse JSON, trying form data...')
        body = {}
      }
    }
    
    // If JSON parsing failed or content-type is form data
    if (Object.keys(body).length === 0) {
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData()
        body = Object.fromEntries(formData.entries())
      } else {
        // Fallback to query parameters
        const url = new URL(request.url)
        body = Object.fromEntries(url.searchParams.entries())
      }
    }
    
    console.log('KES disburse callback received:', body)
    console.log('Content-Type:', contentType)
    
    const { 
      amount,
      shortcode,
      account_number,
      type,
      mobile_network,
      transaction_code,
      transaction_id,
      status,
      message,
      receipt_number,
      phone_number,
      reference,
      error_message
    } = body
    
    // Store in database with KES disburse-specific fields
    const db = await getDatabase()
    
    // Create a unique identifier for the transaction
    const transactionKey = transaction_code || transaction_id || reference || `${shortcode}_${account_number}_${amount}_${Date.now()}`
    
    await db.collection('kes_disburse_transactions').updateOne(
      { transaction_key: transactionKey },
      {
        $set: {
          amount,
          shortcode,
          account_number,
          type, // MOBILE, BUY_GOODS, or PAYBILL
          mobile_network,
          phone_number,
          status: status?.toUpperCase() || 'PENDING',
          message,
          receipt_number,
          transaction_id,
          transaction_code,
          reference,
          error_message,
          failure_reason: status?.toUpperCase() === 'FAILED' ? (message || error_message) : null,
          updated_at: new Date(),
          callback_received_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      { upsert: true }
    )
    
    // Also update the main transactions collection if transaction_code exists
    if (transaction_code) {
      await db.collection('transactions').updateOne(
        { transaction_code },
        {
          $set: {
            status: status?.toUpperCase() || 'PENDING',
            amount,
            account_number,
            phone_number,
            receipt_number,
            mobile_network,
            shortcode,
            type,
            message,
            error_message,
            failure_reason: status?.toUpperCase() === 'FAILED' ? (message || error_message) : null,
            updated_at: new Date(),
            transaction_type: 'KES_DISBURSE'
          },
          $setOnInsert: {
            created_at: new Date()
          }
        },
        { upsert: true }
      )
    }
    
    // Emit real-time event for KES disbursement transactions
    eventService.emit('kes_disburse_update', {
      transaction_key: transactionKey,
      transaction_code,
      status: status?.toUpperCase() || 'PENDING',
      amount,
      account_number,
      phone_number,
      mobile_network,
      shortcode,
      type,
      receipt_number,
      message
    })
    
    // Send appropriate notifications based on status
    if (status?.toLowerCase() === 'completed' || status?.toLowerCase() === 'success') {
      const recipientInfo = type === 'MOBILE' ? phone_number : account_number
      eventService.emit('notification', {
        type: 'success',
        message: `KES ${amount} disbursed successfully to ${recipientInfo} via ${mobile_network} (${type})`,
        receipt: receipt_number,
        transaction_code
      })

      try {
        if (transaction_code) {
          const transfer = await db.collection('usdc_transfers').findOne({
            disbursement_transaction_code: transaction_code
          })
          const fromAddress = transfer?.from_address
          if (fromAddress && isValidAddress(fromAddress)) {
            await ActivityIndexer.recordActivity({
              userAddress: fromAddress,
              chain: "FIAT",
              type: "offramp_initiated",
              txHash: transaction_code,
              timestamp: new Date().toISOString(),
              data: {
                asset: "USDC",
                amount: transfer?.amount_usdc?.toString?.() ?? transfer?.amount_usdc,
                source: "offramp",
              },
            })
          }
        }
      } catch (activityError) {
        console.warn("Failed to record offramp activity", activityError)
      }
    } else if (status?.toLowerCase() === 'failed' || status?.toLowerCase() === 'error') {
      const recipientInfo = type === 'MOBILE' ? phone_number : account_number
      eventService.emit('notification', {
        type: 'error',
        message: `KES disbursement failed for ${recipientInfo}. ${error_message || message || 'Please try again.'}`,
        transaction_code
      })
    } else if (status?.toLowerCase() === 'pending') {
      const recipientInfo = type === 'MOBILE' ? phone_number : account_number
      eventService.emit('notification', {
        type: 'info',
        message: `KES ${amount} disbursement pending for ${recipientInfo} (${type})`,
        transaction_code
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'KES disburse callback processed successfully',
      transaction_key: transactionKey,
      status: status?.toUpperCase() || 'PENDING'
    })
    
  } catch (error) {
    console.error('KES disburse callback error:', error)
    return NextResponse.json({ 
      error: 'Invalid callback', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 })
  }
}

// Optional: Handle GET requests for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'KES disburse callback endpoint is active',
    endpoint: '/api/pretium/kes/log-disburse',
    method: 'POST',
    expectedFields: [
      'amount',
      'shortcode',
      'account_number',
      'type', // MOBILE, BUY_GOODS, or PAYBILL
      'mobile_network',
      'transaction_code',
      'status',
      'message',
      'receipt_number',
      'phone_number',
      'reference',
      'error_message'
    ],
    supportedTypes: ['MOBILE', 'BUY_GOODS', 'PAYBILL']
  })
}
