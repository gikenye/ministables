import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { eventService } from '@/lib/services/eventService'

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
    
    console.log('Onramp callback received:', body)
    console.log('Content-Type:', contentType)
    
    const { 
      transaction_code,
      status,
      amount,
      phone_number,
      mobile_network,
      currency_code,
      asset,
      chain,
      address,
      message,
      receipt_number,
      error_message
    } = body
    
    // Store in database with onramp-specific fields
    const db = await getDatabase()
    
    // Create a unique identifier for the transaction
    const transactionKey = transaction_code || `onramp_${phone_number}_${amount}_${Date.now()}`
    
    await db.collection('onramp_transactions').updateOne(
      { transaction_key: transactionKey },
      {
        $set: {
          transaction_code,
          status: status?.toUpperCase() || 'PENDING',
          amount,
          phone_number,
          mobile_network,
          currency_code,
          asset,
          chain,
          address,
          message,
          receipt_number,
          error_message,
          failure_reason: status?.toUpperCase() === 'FAILED' ? (error_message || message) : null,
          updated_at: new Date(),
          callback_received_at: new Date(),
          type: 'ONRAMP'
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
            phone_number,
            mobile_network,
            currency_code,
            asset,
            chain,
            address,
            message,
            error_message,
            failure_reason: status?.toUpperCase() === 'FAILED' ? (error_message || message) : null,
            updated_at: new Date(),
            transaction_type: 'ONRAMP'
          },
          $setOnInsert: {
            created_at: new Date()
          }
        },
        { upsert: true }
      )
    }
    
    // Emit real-time event for onramp transactions
    eventService.emit('onramp_transaction_update', {
      transaction_key: transactionKey,
      transaction_code,
      status: status?.toUpperCase() || 'PENDING',
      amount,
      phone_number,
      mobile_network,
      currency_code,
      asset,
      chain,
      address
    })
    
    // Send appropriate notifications based on status
    if (status?.toLowerCase() === 'completed' || status?.toLowerCase() === 'success') {
      eventService.emit('notification', {
        type: 'success',
        message: `${asset} onramp successful! ${amount} ${currency_code} converted to ${asset}`,
        transaction_code,
        address,
        asset
      })
      
      // If onramp is successful, the USDC should be sent to user's address
      // The webhook will detect this and handle completion
      
    } else if (status?.toLowerCase() === 'failed' || status?.toLowerCase() === 'error') {
      eventService.emit('notification', {
        type: 'error',
        message: `${asset} onramp failed. ${error_message || message || 'Please try again.'}`,
        transaction_code,
        failure_reason: error_message || message
      })
    } else if (status?.toLowerCase() === 'pending') {
      eventService.emit('notification', {
        type: 'info',
        message: `${asset} onramp pending. Complete payment on your phone.`,
        transaction_code
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Onramp callback processed successfully',
      transaction_key: transactionKey
    })
    
  } catch (error) {
    console.error('Onramp callback error:', error)
    return NextResponse.json({ 
      error: 'Invalid callback', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 })
  }
}

// Optional: Handle GET requests for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Onramp callback endpoint is active',
    endpoint: '/api/onramp/callback',
    method: 'POST',
    expectedFields: [
      'transaction_code',
      'status',
      'amount',
      'phone_number',
      'mobile_network',
      'currency_code',
      'asset',
      'chain',
      'address',
      'message',
      'receipt_number',
      'error_message'
    ]
  })
}