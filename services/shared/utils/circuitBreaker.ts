/**
 * Circuit breaker pattern implementation
 * Prevents cascading failures by failing fast when a service is unhealthy
 */

import { logger } from '../utils/logger.js';

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before opening
  successThreshold?: number; // Number of successes in half-open before closing
  timeout?: number; // Time in ms before attempting recovery (half-open)
  monitoringPeriod?: number; // Rolling window for failure tracking (ms)
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

interface CircuitBreakerStats {
  failures: number;
  successes: number;
  recentFailures: number[];
  state: CircuitState;
  nextAttempt: number;
}

/**
 * Circuit breaker for protecting against cascading failures
 */
export class CircuitBreaker {
  private options: Required<CircuitBreakerOptions>;
  private stats: CircuitBreakerStats;
  private name: string;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 2,
      timeout: options.timeout ?? 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod ?? 120000, // 2 minutes
      onStateChange: options.onStateChange ?? (() => {}),
    };

    this.stats = {
      failures: 0,
      successes: 0,
      recentFailures: [],
      state: CircuitState.CLOSED,
      nextAttempt: 0,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.stats.state === CircuitState.OPEN) {
      if (Date.now() < this.stats.nextAttempt) {
        throw new Error(`Circuit breaker '${this.name}' is OPEN`);
      }
      // Try to recover
      this.changeState(CircuitState.HALF_OPEN);
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

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.stats.successes++;

    if (this.stats.state === CircuitState.HALF_OPEN) {
      if (this.stats.successes >= this.options.successThreshold) {
        this.changeState(CircuitState.CLOSED);
        this.stats.failures = 0;
        this.stats.successes = 0;
        this.stats.recentFailures = [];
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.stats.failures++;
    this.stats.recentFailures.push(Date.now());

    // Clean old failures outside monitoring period
    const cutoff = Date.now() - this.options.monitoringPeriod;
    this.stats.recentFailures = this.stats.recentFailures.filter((time) => time > cutoff);

    // Open circuit if threshold exceeded
    if (
      this.stats.state === CircuitState.CLOSED &&
      this.stats.recentFailures.length >= this.options.failureThreshold
    ) {
      this.changeState(CircuitState.OPEN);
      this.stats.nextAttempt = Date.now() + this.options.timeout;
    } else if (this.stats.state === CircuitState.HALF_OPEN) {
      // Go back to open on any failure in half-open
      this.changeState(CircuitState.OPEN);
      this.stats.nextAttempt = Date.now() + this.options.timeout;
      this.stats.successes = 0;
    }
  }

  /**
   * Change circuit state
   */
  private changeState(newState: CircuitState): void {
    const oldState = this.stats.state;
    if (oldState !== newState) {
      this.stats.state = newState;
      logger.warn(`Circuit breaker '${this.name}' state changed`, {
        from: oldState,
        to: newState,
        failures: this.stats.failures,
        recentFailures: this.stats.recentFailures.length,
      });
      this.options.onStateChange(oldState, newState);
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.stats.state;
  }

  /**
   * Get circuit statistics
   */
  getStats() {
    return {
      state: this.stats.state,
      failures: this.stats.failures,
      successes: this.stats.successes,
      recentFailures: this.stats.recentFailures.length,
      nextAttemptIn: Math.max(0, this.stats.nextAttempt - Date.now()),
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    logger.info(`Circuit breaker '${this.name}' manually reset`);
    this.stats.failures = 0;
    this.stats.successes = 0;
    this.stats.recentFailures = [];
    this.changeState(CircuitState.CLOSED);
  }
}

/**
 * Circuit breaker registry for managing multiple breakers
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  getOrCreate(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  /**
   * Get stats for all breakers
   */
  getAllStats() {
    const stats: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Decorator for wrapping async functions with circuit breaker
 */
export function withCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
  name: string,
  options?: CircuitBreakerOptions
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as T;
    const breaker = circuitBreakerRegistry.getOrCreate(name, options);

    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
