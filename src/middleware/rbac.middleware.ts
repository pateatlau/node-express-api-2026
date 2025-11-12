/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts route access based on user roles
 */

import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../types/auth.types.js';

/**
 * Middleware factory to require specific roles
 * Usage: requireRole(['PRO']) or requireRole(['STARTER', 'PRO'])
 */
export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;

    // Check if user is authenticated
    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Check if user has required role
    if (!allowedRoles.includes(authReq.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        userRole: authReq.user.role,
      });
      return;
    }

    // User has required role, continue
    next();
  };
}

/**
 * Middleware to require PRO role specifically
 * Shorthand for requireRole(['PRO'])
 */
export function requireProRole(req: Request, res: Response, next: NextFunction): void {
  return requireRole(['PRO'])(req, res, next);
}

/**
 * Middleware that allows both STARTER and PRO roles
 * Useful for routes that any authenticated user can access
 */
export function requireAnyRole(req: Request, res: Response, next: NextFunction): void {
  return requireRole(['STARTER', 'PRO'])(req, res, next);
}

/**
 * Check if user has specific role (utility function for use in resolvers)
 */
export function hasRole(userRole: Role | undefined, allowedRoles: Role[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/**
 * Check if user is PRO (utility function)
 */
export function isProUser(userRole: Role | undefined): boolean {
  return userRole === 'PRO';
}

/**
 * Check if user is STARTER (utility function)
 */
export function isStarterUser(userRole: Role | undefined): boolean {
  return userRole === 'STARTER';
}
