# Request ID Tracing

## Overview

Implement distributed request tracing with `X-Request-ID` header propagation to correlate logs across microservices, database queries, and external API calls.

## Benefits

- **Debugging** - Track requests through entire system lifecycle
- **Performance Analysis** - Identify slow operations per request
- **Error Correlation** - Link errors across services
- **Audit Trail** - Complete request history
- **Distributed Tracing** - Works with APM tools (Datadog, New Relic)

---

## Implementation Plan

### Phase 1: Request ID Middleware (30 minutes)

#### 1.1 Generate and Propagate Request ID

**File: `src/middleware/requestId.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

/**
 * Generate or extract request ID from headers
 */
export function generateRequestId(req: Request): string {
  // Check multiple header variants (some proxies use different names)
  const existingId =
    req.get('X-Request-ID') ||
    req.get('X-Request-Id') ||
    req.get('X-Correlation-ID') ||
    req.get('Request-ID');

  // Use existing ID or generate new UUID
  return existingId || uuidv4();
}

/**
 * Request ID middleware
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Generate or extract request ID
  const requestId = generateRequestId(req);
  req.id = requestId;

  // Track request start time
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  // Log request received
  logger.info('Request received', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;

    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });

  next();
};

/**
 * Add request ID to async context (for child operations)
 */
import { AsyncLocalStorage } from 'async_hooks';

export const asyncLocalStorage = new AsyncLocalStorage<{
  requestId: string;
}>();

export const asyncContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  asyncLocalStorage.run({ requestId: req.id }, () => {
    next();
  });
};

/**
 * Get current request ID from async context
 */
export function getCurrentRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId;
}
```

### Phase 2: Update Logger (20 minutes)

#### 2.1 Auto-Include Request ID in Logs

**File: `src/config/logger.ts`** (update existing)

```typescript
import winston from 'winston';
import { getCurrentRequestId } from '../middleware/requestId';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    // Automatically add request ID to all logs
    winston.format((info) => {
      const requestId = getCurrentRequestId();
      if (requestId) {
        info.requestId = requestId;
      }
      return info;
    })()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
          const requestIdStr = requestId ? `[${requestId}] ` : '';
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} ${level}: ${requestIdStr}${message} ${metaStr}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

export default logger;
```

### Phase 3: Database Query Tracing (45 minutes)

#### 3.1 Prisma Middleware

**File: `src/config/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import logger from './logger';
import { getCurrentRequestId } from '../middleware/requestId';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// Log queries with request ID
prisma.$on('query', (e) => {
  const requestId = getCurrentRequestId();

  logger.debug('Prisma query executed', {
    requestId,
    query: e.query,
    params: e.params,
    duration: e.duration,
    target: e.target,
  });

  // Warn on slow queries
  if (e.duration > 1000) {
    logger.warn('Slow Prisma query detected', {
      requestId,
      query: e.query,
      duration: e.duration,
    });
  }
});

prisma.$on('error', (e) => {
  const requestId = getCurrentRequestId();

  logger.error('Prisma error', {
    requestId,
    message: e.message,
    target: e.target,
  });
});

// Middleware to add request ID to queries (as comment)
prisma.$use(async (params, next) => {
  const requestId = getCurrentRequestId();
  const startTime = Date.now();

  try {
    const result = await next(params);
    const duration = Date.now() - startTime;

    logger.debug('Prisma operation completed', {
      requestId,
      model: params.model,
      action: params.action,
      duration,
    });

    return result;
  } catch (error) {
    logger.error('Prisma operation failed', {
      requestId,
      model: params.model,
      action: params.action,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
});

export default prisma;
```

#### 3.2 MongoDB Query Tracing

**File: `src/config/mongoose.ts`** (update existing)

```typescript
import mongoose from 'mongoose';
import logger from './logger';
import { getCurrentRequestId } from '../middleware/requestId';

// Enable MongoDB query logging
mongoose.set('debug', (collectionName: string, method: string, ...args: any[]) => {
  const requestId = getCurrentRequestId();

  logger.debug('MongoDB query executed', {
    requestId,
    collection: collectionName,
    method,
    args: JSON.stringify(args),
  });
});

// Connection event handlers with request ID
mongoose.connection.on('connected', () => {
  logger.info('MongoDB connected', {
    host: mongoose.connection.host,
    database: mongoose.connection.name,
  });
});

mongoose.connection.on('error', (error) => {
  const requestId = getCurrentRequestId();

  logger.error('MongoDB connection error', {
    requestId,
    error: error.message,
  });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

export default mongoose;
```

### Phase 4: External API Calls (30 minutes)

#### 4.1 HTTP Client with Request ID

**File: `src/utils/httpClient.ts`**

```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import logger from '../config/logger';
import { getCurrentRequestId } from '../middleware/requestId';

/**
 * Create HTTP client with request ID propagation
 */
export function createHttpClient(baseURL?: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 10000,
  });

  // Request interceptor - add request ID to headers
  client.interceptors.request.use(
    (config) => {
      const requestId = getCurrentRequestId();

      if (requestId) {
        config.headers['X-Request-ID'] = requestId;
        config.headers['X-Correlation-ID'] = requestId;
      }

      logger.debug('HTTP request sent', {
        requestId,
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
      });

      return config;
    },
    (error) => {
      const requestId = getCurrentRequestId();

      logger.error('HTTP request error', {
        requestId,
        error: error.message,
      });

      return Promise.reject(error);
    }
  );

  // Response interceptor - log response with request ID
  client.interceptors.response.use(
    (response) => {
      const requestId = getCurrentRequestId();

      logger.debug('HTTP response received', {
        requestId,
        status: response.status,
        url: response.config.url,
        duration: response.headers['x-response-time'],
      });

      return response;
    },
    (error) => {
      const requestId = getCurrentRequestId();

      logger.error('HTTP response error', {
        requestId,
        status: error.response?.status,
        url: error.config?.url,
        error: error.message,
      });

      return Promise.reject(error);
    }
  );

  return client;
}

// Default client instance
export const httpClient = createHttpClient();
```

### Phase 5: GraphQL Context (20 minutes)

#### 5.1 Add Request ID to GraphQL Context

**File: `src/graphql/context.ts`** (update existing)

```typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import prisma from '../config/prisma';
import { getCurrentRequestId } from '../middleware/requestId';

export interface GraphQLContext {
  prisma: PrismaClient;
  req: Request;
  res: Response;
  requestId: string;
}

export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<GraphQLContext> {
  return {
    prisma,
    req,
    res,
    requestId: req.id || getCurrentRequestId() || 'unknown',
  };
}
```

#### 5.2 Use Request ID in Resolvers

**File: `src/graphql/resolvers/todo.resolver.ts`** (example)

```typescript
import { GraphQLContext } from '../context';
import logger from '../../config/logger';

export const todoResolvers = {
  Query: {
    todos: async (
      _parent: any,
      args: { limit?: number; offset?: number },
      context: GraphQLContext
    ) => {
      logger.info('GraphQL query: todos', {
        requestId: context.requestId,
        args,
      });

      try {
        const todos = await context.prisma.todo.findMany({
          take: args.limit,
          skip: args.offset,
        });

        logger.info('GraphQL query completed', {
          requestId: context.requestId,
          count: todos.length,
        });

        return todos;
      } catch (error) {
        logger.error('GraphQL query failed', {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  },
};
```

### Phase 6: Apply Middleware (15 minutes)

#### 6.1 Update App Configuration

**File: `src/app.ts`**

```typescript
import express from 'express';
import { requestIdMiddleware, asyncContextMiddleware } from './middleware/requestId';

const app = express();

// ... existing middleware (helmet, cors, etc.)

// Request ID middleware (early in chain)
app.use(requestIdMiddleware);
app.use(asyncContextMiddleware);

// ... rest of middleware and routes

export default app;
```

### Phase 7: Testing (1 hour)

#### 7.1 Unit Tests

**File: `src/middleware/__tests__/requestId.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { generateRequestId, requestIdMiddleware, getCurrentRequestId } from '../requestId';

describe('Request ID Middleware', () => {
  describe('generateRequestId', () => {
    it('should use existing X-Request-ID header', () => {
      const req = {
        get: vi.fn().mockReturnValue('existing-id'),
      } as any;

      const id = generateRequestId(req);
      expect(id).toBe('existing-id');
    });

    it('should generate new UUID if no header present', () => {
      const req = {
        get: vi.fn().mockReturnValue(undefined),
      } as any;

      const id = generateRequestId(req);
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should check multiple header variants', () => {
      const req = {
        get: vi.fn().mockReturnValueOnce(undefined).mockReturnValueOnce('correlation-id'),
      } as any;

      const id = generateRequestId(req);
      expect(id).toBe('correlation-id');
    });
  });

  describe('requestIdMiddleware', () => {
    it('should attach request ID to req object', () => {
      const req = {
        get: vi.fn().mockReturnValue(undefined),
        method: 'GET',
        path: '/test',
        ip: '127.0.0.1',
      } as any;

      const res = {
        setHeader: vi.fn(),
        on: vi.fn(),
      } as any;

      const next = vi.fn();

      requestIdMiddleware(req, res, next);

      expect(req.id).toBeDefined();
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.id);
      expect(next).toHaveBeenCalled();
    });

    it('should log request completion', () => {
      const req = {
        get: vi.fn().mockReturnValue('test-id'),
        method: 'GET',
        path: '/test',
        ip: '127.0.0.1',
      } as any;

      const listeners: any = {};
      const res = {
        setHeader: vi.fn(),
        on: vi.fn((event, callback) => {
          listeners[event] = callback;
        }),
        statusCode: 200,
      } as any;

      const next = vi.fn();

      requestIdMiddleware(req, res, next);

      // Trigger finish event
      listeners.finish();

      // Logger should have been called (test with spy if needed)
    });
  });
});
```

#### 7.2 Integration Tests

**File: `src/__tests__/requestId.integration.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Request ID Integration', () => {
  describe('Header Propagation', () => {
    it('should generate request ID if not provided', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it('should use provided X-Request-ID header', async () => {
      const customId = 'my-custom-request-id';

      const response = await request(app).get('/api/health').set('X-Request-ID', customId);

      expect(response.headers['x-request-id']).toBe(customId);
    });

    it('should propagate request ID through nested operations', async () => {
      const customId = 'nested-request-id';

      const response = await request(app).post('/api/v1/todos').set('X-Request-ID', customId).send({
        title: 'Test Todo',
        completed: false,
      });

      expect(response.headers['x-request-id']).toBe(customId);
    });
  });

  describe('Log Correlation', () => {
    it('should include request ID in error responses', async () => {
      const customId = 'error-request-id';

      const response = await request(app)
        .get('/api/v1/todos/invalid-id')
        .set('X-Request-ID', customId)
        .expect(400);

      expect(response.headers['x-request-id']).toBe(customId);
      // Error response should include request ID for debugging
    });
  });
});
```

---

## Log Output Examples

### Without Request ID (Before)

```
2025-11-12T10:30:00.000Z info: Request received { method: 'GET', path: '/api/todos' }
2025-11-12T10:30:00.015Z info: Database query executed { query: 'SELECT * FROM todos' }
2025-11-12T10:30:00.025Z info: Request completed { statusCode: 200 }
```

### With Request ID (After)

```
2025-11-12T10:30:00.000Z info: [a1b2c3d4-e5f6-4789-0abc-def123456789] Request received { method: 'GET', path: '/api/todos' }
2025-11-12T10:30:00.015Z info: [a1b2c3d4-e5f6-4789-0abc-def123456789] Database query executed { query: 'SELECT * FROM todos' }
2025-11-12T10:30:00.025Z info: [a1b2c3d4-e5f6-4789-0abc-def123456789] Request completed { statusCode: 200 }
```

### Error Tracing Example

```
2025-11-12T10:31:00.000Z info: [xyz123] Request received { method: 'POST', path: '/api/todos' }
2025-11-12T10:31:00.005Z debug: [xyz123] Prisma operation started { model: 'Todo', action: 'create' }
2025-11-12T10:31:00.010Z error: [xyz123] Prisma operation failed { model: 'Todo', error: 'Unique constraint violation' }
2025-11-12T10:31:00.012Z error: [xyz123] Request failed { statusCode: 400, error: 'Todo already exists' }
2025-11-12T10:31:00.015Z info: [xyz123] Request completed { statusCode: 400, duration: 15 }
```

---

## Integration with APM Tools

### Datadog

**File: `src/config/datadog.ts`**

```typescript
import tracer from 'dd-trace';
import { getCurrentRequestId } from '../middleware/requestId';

tracer.init({
  logInjection: true,
});

// Add request ID to Datadog traces
tracer.use('express', {
  hooks: {
    request: (span, req) => {
      span.setTag('request.id', req.id || getCurrentRequestId());
    },
  },
});
```

### New Relic

**File: `src/config/newrelic.ts`**

```typescript
import newrelic from 'newrelic';
import { getCurrentRequestId } from '../middleware/requestId';

// Add request ID to New Relic transactions
export function addRequestIdToTransaction(req: any): void {
  const requestId = req.id || getCurrentRequestId();
  if (requestId) {
    newrelic.addCustomAttribute('requestId', requestId);
  }
}
```

---

## Files to Create/Update

| File                          | Action | Priority |
| ----------------------------- | ------ | -------- |
| `src/middleware/requestId.ts` | Create | High     |
| `src/config/logger.ts`        | Update | High     |
| `src/config/prisma.ts`        | Update | High     |
| `src/config/mongoose.ts`      | Update | High     |
| `src/utils/httpClient.ts`     | Create | High     |
| `src/graphql/context.ts`      | Update | High     |
| `src/app.ts`                  | Update | High     |
| `package.json`                | Update | High     |

---

## Dependencies

```bash
npm install uuid
npm install --save-dev @types/uuid
```

---

## Best Practices

**DO:**

- Generate request ID early in middleware chain
- Propagate to all downstream services
- Include in all log statements
- Use UUID v4 format
- Accept existing request IDs from upstream
- Return request ID in error responses

**DON'T:**

- Regenerate request ID within same request
- Use sequential IDs (security risk)
- Skip request ID in async operations
- Forget to propagate to external APIs

---

## Resources

- [Correlation IDs for Microservices](https://www.rapid7.com/blog/post/2016/12/23/the-value-of-correlation-ids/)
- [Distributed Tracing Best Practices](https://opentelemetry.io/docs/concepts/observability-primer/)

**Status:** Ready for Implementation  
**Estimated Time:** 3-4 hours  
**Last Updated:** November 12, 2025
