import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';

/**
 * Shared metrics utilities for microservices
 * Provides Prometheus metrics collection
 */

// Create a Registry per service instance
export const register = new promClient.Registry();

// Track if default metrics have been added
let defaultMetricsAdded = false;

/**
 * Initialize metrics for a service
 * Call this once at service startup
 */
export function initializeMetrics(serviceName: string): void {
  if (!defaultMetricsAdded) {
    promClient.collectDefaultMetrics({
      register,
      prefix: `${serviceName}_`,
    });
    defaultMetricsAdded = true;
  }
}

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'],
  registers: [register],
});

export const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['service'],
  registers: [register],
});

export const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

/**
 * Middleware to collect HTTP metrics
 */
export function metricsMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    // Increment active connections
    activeConnections.inc({ service: serviceName });

    // Track response
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path;

      // Record metrics
      httpRequestDuration.observe(
        {
          method: req.method,
          route,
          status_code: res.statusCode,
          service: serviceName,
        },
        duration
      );

      httpRequestTotal.inc({
        method: req.method,
        route,
        status_code: res.statusCode,
        service: serviceName,
      });

      // Decrement active connections
      activeConnections.dec({ service: serviceName });
    });

    next();
  };
}

/**
 * Metrics endpoint handler
 */
export async function metricsHandler(_req: Request, res: Response) {
  res.set('Content-Type', register.contentType);
  const metrics = await register.metrics();
  res.end(metrics);
}
