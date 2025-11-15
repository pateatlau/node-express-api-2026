/**
 * Custom Error Classes for Auth Service
 * Provides structured error handling with proper HTTP status codes
 */

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational: boolean = true,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(401, message, true, 'AUTH_ERROR');
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string = 'Validation failed',
    public errors?: any[]
  ) {
    super(400, message, true, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(404, `${resource} not found`, true, 'NOT_FOUND');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(403, message, true, 'FORBIDDEN');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(429, message, true, 'RATE_LIMIT');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(409, message, true, 'CONFLICT');
  }
}

export class AccountLockedError extends AppError {
  constructor(message: string = 'Account is locked') {
    super(423, message, true, 'ACCOUNT_LOCKED');
  }
}
