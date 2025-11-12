/**
 * Zod Validation Schemas for Authentication
 */

import { z } from 'zod';

/**
 * Signup validation schema
 */
export const signupSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters'),
  role: z.enum(['STARTER', 'PRO']).optional().default('STARTER'),
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Login validation schema
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
