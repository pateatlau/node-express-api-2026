/**
 * Rate limiting middleware
 * Protects against abuse and DoS attacks
 */

import type { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  maxRequests?: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Function to generate unique key
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  handler?: (req: Request, res: Response) => void; // Custom handler for rate limit exceeded
}

/**
 * Create rate limiter middleware
 * In production, use Redis for distributed rate limiting
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const {
    windowMs = 60 * 1000, // 1 minute
    maxRequests = 100,
    keyGenerator = (req: Request) => {
      // Use IP address by default
      const forwarded = req.headers['x-forwarded-for'];
      const ip =
        typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
      return ip || 'unknown';
    },
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    handler = (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  } = options;

  // In-memory store (use Redis in production!)
  const store: RateLimitStore = {};

  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    Object.keys(store).forEach((key) => {
      if (store[key].resetAt < now) {
        delete store[key];
      }
    });
  }, windowMs);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Initialize or reset if window expired
    if (!store[key] || store[key].resetAt < now) {
      store[key] = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    // Increment count
    store[key].count++;

    // Set rate limit headers
    const remaining = Math.max(0, maxRequests - store[key].count);
    const resetAt = new Date(store[key].resetAt).toISOString();

    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetAt);

    // Check if limit exceeded
    if (store[key].count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((store[key].resetAt - now) / 1000).toString());
      return handler(req, res);
    }

    // Track response status for conditional counting
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalSend = res.json;
      res.json = function (data: unknown) {
        const statusCode = res.statusCode;

        if (
          (skipSuccessfulRequests && statusCode < 400) ||
          (skipFailedRequests && statusCode >= 400)
        ) {
          store[key].count--;
        }

        return originalSend.call(this, data);
      };
    }

    next();
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */

// Strict rate limit for authentication endpoints
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts
  skipSuccessfulRequests: true,
});

// General API rate limit
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
});

// Generous rate limit for public endpoints
export const publicRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 300,
});
