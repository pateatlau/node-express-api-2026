/**
 * Rate Limiting Middleware
 */

import rateLimit from 'express-rate-limit';

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Upload rate limiter (more restrictive)
 */
export const uploadLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: 10, // 10 uploads per 15 minutes
  message: {
    success: false,
    error: 'Too many uploads',
    message: 'Too many file uploads, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
