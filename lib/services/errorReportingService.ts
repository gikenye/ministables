/**
 * Production-ready error reporting service
 * Handles logging and reporting of errors in production environment
 */

interface ErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  chainId?: number;
  transactionHash?: string;
  tokenSymbol?: string;
  amount?: string;
  additional?: Record<string, any>;
}

class ErrorReportingService {
  private isProduction = process.env.NODE_ENV === "production";

  /**
   * Report an error with context for production monitoring
   */
  reportError(error: Error | string, context?: ErrorContext) {
    const errorData = {
      message: typeof error === "string" ? error : error.message,
      stack: typeof error === "object" ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      context,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent:
        typeof window !== "undefined" ? window.navigator.userAgent : undefined,
    };

    if (this.isProduction) {
      this.sendToMonitoringService(errorData);
    } else {
      console.error("[ErrorReporting]", errorData);
    }
  }

  /**
   * Report a warning (non-critical issue)
   */
  reportWarning(message: string, context?: ErrorContext) {
    const warningData = {
      level: "warning",
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    if (this.isProduction) {
      this.sendToMonitoringService(warningData);
    } else {
      console.warn("[ErrorReporting]", warningData);
    }
  }

  /**
   * Report an info event for tracking
   */
  reportInfo(message: string, context?: ErrorContext) {
    const infoData = {
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    if (this.isProduction) {
      this.sendToMonitoringService(infoData);
    } else {
      console.info("[ErrorReporting]", infoData);
    }
  }

  private sendToMonitoringService(data: any) {
    try {
      if (data.level !== "info") {
        console.error("[Production Error]", data.message, data.context);
      }
    } catch (reportingError) {
      console.error("[Error Reporting Failed]", reportingError);
    }
  }

  /**
   * Wrap async functions with error reporting
   */
  wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context?: ErrorContext
  ) {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        this.reportError(error as Error, context);
        throw error;
      }
    };
  }
}

export const errorReporting = new ErrorReportingService();

// Convenience functions for common use cases
export const reportError = (error: Error | string, context?: ErrorContext) =>
  errorReporting.reportError(error, context);

export const reportWarning = (message: string, context?: ErrorContext) =>
  errorReporting.reportWarning(message, context);

export const reportInfo = (message: string, context?: ErrorContext) =>
  errorReporting.reportInfo(message, context);
