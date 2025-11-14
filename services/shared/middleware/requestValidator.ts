/**
 * Request validation middleware
 * Validates request body, query params, and headers
 */

import type { Request, Response, NextFunction } from 'express';

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'email' | 'uuid' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: readonly string[];
  custom?: (value: unknown) => boolean | string;
}

export interface ValidationSchema {
  body?: ValidationRule[];
  query?: ValidationRule[];
  params?: ValidationRule[];
  headers?: ValidationRule[];
}

interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate a single field against rules
 */
function validateField(
  fieldName: string,
  value: unknown,
  rule: ValidationRule
): ValidationError | null {
  // Check required
  if (rule.required && (value === undefined || value === null || value === '')) {
    return { field: fieldName, message: `${fieldName} is required` };
  }

  // Skip validation if field is optional and not provided
  if (!rule.required && (value === undefined || value === null)) {
    return null;
  }

  // Type validation
  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') {
        return { field: fieldName, message: `${fieldName} must be a string` };
      }
      if (rule.min !== undefined && value.length < rule.min) {
        return {
          field: fieldName,
          message: `${fieldName} must be at least ${rule.min} characters`,
        };
      }
      if (rule.max !== undefined && value.length > rule.max) {
        return { field: fieldName, message: `${fieldName} must be at most ${rule.max} characters` };
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        return { field: fieldName, message: `${fieldName} has invalid format` };
      }
      if (rule.enum && !rule.enum.includes(value)) {
        return {
          field: fieldName,
          message: `${fieldName} must be one of: ${rule.enum.join(', ')}`,
        };
      }
      break;

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return { field: fieldName, message: `${fieldName} must be a number` };
      }
      if (rule.min !== undefined && value < rule.min) {
        return { field: fieldName, message: `${fieldName} must be at least ${rule.min}` };
      }
      if (rule.max !== undefined && value > rule.max) {
        return { field: fieldName, message: `${fieldName} must be at most ${rule.max}` };
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return { field: fieldName, message: `${fieldName} must be a boolean` };
      }
      break;

    case 'email':
      if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { field: fieldName, message: `${fieldName} must be a valid email` };
      }
      break;

    case 'uuid':
      if (
        typeof value !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      ) {
        return { field: fieldName, message: `${fieldName} must be a valid UUID` };
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        return { field: fieldName, message: `${fieldName} must be an array` };
      }
      if (rule.min !== undefined && value.length < rule.min) {
        return { field: fieldName, message: `${fieldName} must have at least ${rule.min} items` };
      }
      if (rule.max !== undefined && value.length > rule.max) {
        return { field: fieldName, message: `${fieldName} must have at most ${rule.max} items` };
      }
      break;

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        return { field: fieldName, message: `${fieldName} must be an object` };
      }
      break;
  }

  // Custom validation
  if (rule.custom) {
    const result = rule.custom(value);
    if (typeof result === 'string') {
      return { field: fieldName, message: result };
    }
    if (result === false) {
      return { field: fieldName, message: `${fieldName} is invalid` };
    }
  }

  return null;
}

/**
 * Create validation middleware
 */
export function validate(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: ValidationError[] = [];

    // Validate body
    if (schema.body) {
      for (const rule of schema.body) {
        const value = req.body?.[rule.field];
        const error = validateField(rule.field, value, rule);
        if (error) errors.push(error);
      }
    }

    // Validate query params
    if (schema.query) {
      for (const rule of schema.query) {
        let value: unknown = req.query[rule.field];

        // Convert query string values to correct types
        if (value !== undefined && value !== null) {
          if (rule.type === 'number') {
            value = Number(value);
          } else if (rule.type === 'boolean') {
            value = value === 'true' || value === '1';
          }
        }

        const error = validateField(rule.field, value, rule);
        if (error) errors.push(error);
      }
    }

    // Validate URL params
    if (schema.params) {
      for (const rule of schema.params) {
        const value = req.params[rule.field];
        const error = validateField(rule.field, value, rule);
        if (error) errors.push(error);
      }
    }

    // Validate headers
    if (schema.headers) {
      for (const rule of schema.headers) {
        const value = req.headers[rule.field.toLowerCase()];
        const error = validateField(rule.field, value, rule);
        if (error) errors.push(error);
      }
    }

    // Return errors if any
    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
}

/**
 * Common validation patterns
 */
export const commonPatterns = {
  alphanumeric: /^[a-zA-Z0-9]+$/,
  alphanumericWithSpaces: /^[a-zA-Z0-9\s]+$/,
  username: /^[a-zA-Z0-9_-]{3,20}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  url: /^https?:\/\/.+/,
  phone: /^\+?[\d\s-()]+$/,
  zipCode: /^\d{5}(-\d{4})?$/,
  hexColor: /^#[0-9A-Fa-f]{6}$/,
} as const;
