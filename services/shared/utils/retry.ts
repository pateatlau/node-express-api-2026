/**
 * Retry logic with exponential backoff
 * Automatically retries failed operations with configurable strategies
 */

import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries?: number; // Maximum number of retry attempts
  initialDelay?: number; // Initial delay in ms
  maxDelay?: number; // Maximum delay in ms
  backoffMultiplier?: number; // Exponential backoff multiplier
  retryIf?: (error: Error) => boolean; // Custom retry condition
  onRetry?: (attempt: number, error: Error) => void; // Callback on retry
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    retryIf = () => true,
    onRetry = () => {},
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if this is the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Check if we should retry this error
      if (!retryIf(lastError)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt), maxDelay);

      logger.warn(`Retrying operation after failure`, {
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: lastError.message,
      });

      onRetry(attempt + 1, lastError);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  logger.error(`All ${maxRetries} retry attempts failed`, {
    error: lastError!.message,
  });
  throw lastError!;
}

/**
 * Retry transient network errors
 */
export const retryNetworkErrors = (options?: RetryOptions) =>
  retry(
    async () => {
      throw new Error('Implementation required');
    },
    {
      ...options,
      retryIf: (error: Error) => {
        // Retry on network errors, timeouts, 5xx errors
        const transientErrors = [
          'ECONNREFUSED',
          'ECONNRESET',
          'ETIMEDOUT',
          'ENOTFOUND',
          'EAI_AGAIN',
        ];
        return transientErrors.some((code) => error.message.includes(code));
      },
    }
  );

/**
 * Decorator for automatic retry on async methods
 */
export function Retry(options?: RetryOptions) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      return retry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}
