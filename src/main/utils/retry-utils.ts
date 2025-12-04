/**
 * Smart retry utility class
 * Implements exponential backoff retry strategy and error classification
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
}

export class RetryUtils {
  private static readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
      'ECONNREFUSED',
      'network timeout',
      'timeout',
      'connection timeout',
      'rate limit',
      'rate limited',
      'too many requests',
      'temporary failure',
      'temporary error',
      'service unavailable',
      'gateway timeout',
      'bad gateway',
      'nonce too low',
      'gas price too low',
      'underpriced'
    ],
    nonRetryableErrors: [
      'insufficient funds',
      'invalid address',
      'invalid signature',
      'unauthorized',
      'forbidden',
      'not found',
      'invalid contract',
      'contract execution reverted',
      'out of gas',
      'gas required exceeds allowance'
    ],
    onRetry: () => {}
  };

  /**
   * Execute async operation with retry
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: Error | undefined;
    let totalDelay = 0;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        return {
          success: true,
          result,
          attempts: attempt,
          totalDelay
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a non-retryable error
        if (this.isNonRetryableError(lastError, config)) {
          break;
        }

        // If it's the last attempt, don't retry anymore
        if (attempt === config.maxAttempts) {
          break;
        }

        // Calculate delay time
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        // Add random jitter to avoid thundering herd
        const jitter = delay * 0.1 * Math.random();
        const finalDelay = delay + jitter;

        totalDelay += finalDelay;

        // Call callback function
        try {
          config.onRetry(attempt, lastError, Math.round(finalDelay));
        } catch (callbackError) {
          console.warn('Retry callback failed:', callbackError);
        }

        // Wait and retry
        await this.sleep(finalDelay);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: config.maxAttempts,
      totalDelay
    };
  }

  /**
   * Batch operation retry
   */
  static async executeBatchWithRetry<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    options: RetryOptions = {}
  ): Promise<Array<{ item: T; result: RetryResult<R> }>> {
    const results: Array<{ item: T; result: RetryResult<R> }> = [];

    for (const item of items) {
      const result = await this.executeWithRetry(() => operation(item), options);
      results.push({ item, result });
    }

    return results;
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: Error, config: Required<RetryOptions>): boolean {
    const errorMessage = error.message.toLowerCase();

    // Check if it matches retryable errors
    return config.retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError.toLowerCase())
    );
  }

  /**
   * Check if error is non-retryable
   */
  private static isNonRetryableError(error: Error, config: Required<RetryOptions>): boolean {
    const errorMessage = error.message.toLowerCase();

    // Check if it matches non-retryable errors
    return config.nonRetryableErrors.some(nonRetryableError =>
      errorMessage.includes(nonRetryableError.toLowerCase())
    );
  }

  /**
   * Async sleep
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry configuration for blockchain operations
   */
  static readonly BLOCKCHAIN_RETRY_OPTIONS: RetryOptions = {
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 1.5,
    retryableErrors: [
      'network timeout',
      'timeout',
      'connection timeout',
      'rate limit',
      'rate limited',
      'too many requests',
      'temporary failure',
      'service unavailable',
      'gateway timeout',
      'bad gateway',
      'nonce too low',
      'gas price too low',
      'underpriced',
      'transaction underpriced'
    ],
    nonRetryableErrors: [
      'insufficient funds',
      'invalid address',
      'invalid signature',
      'unauthorized',
      'forbidden',
      'not found',
      'invalid contract',
      'contract execution reverted',
      'out of gas',
      'gas required exceeds allowance',
      'invalid recipient'
    ],
    onRetry: (attempt, error, delay) => {
      console.warn(`[Blockchain Retry] Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
    }
  };

  /**
   * Retry configuration for network requests
   */
  static readonly NETWORK_RETRY_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: [
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
      'ECONNREFUSED',
      'network timeout',
      'timeout',
      'connection timeout',
      'rate limit',
      'rate limited',
      'too many requests',
      'service unavailable',
      'gateway timeout',
      'bad gateway'
    ],
    nonRetryableErrors: [
      '404',
      '401',
      '403',
      '400',
      '405',
      '422'
    ],
    onRetry: (attempt, error, delay) => {
      console.warn(`[Network Retry] Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
    }
  };

  /**
   * Retry configuration for database operations
   */
  static readonly DATABASE_RETRY_OPTIONS: RetryOptions = {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    retryableErrors: [
      'database is locked',
      'busy',
      'timeout'
    ],
    nonRetryableErrors: [
      'no such table',
      'syntax error',
      'constraint failed',
      'foreign key constraint'
    ],
    onRetry: (attempt, error, delay) => {
      console.warn(`[Database Retry] Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
    }
  };
}