import { Request, Response, NextFunction } from 'express';
import {
  httpRequestDuration,
  httpRequestTotal,
  httpActiveRequests,
  httpRequestErrors,
} from '../lib/metrics';

/**
 * Middleware to track HTTP request metrics
 * Records duration, count, status codes, and active requests
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Start timer
  const start = Date.now();

  // Increment active requests
  const method = req.method;
  httpActiveRequests.labels(method).inc();

  // Track route (use route pattern if available, otherwise path)
  let route = req.route?.path || req.path;

  // Normalize route for metrics (replace IDs with placeholders)
  route = normalizeRoute(route);

  // Hook into response finish event
  res.on('finish', () => {
    // Calculate duration in seconds
    const durationSeconds = (Date.now() - start) / 1000;
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestDuration.labels(method, route, statusCode).observe(durationSeconds);
    httpRequestTotal.labels(method, route, statusCode).inc();

    // Decrement active requests
    httpActiveRequests.labels(method).dec();

    // Track errors (4xx and 5xx responses)
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      httpRequestErrors.labels(method, route, errorType).inc();
    }
  });

  // Track errors on close (connection terminated)
  res.on('close', () => {
    if (!res.writableEnded) {
      // Request was aborted/closed before completion
      httpActiveRequests.labels(method).dec();
      httpRequestErrors.labels(method, route, 'connection_closed').inc();
    }
  });

  next();
}

/**
 * Normalize route paths for consistent metrics
 * Replaces UUIDs and numeric IDs with placeholders
 */
function normalizeRoute(route: string): string {
  // Replace UUIDs with :id
  let normalized = route.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );

  // Replace numeric IDs with :id
  normalized = normalized.replace(/\/\d+/g, '/:id');

  // Limit length to prevent cardinality explosion
  if (normalized.length > 100) {
    normalized = normalized.substring(0, 100) + '...';
  }

  return normalized || '/unknown';
}
