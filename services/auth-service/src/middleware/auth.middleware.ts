/**
 * Authentication Middleware
 * Verifies JWT tokens for protected routes
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../lib/jwt.utils.js';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * Middleware to authenticate requests using JWT
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyAccessToken(token);

    // Attach user info to request
    (req as AuthRequest).user = decoded;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : 'Invalid token',
    });
  }
}
