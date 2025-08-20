// Contract error code mappings - context-specific
export const CONTRACT_ERROR_CODES: Record<string, string> = {
  // Supply/Deposit function errors
  "supply_E1": "Amount must be greater than 0",
  "supply_E2": "Invalid lock period",
  "supply_E3": "Unsupported stablecoin",
  "supply_E4": "Insufficient token balance",
  "supply_E5": "Aave supply failed",
  
  // Generic fallbacks (initialization errors)
  "E1": "Invalid pool address provider",
  "E2": "Invalid oracle address", 
  "E3": "Invalid USDC address",
  "E4": "Transaction failed - please check your balance and try again",
  "E5": "No stablecoins provided",
  "E6": "No collateral provided", 
  "E7": "No dollar-backed tokens provided",
  "E8": "Invalid borrow caps",
  "E9": "Invalid reserve thresholds",
  "E10": "Invalid optimal utilizations",
  "E11": "Invalid base rates",
  "E12": "Invalid slope1s",
  "E13": "Invalid slope2s",
  
  // Withdrawal specific errors (from withdraw function)
  "withdraw_E1": "Amount must be greater than 0",
  "withdraw_E2": "Please repay all outstanding loans before withdrawing",
  "withdraw_E3": "Aave withdrawal failed",
  "withdraw_E4": "Insufficient unlocked deposits available for withdrawal",
  "withdraw_E5": "Insufficient contract reserves",
  "withdraw_E6": "Aave withdrawal failed",
};

// Common ERC20 and transaction errors
export const COMMON_ERROR_MESSAGES: Record<string, string> = {
  "ERC20: transfer amount exceeds allowance": "Insufficient token allowance. Please approve the contract to spend your tokens.",
  "ERC20: transfer amount exceeds balance": "Insufficient token balance.",
  "ERC20: insufficient allowance": "Insufficient token allowance. Please approve the contract to spend your tokens.",
  "Insufficient balance": "Insufficient token balance.",
  "execution reverted": "Transaction failed. Please check your inputs and try again.",
  "user rejected transaction": "Transaction was cancelled by user.",
  "insufficient funds": "Insufficient funds to complete the transaction.",
  "gas required exceeds allowance": "Transaction requires more gas than allowed.",
};

/**
 * Maps contract error codes and common errors to user-friendly messages
 */
export function mapErrorMessage(error: any): string {
  if (!error) return "Unknown error occurred";
  
  const errorMessage = error.message || error.reason || error.toString();
  
  // Check for withdrawal-specific error codes first
  const withdrawErrorMatch = errorMessage.match(/withdraw_E(\d+)/);
  if (withdrawErrorMatch) {
    const errorCode = withdrawErrorMatch[0];
    return CONTRACT_ERROR_CODES[errorCode] || `Withdrawal error: ${errorCode}`;
  }
  
  // Check for supply-specific error codes
  const supplyErrorMatch = errorMessage.match(/supply_E(\d+)/);
  if (supplyErrorMatch) {
    const errorCode = supplyErrorMatch[0];
    return CONTRACT_ERROR_CODES[errorCode] || `Supply error: ${errorCode}`;
  }
  
  // Special handling for E4 in supply context (most common case)
  if (errorMessage.includes("E4") && errorMessage.includes("execution reverted")) {
    return "Insufficient token balance";
  }
  
  // Check for general contract error codes (E1, E2, etc.)
  const errorCodeMatch = errorMessage.match(/E(\d+)/);
  if (errorCodeMatch) {
    const errorCode = errorCodeMatch[0];
    return CONTRACT_ERROR_CODES[errorCode] || `Contract error: ${errorCode}`;
  }
  
  // Check for common error messages
  for (const [errorPattern, userMessage] of Object.entries(COMMON_ERROR_MESSAGES)) {
    if (errorMessage.includes(errorPattern)) {
      return userMessage;
    }
  }
  
  // Return original message if no mapping found
  return errorMessage;
}

/**
 * Extracts and maps error from transaction error
 */
export function extractTransactionError(error: any): string {
  // Handle nested error structures
  if (error?.cause?.message) {
    return mapErrorMessage(error.cause);
  }
  
  if (error?.data?.message) {
    return mapErrorMessage(error.data);
  }
  
  const errorMessage = error?.message || error?.reason || error?.toString() || "";
  
  // Special handling for gas estimation failures that indicate insufficient balance
  if (errorMessage.includes("gas estimation failed") || errorMessage.includes("execution reverted")) {
    return "Insufficient token balance or invalid transaction parameters.";
  }
  
  return mapErrorMessage(error);
}