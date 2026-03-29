/**
 * Retry Utility with Exponential Backoff
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
  onRetry: () => {},
};

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (!isRetryableError(error, opts.retryableErrors)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === opts.maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      );

      // Call retry callback
      opts.onRetry(lastError, attempt);

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Check if an error should trigger a retry
 */
function isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  if (!error) return false;

  const err = error as any;

  // Network errors
  if (err.code && retryableErrors.includes(err.code)) {
    return true;
  }

  // HTTP 429 (Rate Limit)
  if (err.status === 429 || err.statusCode === 429) {
    return true;
  }

  // HTTP 5xx (Server Errors)
  if (err.status >= 500 || err.statusCode >= 500) {
    return true;
  }

  // Timeout errors
  if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
    return true;
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with specific handling for HTTP 429 (Rate Limit)
 */
export async function retryWithRateLimit<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retry(fn, {
    ...options,
    onRetry: (error: any, attempt) => {
      // Log retry attempt
      console.warn(`Retry attempt ${attempt} after error:`, error.message);

      // Call user's onRetry if provided
      if (options.onRetry) {
        options.onRetry(error, attempt);
      }
    },
  });
}

/**
 * Batch retry - retry multiple operations with shared error handling
 */
export async function batchRetry<T>(
  items: T[],
  fn: (item: T) => Promise<any>,
  options: RetryOptions & { concurrency?: number } = {}
): Promise<Array<{ item: T; result?: any; error?: Error }>> {
  const { concurrency = 5, ...retryOptions } = options;
  const results: Array<{ item: T; result?: any; error?: Error }> = [];

  // Process in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const result = await retry(() => fn(item), retryOptions);
          return { item, result };
        } catch (error) {
          return { item, error: error as Error };
        }
      })
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Circuit Breaker pattern - stop retrying after consecutive failures
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: Date;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if timeout has passed
      if (
        this.lastFailureTime &&
        Date.now() - this.lastFailureTime.getTime() > this.timeout
      ) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN - too many failures');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
      console.error(
        `Circuit breaker opened after ${this.failureCount} failures`
      );
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset() {
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.state = 'closed';
  }
}
