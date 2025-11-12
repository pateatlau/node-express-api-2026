/**
 * Authentication Service
 * Handles user authentication, registration, and token management
 */

import bcrypt from 'bcryptjs';
import { PrismaClient, User, Role } from '@prisma/client';
import { generateTokens } from '../lib/jwt.utils.js';
import type {
  SignupData,
  LoginCredentials,
  UserResponse,
  AuthResponse,
} from '../types/auth.types.js';

const prisma = new PrismaClient();

// Salt rounds for bcrypt
const SALT_ROUNDS = 10;

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

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  // Validate password strength
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

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
  const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);

  return {
    user: toUserResponse(user),
    accessToken,
  };
}

/**
 * Login user with email and password
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const { email, password } = credentials;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Update last activity
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActivityAt: new Date() },
  });

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);

  return {
    user: toUserResponse(user),
    accessToken,
  };
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Update last activity
  await updateLastActivity(userId);

  // Generate new access token
  const { accessToken } = generateTokens(user.id, user.email, user.role);
  return accessToken;
}
