import { getContract } from 'thirdweb';
import { getContractEvents } from 'thirdweb';
import { client } from '@/lib/thirdweb/client';
import { scroll } from 'thirdweb/chains';
import { getTokenInfo, getTokensBySymbol } from '@/config/chainConfig';
import { getDatabase } from '@/lib/mongodb';
import { eventService } from './eventService';

// Constants from environment
const SETTLEMENT_ADDRESS = process.env.USDC_SETTLEMENT_ADDRESS?.toLowerCase();
const POLL_INTERVAL = 15000; // 15 seconds

if (!SETTLEMENT_ADDRESS) {
  throw new Error('USDC_SETTLEMENT_ADDRESS environment variable is required');
}

// Get USDC info from your chain config
const scrollTokens = getTokensBySymbol(scroll.id);
const USDC_TOKEN = scrollTokens.USDC;
if (!USDC_TOKEN) {
  throw new Error('USDC token not found in Scroll chain configuration');
}
const USDC_ADDRESS = USDC_TOKEN.address;

interface TransferEvent {
  from: string;
  to: string;
  value: bigint;
}

interface ProcessedTransfer {
  transaction_hash: string;
  from_address: string;
  to_address: string;
  amount_usdc: number;
  amount_raw: string;
  block_number: number;
  timestamp: Date;
  processed: boolean;
  processing_error?: string;
}

class USDCEventListener {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastProcessedBlock = 0;
  private contract: any;

  constructor() {
    // Use your existing thirdweb client configuration
    this.contract = getContract({
      client,
      chain: scroll,
      address: USDC_ADDRESS,
    });
  }

  async start() {
    if (this.isRunning) {
      console.log('USDC Event Listener is already running');
      return;
    }

    console.log('Starting USDC Event Listener...');
    this.isRunning = true;

    // Initialize last processed block from database
    await this.initializeLastProcessedBlock();

    // Start polling
    this.intervalId = setInterval(async () => {
      try {
        await this.pollForEvents();
      } catch (error) {
        console.error('Error polling for USDC events:', error);
        // Emit error event
        eventService.emit('usdc_listener_error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }
    }, POLL_INTERVAL);

    console.log(`USDC Event Listener started. Polling every ${POLL_INTERVAL / 1000} seconds`);
  }

  async stop() {
    if (!this.isRunning) {
      console.log('USDC Event Listener is not running');
      return;
    }

    console.log('Stopping USDC Event Listener...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('USDC Event Listener stopped');
  }

  private async initializeLastProcessedBlock() {
    try {
      const db = await getDatabase();
      const lastEvent = await db.collection('usdc_transfers')
        .findOne({}, { sort: { block_number: -1 } });
      
      if (lastEvent) {
        this.lastProcessedBlock = lastEvent.block_number;
        console.log(`Resuming from block ${this.lastProcessedBlock}`);
      }
    } catch (error) {
      console.error('Error initializing last processed block:', error);
    }
  }

  private async pollForEvents() {
    try {
      // Get recent transfer events using thirdweb's getContractEvents
      const events = await getContractEvents({
        contract: this.contract,
        fromBlock: this.lastProcessedBlock > 0 ? BigInt(this.lastProcessedBlock + 1) : undefined,
        toBlock: 'latest',
      });

      // Filter for Transfer events to our settlement address
      const transferEvents = events.filter(event => {
        if (event.eventName !== 'Transfer') return false;
        
        // Handle different event arg structures
        const args = event.args as any;
        const toAddress = args?.to || args?.[1]; // args[1] is typically the 'to' parameter in Transfer events
        return toAddress?.toLowerCase() === SETTLEMENT_ADDRESS;
      });

      console.log(`Found ${transferEvents.length} Transfer events to settlement address`);

      for (const event of transferEvents) {
        await this.processTransferEvent(event);
      }

    } catch (error) {
      console.error('Error fetching contract events:', error);
      throw error;
    }
  }

  private async processTransferEvent(event: any) {
    try {
      const { args, transactionHash, blockNumber } = event;
      
      // Extract transfer details from event args (handle different formats)
      const fromAddress = args?.from || args?.[0];
      const toAddress = args?.to || args?.[1];
      const value = args?.value || args?.[2];

      // Double-check this is to our settlement address
      if (toAddress?.toLowerCase() !== SETTLEMENT_ADDRESS) {
        return; // Skip if not to our settlement address
      }

      const amountRaw = value.toString();
      const amountUSDC = Number(value) / Math.pow(10, USDC_TOKEN.decimals); // Use decimals from config

      console.log(`USDC deposit detected:`, {
        from: fromAddress,
        to: toAddress,
        amount: amountUSDC,
        txHash: transactionHash,
        block: blockNumber
      });

      // Store in database
      const db = await getDatabase();
      const transferData: ProcessedTransfer = {
        transaction_hash: transactionHash,
        from_address: fromAddress.toLowerCase(),
        to_address: toAddress.toLowerCase(),
        amount_usdc: amountUSDC,
        amount_raw: amountRaw,
        block_number: Number(blockNumber),
        timestamp: new Date(),
        processed: false
      };

      // Upsert to avoid duplicates
      await db.collection('usdc_transfers').updateOne(
        { transaction_hash: transactionHash },
        {
          $set: transferData,
          $setOnInsert: { created_at: new Date() }
        },
        { upsert: true }
      );

      // Update last processed block
      this.lastProcessedBlock = Math.max(this.lastProcessedBlock, Number(blockNumber));

      // Emit event for real-time updates
      eventService.emit('usdc_deposit_detected', {
        transaction_hash: transactionHash,
        from_address: fromAddress,
        amount_usdc: amountUSDC,
        amount_raw: amountRaw,
        block_number: Number(blockNumber)
      });

      // Trigger KES disbursement processing
      await this.triggerDisbursement(transferData);

    } catch (error) {
      console.error('Error processing transfer event:', error);
      
      // Update database with processing error if we have the transaction hash
      if (event.transactionHash) {
        try {
          const db = await getDatabase();
          await db.collection('usdc_transfers').updateOne(
            { transaction_hash: event.transactionHash },
            {
              $set: {
                processing_error: error instanceof Error ? error.message : 'Unknown error',
                updated_at: new Date()
              }
            }
          );
        } catch (dbError) {
          console.error('Error updating database with processing error:', dbError);
        }
      }
    }
  }

  private async triggerDisbursement(transfer: ProcessedTransfer) {
    try {
      // Look up recipient mapping for the sender address
      const db = await getDatabase();
      const mapping = await db.collection('recipient_mappings').findOne({
        usdc_sender_address: transfer.from_address,
        active: true
      });

      if (!mapping) {
        throw new Error(`No active recipient mapping found for address: ${transfer.from_address}`);
      }

      // Check amount limits if configured
      if (mapping.min_amount && transfer.amount_usdc < mapping.min_amount) {
        throw new Error(`Amount ${transfer.amount_usdc} is below minimum ${mapping.min_amount} USDC`);
      }

      if (mapping.max_amount && transfer.amount_usdc > mapping.max_amount) {
        throw new Error(`Amount ${transfer.amount_usdc} exceeds maximum ${mapping.max_amount} USDC`);
      }

      // Calculate KES amount (you may want to implement dynamic exchange rates)
      const usdcToKesRate = mapping.conversion_rate || 130; // Default rate, should be fetched from an API
      const kesAmount = Math.floor(transfer.amount_usdc * usdcToKesRate);

      const disbursementPayload = {
        amount: kesAmount.toString(),
        shortcode: mapping.shortcode || "600000",
        account_number: mapping.type === 'MOBILE' ? mapping.recipient_phone : (mapping.account_number || mapping.recipient_phone),
        type: mapping.type,
        mobile_network: mapping.recipient_network,
        callback_url: `${process.env.NEXTAUTH_URL}/api/pretium/callback/kes/log-disburse`
      };

      console.log('Triggering KES disbursement for USDC deposit:', {
        usdc_tx: transfer.transaction_hash,
        disbursement: disbursementPayload
      });

      // Call the disbursement API
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/pretium/kes/disburse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(disbursementPayload),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('Disbursement triggered successfully:', result);
        
        // Update database to mark as processed
        const db = await getDatabase();
        await db.collection('usdc_transfers').updateOne(
          { transaction_hash: transfer.transaction_hash },
          {
            $set: {
              processed: true,
              disbursement_transaction_code: result.data?.transaction_code,
              disbursement_triggered_at: new Date(),
              updated_at: new Date()
            }
          }
        );

        // Emit success event
        eventService.emit('usdc_disbursement_triggered', {
          usdc_transaction: transfer.transaction_hash,
          disbursement_code: result.data?.transaction_code,
          amount_usdc: transfer.amount_usdc
        });

      } else {
        throw new Error(`Disbursement API error: ${result.message}`);
      }

    } catch (error) {
      console.error('Error triggering disbursement:', error);
      
      // Update database with disbursement error
      try {
        const db = await getDatabase();
        await db.collection('usdc_transfers').updateOne(
          { transaction_hash: transfer.transaction_hash },
          {
            $set: {
              processing_error: `Disbursement failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              updated_at: new Date()
            }
          }
        );
      } catch (dbError) {
        console.error('Error updating database with disbursement error:', dbError);
      }

      // Emit error event
      eventService.emit('usdc_disbursement_error', {
        usdc_transaction: transfer.transaction_hash,
        error: error instanceof Error ? error.message : 'Unknown error',
        amount_usdc: transfer.amount_usdc
      });
    }
  }

  // Manual method to process a specific transaction
  async processSpecificTransaction(txHash: string) {
    try {
      // This method can be used to manually process a specific transaction
      // if needed for debugging or recovery purposes
      console.log(`Manually processing transaction: ${txHash}`);
      
      // You would implement logic here to fetch and process a specific transaction
      // This is useful for handling missed events or manual processing
      
    } catch (error) {
      console.error('Error processing specific transaction:', error);
      throw error;
    }
  }

  // Get listener status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      contractAddress: USDC_ADDRESS,
      tokenSymbol: 'USDC',
      tokenDecimals: USDC_TOKEN.decimals,
      settlementAddress: SETTLEMENT_ADDRESS,
      pollInterval: POLL_INTERVAL,
      chain: scroll.name
    };
  }
}

// Export singleton instance
export const usdcEventListener = new USDCEventListener();