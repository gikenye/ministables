import { ObjectId } from 'mongodb';

export interface OnrampDeposit {
  _id?: ObjectId;
  userAddress: string;
  vaultAddress: string;
  asset: string;
  amount: string;
  transactionCode: string;
  txHash?: string;
  phoneNumber: string;
  mobileNetwork: string;
  countryCode: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  receiptNumber?: string;
  amountInUsd?: string;
  allocation?: {
    success: boolean;
    depositId?: string;
    shares?: string;
    allocationTxHash?: string;
    onrampTxHash?: string;
    duration?: string;
    error?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
