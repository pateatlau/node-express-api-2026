import { Request, Response, NextFunction } from 'express';
import {
  httpRequestDuration,
  httpRequestTotal,
  httpActiveRequests,
  httpRequestErrors,
  recordHttpSize,
} from '../lib/metrics';

/**
 * Middleware to track HTTP request metrics
 * Records duration, count, status codes, request/response sizes, and active requests
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

  // Track request size
  const requestSize = parseInt(req.headers['content-length'] || '0', 10);

  // Variable to track response size
  let responseSize = 0;

  // Intercept response to track size
  const originalSend = res.send;
  const originalJson = res.json;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.send = function (data: any): Response {
    if (data) {
      responseSize = Buffer.byteLength(typeof data === 'string' ? data : JSON.stringify(data));
    }
    return originalSend.call(this, data);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.json = function (data: any): Response {
    if (data) {
      responseSize = Buffer.byteLength(JSON.stringify(data));
    }
    return originalJson.call(this, data);
  };

  // Hook into response finish event
  res.on('finish', () => {
    // Calculate duration in seconds
    const durationSeconds = (Date.now() - start) / 1000;
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestDuration.labels(method, route, statusCode).observe(durationSeconds);
    httpRequestTotal.labels(method, route, statusCode).inc(); // Record request/response sizes
    if (requestSize > 0 || responseSize > 0) {
      recordHttpSize(method, route, requestSize, responseSize, res.statusCode);
    }

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
