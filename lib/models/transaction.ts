export interface Transaction {
  id: string;
  transaction_code: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  amount: string;
  phone_number: string;
  receipt_number?: string;
  created_at: Date;
  updated_at: Date;
  user_id?: string;
}