import { oracleService } from '../services/oracleService';

export interface TransactionOptions {
  requireOracleValidation?: boolean;
  tokens?: string[];
  onOracleError?: (error: string) => void;
}

export async function executeWithOracleValidation<T>(
  transactionFn: () => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const { 
    requireOracleValidation = true, 
    tokens = [], 
    onOracleError 
  } = options;

  if (requireOracleValidation && tokens.length > 0) {
    try {
      const isValid = await oracleService.validateMultipleTokens(tokens);
      if (!isValid) {
        const errorMsg = "Oracle price validation failed. Market prices may be stale or unavailable.";
        if (onOracleError) {
          onOracleError(errorMsg);
        }
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMsg = `Oracle validation error: ${error instanceof Error ? error.message : "Unknown error"}`;
      if (onOracleError) {
        onOracleError(errorMsg);
      }
      throw new Error(errorMsg);
    }
  }

  return transactionFn();
}

export function createOracleAwareTransaction<T extends any[], R>(
  transactionFn: (...args: T) => Promise<R>,
  getTokensFromArgs: (args: T) => string[]
) {
  return async (...args: T): Promise<R> => {
    const tokens = getTokensFromArgs(args);
    return executeWithOracleValidation(
      () => transactionFn(...args),
      { tokens }
    );
  };
}

// Ensure this file is treated as a module
export {};
