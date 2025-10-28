import { ObjectId } from "mongodb";

// Transaction types
export type TransactionType =
  | "deposit" // Adding money to a goal
  | "withdrawal" // Withdrawing money from a goal
  | "interest" // Interest earned
  | "transfer" // Transfer between goals
  | "contribution" // External contribution to a goal
  | "penalty" // Penalty for early withdrawal
  | "bonus" // Bonus rewards
  | "refund"; // Refunded transaction

// Transaction status
export type TransactionStatus =
  | "pending" // Transaction initiated but not confirmed
  | "confirmed" // Transaction confirmed on blockchain
  | "completed" // Transaction fully processed
  | "failed" // Transaction failed
  | "cancelled" // Transaction was cancelled
  | "reversed"; // Transaction was reversed

// Payment method for transactions
export type PaymentMethod =
  | "mpesa" // M-Pesa mobile money
  | "blockchain" // Direct blockchain transaction
  | "bank_transfer" // Bank transfer
  | "card" // Credit/debit card
  | "crypto"; // Cryptocurrency

// Define the savings transaction data structure
export interface SavingsTransaction {
  _id?: ObjectId;

  // Transaction identification
  transactionId: string; // Unique transaction identifier
  transactionHash?: string; // Blockchain transaction hash (if applicable)
  externalId?: string; // External payment system ID (e.g., M-Pesa transaction code)

  // User and goal information
  userId: string; // Wallet address of the user
  goalId?: string; // Goal ID (optional for general transactions)
  fromGoalId?: string; // Source goal for transfers
  toGoalId?: string; // Destination goal for transfers

  // Transaction details
  type: TransactionType;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;

  // Financial data
  amount: string; // Transaction amount in token units
  tokenAddress: string; // Token contract address
  tokenSymbol: string; // Token symbol (e.g., "USDC")
  tokenDecimals: number; // Token decimals
  fiatAmount?: string; // Equivalent fiat amount
  fiatCurrency?: string; // Fiat currency (e.g., "KES", "USD")
  exchangeRate?: string; // Exchange rate used

  // Fees and charges
  networkFee?: string; // Blockchain network fee
  platformFee?: string; // Platform fee
  paymentProviderFee?: string; // Payment provider fee (e.g., M-Pesa charges)
  totalFees?: string; // Total fees charged

  // Payment provider specific data
  paymentData?: {
    phoneNumber?: string; // For M-Pesa transactions
    receiptNumber?: string; // Payment receipt number
    businessNumber?: string; // Business number used
    accountNumber?: string; // Account number used
    bankDetails?: {
      // For bank transfers
      bankName: string;
      accountNumber: string;
      routingNumber?: string;
    };
  };

  // Interest calculation
  interestData?: {
    rate: number; // Interest rate applied
    periodDays: number; // Period in days for interest calculation
    calculatedAt: Date; // When interest was calculated
  };

  // Vault/Contract Integration (for blockchain-based transactions)
  contractData?: {
    vaultAddress?: string; // Vault contract address
    depositId?: number; // Vault deposit ID from contract
    lockTierId?: number; // Lock tier used (0, 1, 2, 3)
    lockPeriod?: number; // Lock period in seconds
    lockEnd?: Date; // When the lock period ends
    yieldBoostBps?: number; // Yield boost in basis points
    shares?: string; // Vault shares received/burned
    currentValue?: string; // Current value of deposit in vault
    pledgedAsCollateral?: boolean; // Whether deposit is pledged as collateral
    contractType?: string; // "SupplierVault", "BorrowerVault", etc.
    strategyAddress?: string; // Aave strategy address if applicable
    aaveDeployed?: string; // Amount deployed to Aave strategy
  };

  // Timeline
  initiatedAt: Date; // When transaction was initiated
  confirmedAt?: Date; // When transaction was confirmed
  completedAt?: Date; // When transaction was completed
  createdAt: Date; // Record creation time
  updatedAt: Date; // Record last update time

  // Additional data
  description?: string; // Optional transaction description
  metadata?: Record<string, any>; // Additional metadata

  // Error handling
  errorMessage?: string; // Error message if transaction failed
  retryCount?: number; // Number of retry attempts

  // Compliance and audit
  ipAddress?: string; // IP address of the user
  userAgent?: string; // User agent string
  complianceChecked?: boolean; // Whether compliance checks were performed
}

// Define a type for transaction updates
export type TransactionUpdate = Partial<
  Omit<SavingsTransaction, "_id" | "transactionId" | "userId" | "createdAt">
>;

// Define a type for creating a new transaction
export type NewSavingsTransaction = Omit<
  SavingsTransaction,
  "_id" | "createdAt" | "updatedAt"
>;

// Transaction summary for display
export interface TransactionSummary {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  tokenSymbol: string;
  fiatAmount?: string;
  fiatCurrency?: string;
  goalTitle?: string;
  paymentMethod: PaymentMethod;
  initiatedAt: Date;
  completedAt?: Date;
  description?: string;
}

// Transaction statistics
export interface TransactionStats {
  totalTransactions: number;
  totalDeposits: string;
  totalWithdrawals: string;
  totalInterestEarned: string;
  totalFeesPaid: string;
  averageTransactionAmount: string;
  transactionsByType: Record<TransactionType, number>;
  transactionsByStatus: Record<TransactionStatus, number>;
  transactionsByMethod: Record<PaymentMethod, number>;
}

// Batch transaction for multiple operations
export interface BatchTransaction {
  _id?: ObjectId;
  batchId: string; // Unique batch identifier
  userId: string; // User initiating the batch
  transactions: string[]; // Array of transaction IDs in this batch
  status: TransactionStatus;
  totalAmount: string; // Total amount for the batch
  createdAt: Date;
  completedAt?: Date;
  description?: string;
}

// Recurring transaction template
export interface RecurringTransaction {
  _id?: ObjectId;
  userId: string;
  goalId: string;

  // Template data
  amount: string;
  tokenAddress: string;
  tokenSymbol: string;
  paymentMethod: PaymentMethod;

  // Scheduling
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number; // E.g., every 2 weeks = frequency: 'weekly', interval: 2
  nextExecutionDate: Date;
  lastExecutionDate?: Date;

  // Control
  isActive: boolean;
  maxExecutions?: number; // Optional limit on executions
  executionCount: number;

  // Timeline
  createdAt: Date;
  updatedAt: Date;
  pausedAt?: Date;
  cancelledAt?: Date;
}
