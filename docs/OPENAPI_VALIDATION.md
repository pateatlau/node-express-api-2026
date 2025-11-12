# OpenAPI Schema Validation

## Overview

Implement runtime contract testing with OpenAPI 3.0 specification validation to ensure API requests and responses match documented schemas, preventing contract drift.

## Benefits

- **Contract Enforcement** - API matches documentation
- **Automatic Validation** - Request/response validation at runtime
- **API Documentation** - Single source of truth (schema = docs)
- **Client Generation** - Auto-generate TypeScript/SDK clients
- **Testing** - Contract testing without manual assertions
- **Breaking Change Detection** - Catch schema violations early

---

## Implementation Plan

### Phase 1: Create OpenAPI Specification (1 hour)

#### 1.1 Base OpenAPI Schema

**File: `openapi/schema.yaml`**

```yaml
openapi: 3.0.3
info:
  title: Todo API
  version: 1.0.0
  description: |
    A modern RESTful API for managing todos with PostgreSQL and MongoDB backends.

    ## Features
    - RESTful endpoints
    - GraphQL API
    - JWT authentication
    - Request validation
    - Health checks
    - API versioning

  contact:
    name: API Support
    email: support@example.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: http://localhost:3000
    description: Development server
  - url: https://api.example.com
    description: Production server

tags:
  - name: Todos
    description: Todo management operations
  - name: Health
    description: Health check endpoints
  - name: Auth
    description: Authentication endpoints

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token from /auth/login

  schemas:
    Todo:
      type: object
      required:
        - id
        - title
        - completed
        - createdAt
      properties:
        id:
          type: string
          format: uuid
          description: Unique identifier
          example: 'a1b2c3d4-e5f6-4789-0abc-def123456789'
        title:
          type: string
          minLength: 1
          maxLength: 500
          description: Todo title
          example: 'Complete API documentation'
        completed:
          type: boolean
          description: Completion status
          example: false
        createdAt:
          type: string
          format: date-time
          description: Creation timestamp
          example: '2025-11-12T10:30:00.000Z'
        updatedAt:
          type: string
          format: date-time
          description: Last update timestamp
          example: '2025-11-12T10:30:00.000Z'

    CreateTodoRequest:
      type: object
      required:
        - title
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 500
          example: 'New Todo'
        completed:
          type: boolean
          default: false
          example: false

    UpdateTodoRequest:
      type: object
      minProperties: 1
      properties:
        title:
          type: string
          minLength: 1
          maxLength: 500
          example: 'Updated Todo'
        completed:
          type: boolean
          example: true

    TodoList:
      type: array
      items:
        $ref: '#/components/schemas/Todo'

    Error:
      type: object
      required:
        - error
      properties:
        error:
          type: string
          description: Error message
          example: 'Resource not found'
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
              value:
                type: string
        requestId:
          type: string
          format: uuid
          description: Request ID for tracing

    HealthCheck:
      type: object
      required:
        - status
        - timestamp
        - uptime
        - databases
      properties:
        status:
          type: string
          enum: [healthy, degraded, unhealthy]
          example: 'healthy'
        timestamp:
          type: string
          format: date-time
          example: '2025-11-12T10:30:00.000Z'
        uptime:
          type: number
          description: Server uptime in seconds
          example: 3600.5
        databases:
          type: object
          properties:
            postgres:
              $ref: '#/components/schemas/DatabaseHealth'
            mongodb:
              $ref: '#/components/schemas/DatabaseHealth'

    DatabaseHealth:
      type: object
      required:
        - name
        - status
        - responseTime
      properties:
        name:
          type: string
          example: 'PostgreSQL'
        status:
          type: string
          enum: [connected, disconnected, connecting, error]
          example: 'connected'
        responseTime:
          type: number
          description: Response time in milliseconds
          example: 15
        details:
          type: object
          properties:
            host:
              type: string
            database:
              type: string
            error:
              type: string

paths:
  /api/v1/todos:
    get:
      tags:
        - Todos
      summary: List all todos
      description: Retrieve a list of todos with optional filtering and pagination
      operationId: listTodos
      parameters:
        - name: page
          in: query
          description: Page number
          schema:
            type: integer
            minimum: 1
            default: 1
        - name: limit
          in: query
          description: Items per page
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 10
        - name: completed
          in: query
          description: Filter by completion status
          schema:
            type: boolean
        - name: search
          in: query
          description: Search term
          schema:
            type: string
            maxLength: 100
      responses:
        '200':
          description: Successful response
          headers:
            X-Request-ID:
              schema:
                type: string
                format: uuid
              description: Request ID for tracing
            X-API-Version:
              schema:
                type: string
              description: API version
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TodoList'
        '400':
          description: Invalid request parameters
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    post:
      tags:
        - Todos
      summary: Create a new todo
      description: Create a new todo item
      operationId: createTodo
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTodoRequest'
      responses:
        '201':
          description: Todo created successfully
          headers:
            X-Request-ID:
              schema:
                type: string
                format: uuid
            Location:
              schema:
                type: string
              description: URL of created resource
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Todo'
        '400':
          description: Invalid request body
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /api/v1/todos/{id}:
    parameters:
      - name: id
        in: path
        required: true
        description: Todo ID
        schema:
          type: string

    get:
      tags:
        - Todos
      summary: Get a todo by ID
      operationId: getTodo
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Todo'
        '404':
          description: Todo not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    put:
      tags:
        - Todos
      summary: Update a todo
      operationId: updateTodo
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateTodoRequest'
      responses:
        '200':
          description: Todo updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Todo'
        '404':
          description: Todo not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '400':
          description: Invalid request body
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    delete:
      tags:
        - Todos
      summary: Delete a todo
      operationId: deleteTodo
      responses:
        '204':
          description: Todo deleted successfully
        '404':
          description: Todo not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /api/health:
    get:
      tags:
        - Health
      summary: Comprehensive health check
      operationId: healthCheck
      responses:
        '200':
          description: All services healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthCheck'
        '207':
          description: Some services degraded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthCheck'
        '503':
          description: Services unhealthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthCheck'
```

### Phase 2: Install Validation Middleware (30 minutes)

#### 2.1 Install Dependencies

```bash
npm install express-openapi-validator swagger-ui-express yamljs
npm install --save-dev @types/swagger-ui-express @types/yamljs
```

#### 2.2 OpenAPI Validation Middleware

**File: `src/middleware/openapi.ts`**

```typescript
import * as OpenApiValidator from 'express-openapi-validator';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

const apiSpecPath = path.join(__dirname, '../../openapi/schema.yaml');

/**
 * OpenAPI validation middleware
 */
export const openapiValidator = OpenApiValidator.middleware({
  apiSpec: apiSpecPath,
  validateRequests: {
    allowUnknownQueryParameters: false,
    coerceTypes: true, // Convert strings to numbers, booleans, etc.
    removeAdditional: false, // Don't remove extra properties
  },
  validateResponses: {
    removeAdditional: 'failing', // Remove extra properties in responses
    coerceTypes: true,
    onError: (error, body, req) => {
      logger.error('OpenAPI response validation failed', {
        requestId: (req as any).id,
        path: req.path,
        error: error.message,
        body,
      });
    },
  },
  validateSecurity: {
    handlers: {
      bearerAuth: async (req: Request) => {
        // JWT validation handled by separate middleware
        return true;
      },
    },
  },
  operationHandlers: false, // We handle routing manually
  ignorePaths: /.*\/graphql/, // Don't validate GraphQL endpoint
});

/**
 * OpenAPI error handler
 */
export const openapiErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err.status) {
    logger.warn('OpenAPI validation error', {
      requestId: (req as any).id,
      path: req.path,
      status: err.status,
      errors: err.errors,
    });

    res.status(err.status).json({
      error: err.message,
      details: err.errors?.map((e: any) => ({
        field: e.path,
        message: e.message,
        value: e.errorCode,
      })),
      requestId: (req as any).id,
    });
    return;
  }

  next(err);
};
```

### Phase 3: Swagger UI Documentation (20 minutes)

#### 3.1 API Documentation Endpoint

**File: `src/routes/docs.routes.ts`**

```typescript
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

const router = Router();

// Load OpenAPI spec
const openapiSpec = YAML.load(path.join(__dirname, '../../openapi/schema.yaml'));

// Swagger UI options
const swaggerUiOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Todo API Documentation',
  customfavIcon: '/favicon.ico',
};

// Serve Swagger UI
router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, swaggerUiOptions));

// Serve raw OpenAPI spec (JSON)
router.get('/openapi.json', (req, res) => {
  res.json(openapiSpec);
});

// Serve raw OpenAPI spec (YAML)
router.get('/openapi.yaml', (req, res) => {
  res.type('text/yaml');
  res.sendFile(path.join(__dirname, '../../openapi/schema.yaml'));
});

export default router;
```

### Phase 4: Update Application (30 minutes)

#### 4.1 Apply OpenAPI Middleware

**File: `src/app.ts`**

```typescript
import express from 'express';
import { openapiValidator, openapiErrorHandler } from './middleware/openapi';
import docsRoutes from './routes/docs.routes';

const app = express();

// ... existing middleware (helmet, cors, body parsing, etc.)

// API documentation routes
app.use('/api', docsRoutes);

// OpenAPI validation middleware
app.use(openapiValidator);

// ... existing routes (todos, health, etc.)

// OpenAPI error handler (must be after routes)
app.use(openapiErrorHandler);

// ... existing error handlers

export default app;
```

### Phase 5: Contract Testing (1.5 hours)

#### 5.1 Contract Test Suite

**File: `src/__tests__/contract.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import YAML from 'yamljs';
import path from 'path';

const openapiSpec = YAML.load(path.join(__dirname, '../../openapi/schema.yaml'));

describe('OpenAPI Contract Tests', () => {
  describe('Request Validation', () => {
    it('should reject request with invalid body', async () => {
      const response = await request(app)
        .post('/api/v1/todos')
        .send({
          // Missing required 'title' field
          completed: false,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject request with extra unknown parameters', async () => {
      const response = await request(app)
        .get('/api/v1/todos')
        .query({
          page: 1,
          unknownParam: 'value', // Not in spec
        })
        .expect(400);

      expect(response.body.error).toContain('unknownParam');
    });

    it('should coerce query parameter types', async () => {
      const response = await request(app)
        .get('/api/v1/todos')
        .query({
          page: '1', // String should be coerced to number
          limit: '10',
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should reject invalid parameter types', async () => {
      const response = await request(app)
        .get('/api/v1/todos')
        .query({
          page: 'not-a-number',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate string length constraints', async () => {
      const response = await request(app)
        .post('/api/v1/todos')
        .send({
          title: 'a'.repeat(501), // Exceeds maxLength: 500
          completed: false,
        })
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: expect.stringContaining('title'),
          }),
        ])
      );
    });
  });

  describe('Response Validation', () => {
    it('should return response matching schema', async () => {
      const response = await request(app)
        .post('/api/v1/todos')
        .send({
          title: 'Test Todo',
          completed: false,
        })
        .expect(201);

      // Validate response matches Todo schema
      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'Test Todo',
        completed: false,
        createdAt: expect.any(String),
      });

      // Validate date-time format
      expect(new Date(response.body.createdAt).toISOString()).toBe(response.body.createdAt);
    });

    it('should include required headers', async () => {
      const response = await request(app).get('/api/v1/todos');

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-api-version']).toBeDefined();
    });
  });

  describe('Schema Completeness', () => {
    it('should have schema for all endpoints', () => {
      const paths = Object.keys(openapiSpec.paths);

      expect(paths).toContain('/api/v1/todos');
      expect(paths).toContain('/api/v1/todos/{id}');
      expect(paths).toContain('/api/health');
    });

    it('should have all HTTP methods documented', () => {
      const todosPaths = openapiSpec.paths['/api/v1/todos'];

      expect(todosPaths).toHaveProperty('get');
      expect(todosPaths).toHaveProperty('post');

      const todoByIdPaths = openapiSpec.paths['/api/v1/todos/{id}'];

      expect(todoByIdPaths).toHaveProperty('get');
      expect(todoByIdPaths).toHaveProperty('put');
      expect(todoByIdPaths).toHaveProperty('delete');
    });

    it('should have all schemas defined', () => {
      const schemas = Object.keys(openapiSpec.components.schemas);

      expect(schemas).toContain('Todo');
      expect(schemas).toContain('CreateTodoRequest');
      expect(schemas).toContain('UpdateTodoRequest');
      expect(schemas).toContain('Error');
      expect(schemas).toContain('HealthCheck');
    });
  });

  describe('Breaking Change Detection', () => {
    it('should maintain backward compatibility', async () => {
      // Test that old clients still work
      const response = await request(app)
        .post('/api/v1/todos')
        .send({
          title: 'Backward Compatible Todo',
          completed: false,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('completed');
    });
  });
});
```

#### 5.2 Schema Drift Detection

**File: `src/__tests__/schema-drift.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import YAML from 'yamljs';
import path from 'path';
import { Todo } from '@prisma/client';

const openapiSpec = YAML.load(path.join(__dirname, '../../openapi/schema.yaml'));

describe('Schema Drift Detection', () => {
  it('should match database schema with OpenAPI schema', () => {
    const openApiTodoSchema = openapiSpec.components.schemas.Todo;
    const requiredFields = openApiTodoSchema.required;

    // Verify required fields match database model
    expect(requiredFields).toContain('id');
    expect(requiredFields).toContain('title');
    expect(requiredFields).toContain('completed');
    expect(requiredFields).toContain('createdAt');
  });

  it('should have consistent property types', () => {
    const todoSchema = openapiSpec.components.schemas.Todo;

    expect(todoSchema.properties.id.type).toBe('string');
    expect(todoSchema.properties.title.type).toBe('string');
    expect(todoSchema.properties.completed.type).toBe('boolean');
    expect(todoSchema.properties.createdAt.type).toBe('string');
    expect(todoSchema.properties.createdAt.format).toBe('date-time');
  });
});
```

### Phase 6: CI/CD Integration (20 minutes)

#### 6.1 Schema Validation in CI

**File: `.github/workflows/openapi.yml`**

```yaml
name: OpenAPI Validation

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  validate-schema:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Validate OpenAPI Schema
        uses: char0n/swagger-editor-validate@v1
        with:
          definition-file: openapi/schema.yaml

      - name: Check for Breaking Changes
        run: |
          npm install -g oasdiff
          oasdiff breaking openapi/schema.yaml openapi/schema.yaml

      - name: Generate Documentation
        run: |
          npm install -g redoc-cli
          redoc-cli bundle openapi/schema.yaml -o docs/api.html

      - name: Run Contract Tests
        run: |
          npm ci
          npm run test:contract
```

#### 6.2 NPM Script

**File: `package.json`**

```json
{
  "scripts": {
    "test:contract": "vitest run src/__tests__/contract.test.ts",
    "openapi:validate": "swagger-cli validate openapi/schema.yaml",
    "openapi:bundle": "swagger-cli bundle openapi/schema.yaml -o dist/openapi.json",
    "docs:generate": "redoc-cli bundle openapi/schema.yaml -o docs/api.html"
  }
}
```

---

## Benefits of OpenAPI Validation

### 1. Automatic Request Validation

- No manual validation code
- Consistent error messages
- Type coercion built-in

### 2. Living Documentation

- Schema = source of truth
- Always up-to-date
- Interactive testing with Swagger UI

### 3. Client Generation

```bash
# Generate TypeScript client
npx openapi-generator-cli generate \
  -i openapi/schema.yaml \
  -g typescript-axios \
  -o ./generated/client
```

### 4. Breaking Change Detection

```bash
# Compare schemas
oasdiff breaking old-schema.yaml new-schema.yaml
```

---

## Access Points

| Endpoint                | Description            |
| ----------------------- | ---------------------- |
| `GET /api/docs`         | Interactive Swagger UI |
| `GET /api/openapi.json` | OpenAPI spec (JSON)    |
| `GET /api/openapi.yaml` | OpenAPI spec (YAML)    |

---

## Files to Create/Update

| File                             | Action | Priority |
| -------------------------------- | ------ | -------- |
| `openapi/schema.yaml`            | Create | High     |
| `src/middleware/openapi.ts`      | Create | High     |
| `src/routes/docs.routes.ts`      | Create | High     |
| `src/app.ts`                     | Update | High     |
| `src/__tests__/contract.test.ts` | Create | High     |
| `.github/workflows/openapi.yml`  | Create | Medium   |
| `package.json`                   | Update | High     |

---

## Best Practices

**DO:**

- Keep schema in sync with code
- Version your API schemas
- Test against schema in CI/CD
- Use $ref for reusable components
- Document all endpoints
- Include examples
- Validate responses in dev/test

**DON'T:**

- Manually duplicate validation logic
- Skip schema updates when changing API
- Validate only in production
- Use different schemas for docs and validation

---

## Resources

- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.3)
- [express-openapi-validator](https://github.com/cdimascio/express-openapi-validator)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [ReDoc](https://github.com/Redocly/redoc)

**Status:** Ready for Implementation  
**Estimated Time:** 4-5 hours  
**Last Updated:** November 12, 2025
