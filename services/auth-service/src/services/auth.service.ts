/**
 * Authentication Service
 * Handles user authentication, registration, and token management
 */

import bcrypt from 'bcryptjs';
import { User, Role } from '@prisma/client';
import { generateTokens } from '../lib/jwt.utils.js';
import { tokenGeneration, passwordHashDuration, recordAuthOperation } from '../lib/metrics.js';
import {
  ConflictError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
} from '../utils/errors.js';
import { prisma } from '../lib/prisma.js';

// Salt rounds for bcrypt
const SALT_ROUNDS = 10;

export interface SignupData {
  name: string;
  email: string;
  password: string;
  role?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: UserResponse;
  accessToken: string;
}

/**
 * Convert User to UserResponse (remove password)
 */
function toUserResponse(user: User): UserResponse {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Register a new user
 */
export async function signup(data: SignupData): Promise<AuthResponse> {
  const { name, email, password, role = 'STARTER' } = data;

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      recordAuthOperation('signup', false);
      throw new ConflictError('User with this email already exists');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      recordAuthOperation('signup', false);
      throw new ValidationError('Invalid email format');
    }

    // Validate password strength (basic check, Zod handles detailed validation)
    if (password.length < 8) {
      recordAuthOperation('signup', false);
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Hash password (track duration)
    const hashStart = Date.now();
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const hashDuration = (Date.now() - hashStart) / 1000;
    passwordHashDuration.observe(hashDuration);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as Role,
      },
    });

    // Generate tokens
    const { accessToken } = generateTokens(user.id, user.email, user.role);

    // Track token generation
    tokenGeneration.labels('access').inc();
    tokenGeneration.labels('refresh').inc();

    // Record successful signup
    recordAuthOperation('signup', true);

    return {
      user: toUserResponse(user),
      accessToken,
    };
  } catch (error) {
    recordAuthOperation('signup', false);
    throw error;
  }
}

/**
 * Login user with email and password
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const { email, password } = credentials;

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // SECURITY: Always perform bcrypt comparison to prevent timing attacks
    // Use dummy hash if user not found to maintain constant time
    const hashStart = Date.now();
    const passwordToCompare =
      user?.password || '$2a$10$dummyhashXXXXXXXXXXXXXXeuZGJVGvVvXVvXVvXVvXVvXVvXVvXVvXVu';
    const isPasswordValid = await bcrypt.compare(password, passwordToCompare);
    const hashDuration = (Date.now() - hashStart) / 1000;
    passwordHashDuration.observe(hashDuration);

    // Check both conditions together to prevent timing differences
    if (!user || !isPasswordValid) {
      recordAuthOperation('login', false);
      throw new AuthenticationError('Invalid email or password');
    }

    // Update last activity
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActivityAt: new Date() },
    });

    // Generate tokens
    const { accessToken } = generateTokens(user.id, user.email, user.role);

    // Track token generation
    tokenGeneration.labels('access').inc();
    tokenGeneration.labels('refresh').inc();

    // Record successful login
    recordAuthOperation('login', true);

    return {
      user: toUserResponse(user),
      accessToken,
    };
  } catch (error) {
    recordAuthOperation('login', false);
    throw error;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<UserResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  return toUserResponse(user);
}

/**
 * Update user's last activity timestamp
 */
export async function updateLastActivity(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastActivityAt: new Date() },
  });
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(userId: string): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      recordAuthOperation('refresh', false);
      throw new NotFoundError('User');
    }

    // Update last activity
    await updateLastActivity(userId);

    // Generate new access token
    const { accessToken } = generateTokens(user.id, user.email, user.role);

    // Track token generation
    tokenGeneration.labels('access').inc();

    // Record successful refresh
    recordAuthOperation('refresh', true);

    return accessToken;
  } catch (error) {
    recordAuthOperation('refresh', false);
    throw error;
  }
}
