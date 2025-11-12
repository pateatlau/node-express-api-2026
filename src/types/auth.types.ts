/**
 * Authentication and Authorization Types
 */

import { Role } from '@prisma/client';
import { Request } from 'express';

/**
 * User object (without sensitive data like password)
 */
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * JWT Payload structure
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  type: 'access' | 'refresh';
}

/**
 * Auth tokens response
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Signup data
 */
export interface SignupData {
  name: string;
  email: string;
  password: string;
  role?: Role;
}

/**
 * Auth response (after login/signup)
 */
export interface AuthResponse {
  user: UserResponse;
  accessToken: string;
  // refreshToken is set as httpOnly cookie, not returned in response
}

/**
 * Express Request with authenticated user
 */
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: Role;
  };
}
