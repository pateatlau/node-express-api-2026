# Request Validation Middleware

## Overview

Comprehensive request validation middleware to prevent XSS, SQL injection, and other security vulnerabilities through input sanitization and schema validation.

## Security Threats Addressed

1. **XSS (Cross-Site Scripting)** - Malicious scripts in user input
2. **SQL Injection** - SQL commands in input fields
3. **NoSQL Injection** - MongoDB query injection
4. **Path Traversal** - Directory access through filenames
5. **Command Injection** - Shell commands in input
6. **LDAP Injection** - LDAP query manipulation
7. **XXE (XML External Entity)** - XML parsing attacks

---

## Implementation Plan

### Phase 1: Install Dependencies (10 minutes)

```bash
# Core validation
npm install express-validator validator dompurify jsdom

# Additional security
npm install xss-clean hpp express-mongo-sanitize

# TypeScript types
npm install --save-dev @types/validator @types/dompurify
```

### Phase 2: Create Validation Utilities (1 hour)

#### 2.1 Input Sanitizer

**File: `src/middleware/sanitizer.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import validator from 'validator';
import logger from '../config/logger';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window as unknown as Window);

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove HTML tags and scripts
  let sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML allowed
    ALLOWED_ATTR: [],
  });

  // Escape special characters
  sanitized = validator.escape(sanitized);

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  return sanitized.trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Sanitize key name (prevent prototype pollution)
        const sanitizedKey = sanitizeString(key);
        if (
          sanitizedKey !== '__proto__' &&
          sanitizedKey !== 'constructor' &&
          sanitizedKey !== 'prototype'
        ) {
          sanitized[sanitizedKey] = sanitizeObject(obj[key]);
        }
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Express middleware to sanitize all request inputs
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Sanitize body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    logger.debug('Request sanitized', {
      method: req.method,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error('Error sanitizing request', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
    });
    next(error);
  }
};
```

#### 2.2 Validation Schemas

**File: `src/middleware/validators.ts`**

```typescript
import { body, param, query, ValidationChain } from 'express-validator';

/**
 * Common validation rules
 */
export const commonValidators = {
  id: param('id')
    .trim()
    .notEmpty()
    .withMessage('ID is required')
    .isString()
    .withMessage('ID must be a string')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('ID contains invalid characters'),

  email: body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email too long'),

  password: body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),

  name: body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be 1-255 characters')
    .matches(/^[a-zA-Z0-9\s\-'.]+$/)
    .withMessage('Name contains invalid characters'),

  pagination: {
    page: query('page')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Page must be between 1 and 10000')
      .toInt(),

    limit: query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
  },
};

/**
 * Todo validation rules
 */
export const todoValidators = {
  create: [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ min: 1, max: 500 })
      .withMessage('Title must be 1-500 characters')
      .matches(/^[^<>'";&$`|]+$/)
      .withMessage('Title contains invalid characters'),

    body('completed').optional().isBoolean().withMessage('Completed must be a boolean').toBoolean(),
  ],

  update: [
    commonValidators.id,

    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Title must be 1-500 characters')
      .matches(/^[^<>'";&$`|]+$/)
      .withMessage('Title contains invalid characters'),

    body('completed').optional().isBoolean().withMessage('Completed must be a boolean').toBoolean(),

    // Ensure at least one field is provided
    body().custom((value) => {
      if (!value.title && value.completed === undefined) {
        throw new Error('At least one field (title or completed) is required');
      }
      return true;
    }),
  ],

  getOne: [commonValidators.id],

  delete: [commonValidators.id],

  list: [
    commonValidators.pagination.page,
    commonValidators.pagination.limit,

    query('completed')
      .optional()
      .isBoolean()
      .withMessage('Completed must be a boolean')
      .toBoolean(),

    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search term too long')
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage('Search contains invalid characters'),
  ],
};

/**
 * User validation rules (for authentication)
 */
export const userValidators = {
  register: [commonValidators.email, commonValidators.password, commonValidators.name],

  login: [
    commonValidators.email,
    body('password').trim().notEmpty().withMessage('Password is required'),
  ],
};
```

#### 2.3 Validation Handler

**File: `src/middleware/validationHandler.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import logger from '../config/logger';

/**
 * Handle validation errors
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error: ValidationError) => ({
      field: 'path' in error ? error.path : 'unknown',
      message: error.msg,
      value: 'value' in error ? error.value : undefined,
    }));

    logger.warn('Validation failed', {
      path: req.path,
      method: req.method,
      errors: formattedErrors,
      ip: req.ip,
    });

    res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors,
    });
    return;
  }

  next();
};
```

### Phase 3: Additional Security Middleware (30 minutes)

#### 3.1 XSS Protection

**File: `src/middleware/security.ts`**

```typescript
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import { Request, Response, NextFunction } from 'express';

/**
 * Prevent NoSQL injection
 */
export const noSqlInjectionProtection = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized NoSQL injection attempt: ${key}`, {
      ip: req.ip,
      path: req.path,
    });
  },
});

/**
 * Prevent XSS attacks
 */
export const xssProtection = xss();

/**
 * Prevent HTTP Parameter Pollution
 */
export const parameterPollutionProtection = hpp({
  whitelist: ['page', 'limit', 'completed'], // Allow duplicate params
});

/**
 * Content Security Policy headers
 */
export const cspHeaders = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

/**
 * File upload validation
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.file) {
    next();
    return;
  }

  // Allowed file types
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedMimes.includes(req.file.mimetype)) {
    res.status(400).json({
      error: 'Invalid file type',
      allowed: allowedMimes,
    });
    return;
  }

  if (req.file.size > maxSize) {
    res.status(400).json({
      error: 'File too large',
      maxSize: `${maxSize / 1024 / 1024}MB`,
    });
    return;
  }

  // Sanitize filename
  req.file.originalname = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 255);

  next();
};
```

### Phase 4: Apply Middleware (30 minutes)

#### 4.1 Update App Configuration

**File: `src/app.ts`**

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Security middleware
import {
  noSqlInjectionProtection,
  xssProtection,
  parameterPollutionProtection,
  cspHeaders,
} from './middleware/security';
import { sanitizeRequest } from './middleware/sanitizer';

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Basic security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Rate limiting (global)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Security middleware (IMPORTANT: Order matters!)
app.use(noSqlInjectionProtection); // 1. NoSQL injection protection
app.use(xssProtection); // 2. XSS protection
app.use(sanitizeRequest); // 3. Custom sanitization
app.use(parameterPollutionProtection); // 4. HPP protection
app.use(cspHeaders); // 5. CSP headers

// ... rest of app configuration
```

#### 4.2 Update Todo Routes

**File: `src/routes/todos.routes.ts`**

```typescript
import express from 'express';
import { todoValidators } from '../middleware/validators';
import { handleValidationErrors } from '../middleware/validationHandler';

const router = express.Router();

// GET /api/todos - List todos with validation
router.get('/', todoValidators.list, handleValidationErrors, async (req, res) => {
  // Controller logic
});

// POST /api/todos - Create todo with validation
router.post('/', todoValidators.create, handleValidationErrors, async (req, res) => {
  // Controller logic
});

// PUT /api/todos/:id - Update todo with validation
router.put('/:id', todoValidators.update, handleValidationErrors, async (req, res) => {
  // Controller logic
});

// DELETE /api/todos/:id - Delete todo with validation
router.delete('/:id', todoValidators.delete, handleValidationErrors, async (req, res) => {
  // Controller logic
});

export default router;
```

### Phase 5: Testing (2 hours)

#### 5.1 Unit Tests

**File: `src/middleware/__tests__/sanitizer.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeString, sanitizeObject } from '../sanitizer';

describe('Sanitizer', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("XSS")</script>Hello';
      const result = sanitizeString(input);
      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello');
    });

    it('should escape special characters', () => {
      const input = 'Test & <test>';
      const result = sanitizeString(input);
      expect(result).toContain('&amp;');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('should remove null bytes', () => {
      const input = 'Hello\0World';
      const result = sanitizeString(input);
      expect(result).toBe('HelloWorld');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeString(input);
      expect(result).toBe('Hello World');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const input = {
        name: '<script>alert()</script>',
        nested: {
          value: 'Test & Data',
        },
      };

      const result = sanitizeObject(input);
      expect(result.name).not.toContain('<script>');
      expect(result.nested.value).toContain('&amp;');
    });

    it('should prevent prototype pollution', () => {
      const input = {
        __proto__: { admin: true },
        constructor: { admin: true },
        title: 'Normal',
      };

      const result = sanitizeObject(input);
      expect(result.__proto__).toBeUndefined();
      expect(result.constructor).toBeUndefined();
      expect(result.title).toBe('Normal');
    });

    it('should sanitize arrays', () => {
      const input = ['<script>alert()</script>', 'Normal'];
      const result = sanitizeObject(input);
      expect(result[0]).not.toContain('<script>');
      expect(result[1]).toBe('Normal');
    });
  });
});
```

#### 5.2 Integration Tests

**File: `src/__tests__/validation.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Request Validation', () => {
  describe('XSS Protection', () => {
    it('should reject XSS in todo title', async () => {
      const response = await request(app).post('/api/todos').send({
        title: '<script>alert("XSS")</script>',
        completed: false,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Validation failed');
    });
  });

  describe('SQL Injection Protection', () => {
    it('should sanitize SQL injection attempts', async () => {
      const response = await request(app).get('/api/todos').query({
        search: "'; DROP TABLE todos; --",
      });

      // Should either reject or sanitize
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('NoSQL Injection Protection', () => {
    it('should prevent MongoDB operator injection', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({
          title: { $ne: null },
          completed: false,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Validation Rules', () => {
    it('should reject empty title', async () => {
      const response = await request(app).post('/api/todos').send({
        title: '',
        completed: false,
      });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            message: expect.stringContaining('required'),
          }),
        ])
      );
    });

    it('should reject title too long', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({
          title: 'a'.repeat(501),
          completed: false,
        });

      expect(response.status).toBe(400);
    });

    it('should accept valid todo', async () => {
      const response = await request(app).post('/api/todos').send({
        title: 'Valid Todo',
        completed: false,
      });

      expect(response.status).toBe(201);
    });
  });
});
```

---

## Security Best Practices

### Input Validation Checklist

- Whitelist allowed characters
- Set length limits
- Sanitize HTML/scripts
- Escape special characters
- Validate data types
- Check for null bytes
- Prevent prototype pollution
- Validate file uploads
- Check MIME types
- Limit file sizes

### Defense in Depth

1. **Client-side validation** - First line of defense
2. **Server-side validation** - Never trust client input
3. **Database validation** - Schema constraints
4. **Output encoding** - Prevent XSS on display

---

## Monitoring

### Log Suspicious Activity

```typescript
logger.warn('Suspicious input detected', {
  ip: req.ip,
  path: req.path,
  method: req.method,
  input: sanitizedInput,
  originalInput: originalInput,
});
```

### Metrics to Track

- Validation failure rate
- Sanitization triggers
- Rate limit hits
- Blocked requests by type

---

## Files to Create/Update

| File                                  | Action | Priority |
| ------------------------------------- | ------ | -------- |
| `src/middleware/sanitizer.ts`         | Create | High     |
| `src/middleware/validators.ts`        | Create | High     |
| `src/middleware/validationHandler.ts` | Create | High     |
| `src/middleware/security.ts`          | Create | High     |
| `src/app.ts`                          | Update | High     |
| `src/routes/todos.routes.ts`          | Update | High     |
| `package.json`                        | Update | High     |

---

## Performance Impact

- **Minimal overhead** - Sanitization adds ~1-5ms per request
- **Caching** - Reuse sanitized values when possible
- **Async validation** - Run in parallel with other operations

---

## Resources

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [express-validator Documentation](https://express-validator.github.io/docs/)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)

**Status:** Ready for Implementation  
**Estimated Time:** 4-5 hours  
**Last Updated:** November 12, 2025
