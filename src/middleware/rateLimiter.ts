import rateLimit from 'express-rate-limit';
import logger from '../config/logger';

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
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
 * Stricter rate limiter for authentication endpoints
 * Limits: 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/register requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
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
 * Limits: 50 requests per 15 minutes per IP
 */
export const graphqlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // GraphQL queries can be more expensive
  message: 'Too many GraphQL requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('GraphQL rate limit exceeded', {
      ip: req.ip,
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
 * Strict rate limiter for mutation endpoints
 * Limits: 20 requests per 15 minutes per IP
 */
export const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Stricter for write operations
  message: 'Too many write operations, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    logger.warn('Mutation rate limit exceeded', {
      ip: req.ip,
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
