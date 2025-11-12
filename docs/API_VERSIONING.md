# API Versioning Strategy

## Overview

Implement URL-based API versioning to support backward compatibility and graceful API evolution without breaking existing clients.

## Versioning Strategy

### Approach: URL Path Versioning

**Format:** `/api/v{version}/{resource}`

**Examples:**

- `/api/v1/todos`
- `/api/v2/todos`
- `/api/v1/users`

### Why URL Path Versioning?

**Pros:**

- Explicit and visible in API calls
- Easy to understand and implement
- RESTful and widely adopted
- Works well with API gateways and proxies
- Easy to cache different versions separately
- Clear documentation per version

**Alternatives Considered:**

**Header Versioning** (`Accept: application/vnd.api+json; version=1`)

- Harder to test (requires header manipulation)
- Less discoverable
- Not visible in browser address bar

**Query Parameter** (`/api/todos?version=1`)

- Can conflict with other query parameters
- Less clean URLs
- Not RESTful convention

---

## Implementation Plan

### Phase 1: Create Versioning Middleware (30 minutes)

#### 1.1 Version Router

**File: `src/middleware/apiVersion.ts`**

```typescript
import { Request, Response, NextFunction, Router } from 'express';
import logger from '../config/logger';

export type ApiVersion = 'v1' | 'v2';

/**
 * Extract API version from request path
 */
export function getApiVersion(req: Request): ApiVersion | null {
  const match = req.path.match(/^\/api\/(v\d+)\//);
  return match ? (match[1] as ApiVersion) : null;
}

/**
 * Middleware to attach version to request
 */
export const apiVersionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const version = getApiVersion(req);

  if (version) {
    (req as any).apiVersion = version;
    logger.debug('API version detected', {
      version,
      path: req.path,
    });
  }

  next();
};

/**
 * Create versioned router
 */
export function createVersionedRouter(version: ApiVersion): Router {
  const router = Router();

  // Add version to all responses
  router.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-API-Version', version);
    next();
  });

  return router;
}

/**
 * Deprecation warning middleware
 */
export function deprecationWarning(
  version: ApiVersion,
  deprecationDate: string,
  sunsetDate: string
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Deprecation', deprecationDate);
    res.setHeader('Sunset', sunsetDate);
    res.setHeader('Link', `</api/${version}/docs>; rel="deprecation"; type="text/html"`);

    logger.warn('Deprecated API version accessed', {
      version,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    next();
  };
}

/**
 * Version not supported handler
 */
export const unsupportedVersionHandler = (req: Request, res: Response): void => {
  const version = getApiVersion(req);

  logger.warn('Unsupported API version requested', {
    version,
    path: req.path,
    ip: req.ip,
  });

  res.status(400).json({
    error: 'Unsupported API version',
    version: version || 'unknown',
    supportedVersions: ['v1', 'v2'],
    message: 'Please use a supported API version: /api/v1/ or /api/v2/',
    documentation: process.env.API_DOCS_URL || '/api/docs',
  });
};
```

### Phase 2: Organize Routes by Version (1 hour)

#### 2.1 Version 1 Routes

**File: `src/routes/v1/index.ts`**

```typescript
import { Router } from 'express';
import todosRoutes from './todos.routes';
import healthRoutes from './health.routes';

const router = Router();

// V1 routes
router.use('/todos', todosRoutes);
router.use('/health', healthRoutes);

export default router;
```

**File: `src/routes/v1/todos.routes.ts`**

```typescript
import { Router } from 'express';
import { todoValidators } from '../../middleware/validators';
import { handleValidationErrors } from '../../middleware/validationHandler';
import * as todoController from '../../controllers/todo.controller';

const router = Router();

/**
 * @api {get} /api/v1/todos List all todos
 * @apiVersion 1.0.0
 */
router.get('/', todoValidators.list, handleValidationErrors, todoController.listTodos);

/**
 * @api {post} /api/v1/todos Create a new todo
 * @apiVersion 1.0.0
 */
router.post('/', todoValidators.create, handleValidationErrors, todoController.createTodo);

/**
 * @api {get} /api/v1/todos/:id Get a todo by ID
 * @apiVersion 1.0.0
 */
router.get('/:id', todoValidators.getOne, handleValidationErrors, todoController.getTodo);

/**
 * @api {put} /api/v1/todos/:id Update a todo
 * @apiVersion 1.0.0
 */
router.put('/:id', todoValidators.update, handleValidationErrors, todoController.updateTodo);

/**
 * @api {delete} /api/v1/todos/:id Delete a todo
 * @apiVersion 1.0.0
 */
router.delete('/:id', todoValidators.delete, handleValidationErrors, todoController.deleteTodo);

export default router;
```

#### 2.2 Version 2 Routes (Future)

**File: `src/routes/v2/index.ts`**

```typescript
import { Router } from 'express';
import todosRoutes from './todos.routes';
import healthRoutes from './health.routes';

const router = Router();

// V2 routes with breaking changes
router.use('/todos', todosRoutes);
router.use('/health', healthRoutes);

export default router;
```

**File: `src/routes/v2/todos.routes.ts`**

```typescript
import { Router } from 'express';
import { todoValidators } from '../../middleware/validators';
import { handleValidationErrors } from '../../middleware/validationHandler';
import * as todoController from '../../controllers/todo.controller';

const router = Router();

/**
 * @api {get} /api/v2/todos List all todos
 * @apiVersion 2.0.0
 * @apiDescription V2 includes pagination metadata in response
 */
router.get(
  '/',
  todoValidators.list,
  handleValidationErrors,
  todoController.listTodosV2 // Different controller with enhanced response
);

/**
 * @api {post} /api/v2/todos Create a new todo
 * @apiVersion 2.0.0
 * @apiDescription V2 supports tags and priority fields
 */
router.post(
  '/',
  todoValidators.createV2, // Enhanced validation
  handleValidationErrors,
  todoController.createTodoV2
);

// ... other routes with V2 enhancements

export default router;
```

### Phase 3: Update Application Configuration (30 minutes)

#### 3.1 Main Router

**File: `src/app.ts`**

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

// Versioning middleware
import {
  apiVersionMiddleware,
  unsupportedVersionHandler,
  deprecationWarning,
} from './middleware/apiVersion';

// Version routers
import v1Router from './routes/v1';
import v2Router from './routes/v2';

const app = express();

// ... existing middleware (helmet, cors, body parsing, etc.)

// API versioning middleware
app.use(apiVersionMiddleware);

// Mount version routers
app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// Default to latest version for backward compatibility
app.use('/api', (req, res, next) => {
  // Redirect unversioned requests to v1 (or latest stable)
  const newPath = `/api/v1${req.path}`;
  logger.info('Redirecting unversioned API request', {
    originalPath: req.path,
    newPath,
  });
  req.url = newPath;
  next();
});

// Handle unsupported versions
app.use('/api/*', unsupportedVersionHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

export default app;
```

#### 3.2 Environment Configuration

**File: `.env.example`**

```bash
# API Configuration
API_VERSION_DEFAULT=v1
API_VERSION_LATEST=v2

# Deprecation dates (ISO 8601)
API_V1_DEPRECATION_DATE=2026-06-01
API_V1_SUNSET_DATE=2026-12-01
```

### Phase 4: Version-Specific Controllers (1 hour)

**File: `src/controllers/todo.controller.ts`**

```typescript
import { Request, Response } from 'express';
import { todoService } from '../services/todo.service';
import logger from '../config/logger';

/**
 * V1: List todos - Simple response
 */
export async function listTodos(req: Request, res: Response): Promise<void> {
  try {
    const { page = 1, limit = 10, completed } = req.query;

    const todos = await todoService.findAll({
      page: Number(page),
      limit: Number(limit),
      completed: completed ? Boolean(completed) : undefined,
    });

    // V1 format: Simple array
    res.json(todos);
  } catch (error) {
    logger.error('Error listing todos', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * V2: List todos - Enhanced response with pagination metadata
 */
export async function listTodosV2(req: Request, res: Response): Promise<void> {
  try {
    const { page = 1, limit = 10, completed } = req.query;

    const result = await todoService.findAllWithMeta({
      page: Number(page),
      limit: Number(limit),
      completed: completed ? Boolean(completed) : undefined,
    });

    // V2 format: Enhanced with metadata
    res.json({
      data: result.todos,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      links: {
        self: `/api/v2/todos?page=${result.page}&limit=${result.limit}`,
        first: `/api/v2/todos?page=1&limit=${result.limit}`,
        last: `/api/v2/todos?page=${Math.ceil(result.total / result.limit)}&limit=${result.limit}`,
        next:
          result.page < Math.ceil(result.total / result.limit)
            ? `/api/v2/todos?page=${result.page + 1}&limit=${result.limit}`
            : null,
        prev:
          result.page > 1 ? `/api/v2/todos?page=${result.page - 1}&limit=${result.limit}` : null,
      },
    });
  } catch (error) {
    logger.error('Error listing todos V2', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * V1: Create todo
 */
export async function createTodo(req: Request, res: Response): Promise<void> {
  try {
    const { title, completed = false } = req.body;

    const todo = await todoService.create({ title, completed });

    res.status(201).json(todo);
  } catch (error) {
    logger.error('Error creating todo', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * V2: Create todo with enhanced fields
 */
export async function createTodoV2(req: Request, res: Response): Promise<void> {
  try {
    const { title, completed = false, tags = [], priority = 'medium' } = req.body;

    const todo = await todoService.create({
      title,
      completed,
      tags, // V2 feature
      priority, // V2 feature
    });

    // V2 response includes metadata
    res.status(201).json({
      data: todo,
      meta: {
        version: 'v2',
        created: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error creating todo V2', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Phase 5: Testing (1.5 hours)

#### 5.1 Unit Tests

**File: `src/middleware/__tests__/apiVersion.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';
import { getApiVersion, apiVersionMiddleware, unsupportedVersionHandler } from '../apiVersion';

describe('API Versioning', () => {
  describe('getApiVersion', () => {
    it('should extract v1 from path', () => {
      const req = { path: '/api/v1/todos' } as Request;
      expect(getApiVersion(req)).toBe('v1');
    });

    it('should extract v2 from path', () => {
      const req = { path: '/api/v2/users/123' } as Request;
      expect(getApiVersion(req)).toBe('v2');
    });

    it('should return null for unversioned path', () => {
      const req = { path: '/api/todos' } as Request;
      expect(getApiVersion(req)).toBeNull();
    });

    it('should return null for invalid version', () => {
      const req = { path: '/api/v999/todos' } as Request;
      expect(getApiVersion(req)).toBeNull();
    });
  });

  describe('apiVersionMiddleware', () => {
    it('should attach version to request', () => {
      const req = { path: '/api/v1/todos' } as any;
      const res = {} as Response;
      const next = vi.fn();

      apiVersionMiddleware(req, res, next);

      expect(req.apiVersion).toBe('v1');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('unsupportedVersionHandler', () => {
    it('should return 400 for unsupported version', () => {
      const req = { path: '/api/v99/todos', ip: '127.0.0.1' } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      unsupportedVersionHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unsupported API version',
          supportedVersions: ['v1', 'v2'],
        })
      );
    });
  });
});
```

#### 5.2 Integration Tests

**File: `src/__tests__/versioning.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('API Versioning Integration', () => {
  describe('Version Headers', () => {
    it('should include X-API-Version header in V1 response', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.headers['x-api-version']).toBe('v1');
    });

    it('should include X-API-Version header in V2 response', async () => {
      const response = await request(app).get('/api/v2/health');

      expect(response.headers['x-api-version']).toBe('v2');
    });
  });

  describe('Version Routing', () => {
    it('should route V1 requests correctly', async () => {
      const response = await request(app).get('/api/v1/todos').expect(200);

      // V1 returns simple array
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should route V2 requests correctly', async () => {
      const response = await request(app).get('/api/v2/todos').expect(200);

      // V2 returns object with data and pagination
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('links');
    });
  });

  describe('Unversioned Requests', () => {
    it('should redirect unversioned requests to default version', async () => {
      const response = await request(app).get('/api/todos').expect(200);

      expect(response.headers['x-api-version']).toBe('v1');
    });
  });

  describe('Unsupported Versions', () => {
    it('should return 400 for unsupported version', async () => {
      const response = await request(app).get('/api/v99/todos').expect(400);

      expect(response.body.error).toContain('Unsupported API version');
      expect(response.body.supportedVersions).toContain('v1');
      expect(response.body.supportedVersions).toContain('v2');
    });
  });

  describe('Version-Specific Features', () => {
    it('V1 should accept simple todo creation', async () => {
      const response = await request(app)
        .post('/api/v1/todos')
        .send({
          title: 'Test Todo V1',
          completed: false,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Todo V1');
    });

    it('V2 should accept todo creation with tags and priority', async () => {
      const response = await request(app)
        .post('/api/v2/todos')
        .send({
          title: 'Test Todo V2',
          completed: false,
          tags: ['work', 'urgent'],
          priority: 'high',
        })
        .expect(201);

      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('tags');
      expect(response.body.data).toHaveProperty('priority');
      expect(response.body).toHaveProperty('meta');
    });
  });
});
```

---

## Version Lifecycle Management

### Stage 1: Active Development

- Full support and new features
- Breaking changes allowed with version bump
- Current: **v2**

### Stage 2: Maintenance Mode

- Bug fixes and security patches only
- No new features
- Deprecation warnings in responses
- Example: **v1** (as of June 2026)

### Stage 3: Deprecated

- Security patches only
- Strong deprecation warnings
- Sunset date announced
- Example: **v1** (after Dec 2026)

### Stage 4: Sunset

- Version removed from service
- 410 Gone responses
- Redirect to migration guide

---

## Migration Guide Template

**File: `docs/MIGRATION_V1_TO_V2.md`**

````markdown
# Migration Guide: API v1 → v2

## Breaking Changes

### 1. List Todos Response Format

**V1 Response:**

```json
[
  { "id": "1", "title": "Todo 1", "completed": false },
  { "id": "2", "title": "Todo 2", "completed": true }
]
```
````

**V2 Response:**

```json
{
  "data": [
    { "id": "1", "title": "Todo 1", "completed": false },
    { "id": "2", "title": "Todo 2", "completed": true }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPages": 1
  },
  "links": {
    "self": "/api/v2/todos?page=1&limit=10",
    "first": "/api/v2/todos?page=1&limit=10",
    "last": "/api/v2/todos?page=1&limit=10",
    "next": null,
    "prev": null
  }
}
```

**Migration:** Update response parsing to extract `data` property.

### 2. Create Todo Request

**V1 Request:**

```json
{
  "title": "New Todo",
  "completed": false
}
```

**V2 Request (backward compatible):**

```json
{
  "title": "New Todo",
  "completed": false,
  "tags": ["work", "urgent"],
  "priority": "high"
}
```

**Migration:** V2 accepts V1 format. Add optional fields when ready.

## Timeline

- **Now:** V1 active, V2 available
- **June 2026:** V1 deprecated (warnings added)
- **December 2026:** V1 sunset (removed)

```

---

## Files to Create/Update

| File | Action | Priority |
|------|--------|----------|
| `src/middleware/apiVersion.ts` | Create | High |
| `src/routes/v1/index.ts` | Create | High |
| `src/routes/v1/todos.routes.ts` | Create | High |
| `src/routes/v2/index.ts` | Create | High |
| `src/routes/v2/todos.routes.ts` | Create | High |
| `src/controllers/todo.controller.ts` | Update | High |
| `src/app.ts` | Update | High |
| `.env.example` | Update | Medium |
| `docs/MIGRATION_V1_TO_V2.md` | Create | Medium |

---

## Best Practices

**DO:**
- Use semantic versioning
- Maintain at least 2 versions simultaneously
- Announce deprecations 6+ months in advance
- Provide migration guides
- Use deprecation headers
- Version all APIs, not just breaking changes

**DON'T:**
- Remove old versions without warning
- Make breaking changes without version bump
- Support too many versions (max 2-3)
- Use version numbers in code logic (use feature flags)

---

## Resources

- [REST API Versioning Best Practices](https://restfulapi.net/versioning/)
- [Stripe API Versioning](https://stripe.com/docs/api/versioning)
- [GitHub API Versioning](https://docs.github.com/en/rest/overview/api-versions)

**Status:** Ready for Implementation
**Estimated Time:** 4-5 hours
**Last Updated:** November 12, 2025
```
