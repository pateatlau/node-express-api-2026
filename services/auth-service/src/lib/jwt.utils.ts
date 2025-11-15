/**
 * JWT Utilities for token generation and verification
 */

import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

// Environment variables for JWT secrets
const ACCESS_TOKEN_SECRET =
  process.env.JWT_ACCESS_SECRET || 'your-access-token-secret-change-in-production';
const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET || 'your-refresh-token-secret-change-in-production';

// Token expiration times
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  sessionId?: string; // Session ID for session tracking
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Generate access token (short-lived)
 */
export function generateAccessToken(
  userId: string,
  email: string,
  role: string,
  sessionId?: string
): string {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    userId,
    email,
    role,
    ...(sessionId && { sessionId }),
    type: 'access',
  };

  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  } as SignOptions);
}

/**
 * Generate refresh token (long-lived)
 */
export function generateRefreshToken(userId: string, email: string, role: string): string {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    userId,
    email,
    role,
    type: 'refresh',
  };

  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  } as SignOptions);
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokens(userId: string, email: string, role: string, sessionId?: string) {
  return {
    accessToken: generateAccessToken(userId, email, role, sessionId),
    refreshToken: generateRefreshToken(userId, email, role),
  };
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch {
    throw new Error('Invalid or expired access token');
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as JwtPayload;

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}
