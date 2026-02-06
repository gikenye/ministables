import { ObjectId } from 'mongodb';

export interface OnrampDeposit {
  _id?: ObjectId;
  userAddress: string;
  vaultAddress: string;
  asset: string;
  amount: string;
  transactionCode: string;
  targetGoalId?: string;
  source?: string;
  chain?: string;
  chainId?: number;
  txHash?: string;
  phoneNumber: string;
  mobileNetwork: string;
  countryCode: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'AWAITING_AMOUNT' | 'AWAITING_TX_HASH';
  lastRetryAttemptAt?: Date;
  failureReason?: string;
  receiptNumber?: string;
  amountInUsd?: string;
  provider?: {
    name?: string;
    initiateResponse?: unknown;
    lastStatusPayload?: unknown;
    lastWebhookPayload?: unknown;
    lastStatusAt?: Date;
    lastWebhookAt?: Date;
    statusHistory?: Array<{ receivedAt: Date; payload: unknown }>;
    webhookHistory?: Array<{ receivedAt: Date; payload: unknown }>;
  };
  allocation?: {
    success: boolean;
    status?: 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';
    startedAt?: Date;
    depositId?: string;
    shares?: string;
    allocationTxHash?: string;
    onrampTxHash?: string;
    duration?: string;
    error?: string;
    response?: unknown;
    responseStatus?: number;
    request?: unknown;
    lastAttemptAt?: Date;
    attempts?: Array<{
      status: 'SUCCESS' | 'FAILED';
      source: 'poller' | 'webhook' | 'retry';
      attemptedAt: Date;
      request: unknown;
      response?: unknown;
      responseStatus?: number;
      error?: string;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}
