/**
 * Rate Limiting Middleware
 */

import rateLimit from 'express-rate-limit';

// General rate limiter for auth endpoints (stricter)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Session logout rate limiter (more lenient)
export const sessionLogoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: {
    success: false,
    message: 'Too many logout requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
