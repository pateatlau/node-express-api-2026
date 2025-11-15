/**
 * Prometheus Metrics for Auth Service
 */

import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// Auth operations counter
export const authOperationsTotal = new Counter({
  name: 'auth_operations_total',
  help: 'Total number of auth operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

// Token generation counter
export const tokenGeneration = new Counter({
  name: 'auth_tokens_generated_total',
  help: 'Total number of tokens generated',
  labelNames: ['type'],
  registers: [register],
});

// Password hash duration histogram
export const passwordHashDuration = new Histogram({
  name: 'auth_password_hash_duration_seconds',
  help: 'Time taken to hash passwords',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Active sessions gauge
export const activeSessions = new Gauge({
  name: 'auth_active_sessions',
  help: 'Number of active sessions',
  registers: [register],
});

// Record auth operation
export function recordAuthOperation(operation: string, success: boolean) {
  authOperationsTotal.labels(operation, success ? 'success' : 'failure').inc();
}

export { register };
