/**
 * Centralized Error Handler Middleware
 * Handles all errors consistently across the application
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export interface ErrorResponse {
  success: false;
  message: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
  timestamp: string;
  path?: string;
}

/**
 * Global error handler middleware
 * Must have 4 parameters to be recognized by Express
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const timestamp = new Date().toISOString();

  // Log error details
  console.error('[ERROR]', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp,
    path: req.path,
    method: req.method,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: err.errors.map((error) => ({
        field: error.path.join('.'),
        message: error.message,
      })),
      timestamp,
      path: req.path,
    };
    res.status(400).json(response);
    return;
  }

  // Handle custom AppError instances
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      message: err.message,
      code: err.code,
      timestamp,
      path: req.path,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      const response: ErrorResponse = {
        success: false,
        message: 'A record with this value already exists',
        code: 'DUPLICATE_ERROR',
        timestamp,
        path: req.path,
      };
      res.status(409).json(response);
      return;
    }
  }

  // Default error response (don't expose internal details)
  const response: ErrorResponse = {
    success: false,
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    timestamp,
    path: req.path,
  };

  // In development, include error message
  if (process.env.NODE_ENV === 'development') {
    response.message = err.message;
  }

  res.status(500).json(response);
}

/**
 * Handle 404 errors
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ErrorResponse = {
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
    path: req.path,
  };
  res.status(404).json(response);
}
