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
    
    console.log('KES collect callback received:', body)
    console.log('Content-Type:', contentType)
    
    const { 
      shortcode, 
      amount, 
      mobile_network, 
      transaction_id,
      status,
      phone_number,
      receipt_number,
      transaction_code,
      reference,
      message,
      public_name
    } = body
    
    // Store in database with KES-specific fields
    const db = await getDatabase()
    
    // Create a unique identifier for the transaction
    const transactionKey = transaction_code || transaction_id || reference || `${shortcode}_${phone_number}_${amount}_${Date.now()}`
    
    await db.collection('kes_transactions').updateOne(
      { transaction_key: transactionKey },
      {
        $set: {
          shortcode,
          amount,
          mobile_network,
          phone_number,
          status: status?.toUpperCase() || 'PENDING',
          receipt_number,
          transaction_id,
          transaction_code,
          reference,
          message,
          public_name,
          failure_reason: status?.toUpperCase() === 'FAILED' ? message : null,
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
            phone_number,
            receipt_number,
            mobile_network,
            shortcode,
            message,
            public_name,
            failure_reason: status?.toUpperCase() === 'FAILED' ? message : null,
            updated_at: new Date(),
            type: 'KES_COLLECT'
          },
          $setOnInsert: {
            created_at: new Date()
          }
        },
        { upsert: true }
      )
    }
    
    // Emit real-time event for KES transactions
    eventService.emit('kes_transaction_update', {
      transaction_key: transactionKey,
      transaction_code,
      status: status?.toUpperCase() || 'PENDING',
      amount,
      phone_number,
      mobile_network,
      shortcode,
      receipt_number
    })
    
    // Send appropriate notifications based on status
    if (status?.toLowerCase() === 'completed' || status?.toLowerCase() === 'success') {
      eventService.emit('notification', {
        type: 'success',
        message: `KES ${amount} collected successfully from ${phone_number} via ${mobile_network}`,
        receipt: receipt_number,
        transaction_code
      })
    } else if (status?.toLowerCase() === 'failed' || status?.toLowerCase() === 'error') {
      eventService.emit('notification', {
        type: 'error',
        message: `KES collection failed for ${phone_number}. ${message || 'Please try again.'}`,
        transaction_code,
        failure_reason: message
      })
    } else if (status?.toLowerCase() === 'pending') {
      eventService.emit('notification', {
        type: 'info',
        message: `KES ${amount} collection pending for ${phone_number}`,
        transaction_code
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'KES collect callback processed successfully',
      transaction_key: transactionKey
    })
    
  } catch (error) {
    console.error('KES collect callback error:', error)
    return NextResponse.json({ 
      error: 'Invalid callback', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 })
  }
}

// Optional: Handle GET requests for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'KES collect callback endpoint is active',
    endpoint: '/api/pretium/kes/log-collect',
    method: 'POST',
    expectedFields: [
      'shortcode',
      'amount', 
      'mobile_network',
      'phone_number',
      'status',
      'transaction_id',
      'transaction_code',
      'receipt_number',
      'reference'
    ]
  })
}