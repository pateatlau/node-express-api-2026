import rateLimit from 'express-rate-limit';
import logger from '../config/logger.js';
import type { Request } from 'express';
import type { AuthRequest } from '../types/auth.types.js';

/**
 * Custom key generator that uses user ID for authenticated requests
 * Falls back to IP for unauthenticated requests
 * This prevents rate limit bypass via VPN/proxy and provides per-user limits
 *
 * Important: For production with IPv6, consider using a library like
 * `rate-limit-redis` which handles IPv6 normalization automatically.
 */
const getUserOrIpKey = (req: Request): string => {
  const authReq = req as AuthRequest;

  // For authenticated requests, use user ID
  if (authReq.user?.userId) {
    return `user:${authReq.user.userId}`;
  }

  // For unauthenticated requests, use IP
  // Note: In production, normalize IPv6 addresses or use Redis store
  return `ip:${req.ip || 'unknown'}`;
}; /**
 * General API rate limiter
 * Limits: 1000 requests per 15 minutes per user/IP
 * Uses user ID for authenticated requests, IP for anonymous
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for session polling and normal usage
  message: 'Too many requests, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: getUserOrIpKey, // Use user ID or IP
  skipSuccessfulRequests: true, // Only count failed requests for general limiter
  skip: (req) => {
    // Skip rate limiting for session polling endpoints
    return req.path === '/api/auth/sessions' || req.path === '/api/auth/session';
  },
  validate: false, // Disable validation for development
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      key: getUserOrIpKey(req),
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later.',
      retryAfter: res.getHeader('RateLimit-Reset'),
    });
  },
});

/**
 * Strict authentication rate limiter for login/signup
 * Limits: 100 requests per 15 minutes per IP (increased for development/testing)
 * Uses IP-based limiting to prevent brute force attacks
 * Note: Login attempts should use IP, not user ID (user not authenticated yet)
 * TODO: Reduce to 5-10 for production
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased for development - reduce for production!
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all auth attempts
  validate: false, // Disable validation for development
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please try again after 15 minutes.',
      retryAfter: res.getHeader('RateLimit-Reset'),
    });
  },
});

/**
 * GraphQL rate limiter
 * Limits: 100 requests per 15 minutes per user/IP
 * Uses user ID for authenticated requests
 */
export const graphqlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased for legitimate query patterns
  message: 'Too many GraphQL requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserOrIpKey, // User-based for authenticated requests
  skipSuccessfulRequests: true, // Only count failed/expensive queries
  validate: false, // Disable validation for development
  handler: (req, res) => {
    logger.warn('GraphQL rate limit exceeded', {
      key: getUserOrIpKey(req),
      query: req.body?.query?.substring(0, 100), // Log first 100 chars
    });
    res.status(429).json({
      errors: [
        {
          message: 'Too many requests',
          extensions: {
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: res.getHeader('RateLimit-Reset'),
          },
        },
      ],
    });
  },
});

/**
 * Rate limiter for mutation endpoints
 * Limits: 30 requests per 15 minutes per user/IP
 * Uses user ID to prevent cross-user rate limit sharing
 */
export const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Reasonable limit for write operations
  message: 'Too many write operations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserOrIpKey, // User-based for authenticated requests
  skipSuccessfulRequests: false, // Count all mutations
  validate: false, // Disable validation for development
  handler: (req, res) => {
    logger.warn('Mutation rate limit exceeded', {
      key: getUserOrIpKey(req),
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: 'Too many write operations',
      message: 'Please try again later.',
      retryAfter: res.getHeader('RateLimit-Reset'),
    });
  },
});

/**
 * Rate limiter for session management operations
 * Limits: 500 requests per 15 minutes per user (increased for development)
 * More lenient as users may legitimately manage multiple sessions
 * Uses user ID to prevent legitimate users behind shared IPs from affecting each other
 * TODO: Reduce to 50 for production
 */
export const sessionLogoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased for development - reduce to 50 for production!
  message: 'Too many session operations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserOrIpKey, // User-based limiting
  skipSuccessfulRequests: false, // Count all operations
  validate: false, // Disable validation for development
  handler: (req, res) => {
    logger.warn('Session management rate limit exceeded', {
      key: getUserOrIpKey(req),
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: 'Too many session operations',
      message: 'Please try again later.',
      retryAfter: res.getHeader('RateLimit-Reset'),
    });
  },
});
