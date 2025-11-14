import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.utils.js';
import { getUserById, updateLastActivity } from '../services/auth.service.js';
import {
  isSessionExpired,
  updateLastActivity as updateSessionActivity,
} from '../services/session.service.js';
import type { AuthRequest } from '../types/auth.types.js';
import logger from '../config/logger.js';

/**
 * Endpoints that should NOT update session activity
 * These are read-only endpoints used for checking session status or presence detection
 */
const ACTIVITY_SKIP_ENDPOINTS = [
  '/api/auth/session', // Session status check endpoint (SessionProvider polling)
  '/api/auth/me', // User info endpoint (ActivityTracker presence detection)
];

/**
 * Check if the current endpoint should skip activity updates
 */
function shouldSkipActivityUpdate(path: string): boolean {
  return ACTIVITY_SKIP_ENDPOINTS.includes(path);
}

/**
 * Middleware to verify JWT access token
 * Attaches user info to request if valid
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Please authenticate.',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyAccessToken(token);

    // Verify user still exists
    const user = await getUserById(decoded.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found. Please login again.',
      });
      return;
    }

    // Check if session has expired due to inactivity
    const sessionExpired = await isSessionExpired(decoded.userId);

    logger.info('[AUTH MIDDLEWARE - DEBUG]', {
      userId: decoded.userId,
      email: decoded.email,
      endpoint: req.path,
      method: req.method,
      sessionExpired,
      willSkipActivityUpdate: shouldSkipActivityUpdate(req.path),
    });

    if (sessionExpired) {
      logger.warn('[AUTH MIDDLEWARE - SESSION EXPIRED]', {
        userId: decoded.userId,
        endpoint: req.path,
      });

      res.status(401).json({
        success: false,
        message: 'Session expired due to inactivity. Please login again.',
        code: 'SESSION_EXPIRED',
      });
      return;
    }

    // Update last activity ONLY if not a read-only endpoint
    if (!shouldSkipActivityUpdate(req.path)) {
      logger.info('[AUTH MIDDLEWARE - UPDATING SESSION]', {
        userId: decoded.userId,
        endpoint: req.path,
      });

      await updateLastActivity(decoded.userId);
      await updateSessionActivity(token); // Update Session.lastActivity
    } else {
      logger.info('[AUTH MIDDLEWARE - SKIPPING ACTIVITY UPDATE]', {
        userId: decoded.userId,
        endpoint: req.path,
      });
    }

    // Attach user info to request
    (req as AuthRequest).user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : 'Invalid or expired token',
    });
  }
}

/**
 * Optional authentication middleware
 * Does not fail if token is missing, but validates if present
 */
export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, continue without authentication
      next();
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    const user = await getUserById(decoded.userId);
    if (user) {
      // Check session expiration
      const sessionExpired = await isSessionExpired(decoded.userId);

      if (!sessionExpired) {
        // Only set user if session is still valid
        (req as AuthRequest).user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
        };

        // Update last activity in both User and Session tables
        await updateLastActivity(decoded.userId);
        await updateSessionActivity(token); // Update Session.lastActivity
      }
    }

    next();
  } catch {
    // Token invalid, but continue without authentication
    next();
  }
}
