import {
  reportError,
  reportInfo,
  reportWarning,
} from "@/lib/services/errorReportingService";

interface LogContext {
  component?: string;
  operation?: string;
  userId?: string;
  chainId?: number;
  transactionHash?: string;
  tokenSymbol?: string;
  amount?: string;
  additional?: Record<string, unknown>;
}

function toContext(context?: LogContext) {
  if (!context) return undefined;
  return {
    component: context.component,
    operation: context.operation,
    userId: context.userId,
    chainId: context.chainId,
    transactionHash: context.transactionHash,
    tokenSymbol: context.tokenSymbol,
    amount: context.amount,
    additional: context.additional,
  };
}

export const logger = {
  info(message: string, context?: LogContext) {
    reportInfo(message, toContext(context));
  },
  warn(message: string, context?: LogContext) {
    reportWarning(message, toContext(context));
  },
  error(error: Error | string, context?: LogContext) {
    reportError(error, toContext(context));
  },
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== "production") {
      reportInfo(message, toContext(context));
    }
  },
};
