# Backend Stack Enhancements

This document describes the newly implemented features and middleware to improve the backend stack.

## Overview

The following enhancements have been added to improve security, performance, observability, and developer experience:

1. **Rate Limiting** - Prevent API abuse
2. **Advanced Security Headers** - Enhanced helmet configuration
3. **Response Compression** - Reduce bandwidth usage
4. **Swagger/OpenAPI Documentation** - Interactive API docs
5. **Sentry Error Tracking** - Production error monitoring
6. **DataLoader** - GraphQL N+1 problem solver
7. **BullMQ Job Queues** - Background job processing
8. **Zod Validation** - Runtime type validation

## 1. Rate Limiting

**File:** `src/middleware/rateLimiter.ts`

Multiple rate limiters configured for different use cases:

### API Limiter

- **Limit:** 100 requests per 15 minutes per IP
- **Usage:** Applied to all `/api/*` routes
- Suitable for general API endpoints

### Auth Limiter

- **Limit:** 5 requests per 15 minutes per IP
- **Usage:** Should be applied to login/register endpoints
- Prevents brute force attacks

### GraphQL Limiter

- **Limit:** 50 requests per 15 minutes per IP
- **Usage:** Applied to `/graphql` endpoint
- Protects against expensive queries

### Mutation Limiter

- **Limit:** 20 requests per 15 minutes per IP
- **Usage:** For write-heavy operations
- Prevents data manipulation abuse

**Example Usage:**

```typescript
import { authLimiter } from './middleware/rateLimiter';

app.post('/api/auth/login', authLimiter, loginController);
```

## 2. Security Headers

**File:** `src/middleware/security.ts`

Enhanced security headers using Helmet:

### Features

- **Content Security Policy** - Prevents XSS attacks
- **HSTS** - Force HTTPS connections
- **X-Frame-Options** - Prevent clickjacking
- **X-Content-Type-Options** - Prevent MIME sniffing
- **Referrer Policy** - Control referrer information
- **Permissions Policy** - Control browser features

### CORS Configuration

```typescript
{
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'RateLimit-Limit', 'RateLimit-Remaining'],
  maxAge: 86400, // 24 hours
}
```

**Already Integrated:** Applied in `src/app.ts`

## 3. Response Compression

**File:** `src/middleware/compression.ts`

Gzip compression for all responses:

### Configuration

- **Level:** 6 (balanced compression/speed)
- **Threshold:** 1KB minimum size
- **Filtered:** Skips event streams and when client doesn't support

### Benefits

- Reduces bandwidth usage by 60-80%
- Faster page loads
- Lower hosting costs

**Already Integrated:** Applied in `src/app.ts`

## 4. Swagger/OpenAPI Documentation

**File:** `src/config/swagger.ts`

Interactive API documentation with Swagger UI:

### Features

- OpenAPI 3.0 specification
- JWT Bearer authentication support
- Request/response examples
- Type schemas for all models
- Try-it-out functionality

### Accessing Docs

- **Development:** http://localhost:4000/api-docs
- **Production:** https://your-domain.com/api-docs

### Documenting Routes

Use JSDoc comments in your route files:

```typescript
/**
 * @swagger
 * /api/todos:
 *   get:
 *     summary: Get all todos
 *     tags: [Todos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of todos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedTodos'
 */
```

## 5. Sentry Error Tracking

**File:** `src/config/sentry.ts`

Production-grade error monitoring and performance tracking:

### Configuration

Set the following environment variable:

```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

### Features

- Automatic error capture
- Performance monitoring
- Request tracing
- User context tracking
- Breadcrumb logging
- Sensitive data filtering

### Usage

```typescript
import { reportError, setSentryUser, addSentryBreadcrumb } from './config/sentry';

// Manual error reporting
try {
  // risky operation
} catch (error) {
  reportError(error, { userId: '123', operation: 'create-todo' });
}

// Set user context
setSentryUser({ id: user.id, email: user.email });

// Add breadcrumb for debugging
addSentryBreadcrumb('User clicked button', 'ui.click', { buttonId: 'submit' });
```

**Already Integrated:** Initialized in `src/app.ts`

## 6. DataLoader (GraphQL)

**File:** `src/config/dataloader.ts`

Solves the N+1 query problem in GraphQL resolvers:

### Features

- Batch loading of todos by ID
- Request-scoped caching
- Configurable batch size (100)
- 10ms batching window

### Usage in GraphQL Context

```typescript
import { createDataLoaders } from './config/dataloader';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => ({
    todoRepository,
    loaders: createDataLoaders(todoRepository),
  }),
});
```

### Usage in Resolvers

```typescript
const resolvers = {
  Query: {
    todo: async (_parent, { id }, context) => {
      // Uses DataLoader - batches and caches
      return context.loaders.todoLoader.load(id);
    },
  },
  User: {
    todos: async (parent, _args, context) => {
      // Prevents N+1 queries when fetching todos for multiple users
      return context.loaders.todosLoader.load(parent.id);
    },
  },
};
```

## 7. BullMQ Job Queues

**File:** `src/config/queues.ts`

Background job processing with Redis-backed queues:

### Queues

1. **Email Queue** - Send emails asynchronously
2. **Notification Queue** - Push/SMS/Email notifications
3. **Data Processing Queue** - Heavy computations

### Features

- Automatic retries with exponential backoff
- Job prioritization
- Rate limiting per queue
- Job completion/failure events
- Redis persistence

### Configuration

Set Redis connection in `.env`:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
```

### Usage

```typescript
import { queueEmail, queueNotification, queueDataProcessing } from './config/queues';

// Queue an email
await queueEmail(
  {
    to: 'user@example.com',
    subject: 'Welcome!',
    body: 'Thank you for signing up',
    template: 'welcome',
  },
  { delay: 5000 }
); // Send after 5 seconds

// Queue a notification
await queueNotification({
  userId: '123',
  message: 'Your todo was completed',
  type: 'push',
});

// Queue data processing
await queueDataProcessing({
  dataId: 'abc123',
  operation: 'analyze',
  params: { depth: 5 },
});
```

### Monitoring

Workers automatically log job progress:

- Job started
- Job completed
- Job failed (with reason)

## 8. Zod Validation

**File:** `src/middleware/validation.ts`

Runtime type validation for request data:

### Features

- Type-safe validation schemas
- Automatic error formatting
- Reusable validation middleware
- TypeScript type inference

### Available Schemas

- `createTodoSchema` - Validate todo creation
- `updateTodoSchema` - Validate todo updates
- `getTodoSchema` - Validate ID parameter
- `deleteTodoSchema` - Validate ID parameter
- `listTodosSchema` - Validate pagination params
- `registerUserSchema` - Validate user registration
- `loginUserSchema` - Validate user login

### Usage in Routes

```typescript
import { validate, createTodoSchema } from './middleware/validation';

router.post('/todos', validate(createTodoSchema), createTodoController);
```

### Error Response Format

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "body.title",
      "message": "Title is required",
      "code": "invalid_type"
    }
  ]
}
```

### Creating Custom Schemas

```typescript
import { z } from 'zod';

export const customSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    age: z.number().int().positive().max(120),
    email: z.string().email(),
  }),
});

// Use in route
app.post('/endpoint', validate(customSchema), handler);
```

## Environment Variables

Add the following to your `.env` file:

```bash
# Sentry (optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Redis (required for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS
CORS_ORIGIN=http://localhost:5173

# API
API_URL=http://localhost:4000
```

## Integration Checklist

- [x] Rate limiting middleware created
- [x] Security headers configured
- [x] Compression enabled
- [x] Swagger documentation enhanced
- [x] Sentry error tracking configured
- [x] DataLoader for GraphQL created
- [x] BullMQ queues set up
- [x] Zod validation schemas created
- [x] Middleware integrated in app.ts

## Next Steps

1. **Apply validation to routes**
   - Add `validate()` middleware to all route handlers
   - Replace manual validation with Zod schemas

2. **Integrate DataLoader**
   - Add DataLoader to GraphQL context
   - Update resolvers to use loaders

3. **Set up Sentry**
   - Create Sentry project
   - Add SENTRY_DSN to .env
   - Test error reporting

4. **Configure Redis**
   - Install and run Redis
   - Update Redis connection settings
   - Test job queues

5. **Document API endpoints**
   - Add Swagger annotations to all routes
   - Test API docs at /api-docs

6. **Monitor performance**
   - Check Sentry performance metrics
   - Monitor queue job completion rates
   - Review rate limit logs

## Performance Impact

Expected improvements:

- **Bandwidth:** 60-80% reduction (compression)
- **Security:** Multiple layers of protection
- **GraphQL:** 10-100x faster with DataLoader
- **Reliability:** Background jobs don't block requests
- **Developer Experience:** Type-safe validation + interactive docs

## Dependencies Added

```json
{
  "dependencies": {
    "express-rate-limit": "^7.x",
    "helmet": "^8.x",
    "compression": "^1.x",
    "swagger-ui-express": "^5.x",
    "swagger-jsdoc": "^6.x",
    "@sentry/node": "^8.x",
    "@sentry/profiling-node": "^8.x",
    "dataloader": "^2.x",
    "bullmq": "^5.x",
    "ioredis": "^5.x",
    "zod": "^3.x"
  }
}
```

## Troubleshooting

### Rate Limiting Issues

- Check IP forwarding configuration
- Adjust limits in `rateLimiter.ts`
- Use Redis for distributed rate limiting

### Sentry Not Reporting

- Verify SENTRY_DSN is set
- Check NODE_ENV setting
- Review beforeSend hook filters

### Queue Jobs Not Processing

- Ensure Redis is running
- Check Redis connection settings
- Verify workers are started
- Review worker concurrency settings

### Validation Errors

- Check schema definitions
- Verify request format matches schema
- Review error details in response

## Support

For issues or questions:

1. Check this documentation
2. Review implementation files
3. Check package documentation
4. Open an issue in the repository
