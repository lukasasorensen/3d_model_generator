import { logger } from '../infrastructure/logger/logger';

export interface RetryResult<T> {
  success: true;
  data: T;
}

export interface RetryFailure {
  success: false;
  error: Error;
  attempts: number;
}

export type RetryOutcome<T> = RetryResult<T> | RetryFailure;

export interface RetryAttemptContext<TFailure = unknown> {
  attempt: number;
  maxAttempts: number;
  lastFailure?: TFailure;
}

export interface RetryCallbacks<TFailure = unknown> {
  onAttemptStart?: (context: RetryAttemptContext<TFailure>) => void;
  onAttemptFailed?: (context: RetryAttemptContext<TFailure>) => void;
}

export interface RetryOptions<TFailure = unknown> {
  maxAttempts: number;
  callbacks?: RetryCallbacks<TFailure>;
}

/**
 * Generic retry runner that executes an operation with automatic retries on failure.
 * The operation function receives the attempt context and should throw an error to trigger a retry.
 * If the operation returns successfully, the result is wrapped and returned.
 */
export class RetryRunner {
  /**
   * Run an operation with retries.
   * @param operation Function to execute. Receives attempt context. Should throw to trigger retry.
   * @param options Retry configuration including max attempts and optional callbacks.
   * @returns The result of the successful operation or throws after max attempts.
   */
  async run<T, TFailure = unknown>(
    operation: (context: RetryAttemptContext<TFailure>) => Promise<T>,
    options: RetryOptions<TFailure>
  ): Promise<T> {
    const { maxAttempts, callbacks } = options;
    let lastFailure: TFailure | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const context: RetryAttemptContext<TFailure> = {
        attempt,
        maxAttempts,
        lastFailure
      };

      callbacks?.onAttemptStart?.(context);

      try {
        const result = await operation(context);
        logger.debug('Retry operation succeeded', { attempt, maxAttempts });
        return result;
      } catch (error: any) {
        lastFailure = error;
        logger.warn('Retry operation failed', {
          attempt,
          maxAttempts,
          error: error.message
        });

        callbacks?.onAttemptFailed?.({
          ...context,
          lastFailure: error
        });

        if (attempt === maxAttempts) {
          throw new Error(`Operation failed after ${maxAttempts} attempts: ${error.message}`);
        }
      }
    }

    throw new Error('Retry runner exited unexpectedly');
  }
}
