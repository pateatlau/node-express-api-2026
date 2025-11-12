# Phase 3: RBAC Implementation - Summary

## Overview

Implemented comprehensive Role-Based Access Control (RBAC) for both REST API and GraphQL endpoints.

## What Was Implemented

### 1. RBAC Middleware (`src/middleware/rbac.middleware.ts`)

**Functions:**

- `requireRole(allowedRoles)` - Generic middleware factory to require specific roles
- `requireProRole()` - Shorthand for PRO-only routes
- `requireAnyRole()` - Allow both STARTER and PRO roles
- `hasRole()` - Utility function for role checking
- `isProUser()` - Check if user is PRO
- `isStarterUser()` - Check if user is STARTER

**Usage Example:**

```typescript
// Require PRO role only
router.get('/premium', authenticate, requireProRole, handler);

// Allow both roles
router.get('/todos', authenticate, requireAnyRole, handler);

// Custom role requirements
router.post('/admin', authenticate, requireRole(['ADMIN']), handler);
```

### 2. GraphQL Directives (`src/graphql/directives.ts`)

**Directives:**

- `@requireAuth` - Require authentication for GraphQL field
- `@requireRole(role: Role!)` - Require specific role for GraphQL field

**Implementation:**

- Field-level authorization using GraphQL schema directives
- Checks authentication and role from GraphQL context
- Returns proper GraphQL errors (UNAUTHENTICATED, FORBIDDEN)

**Schema Definition (added to `src/graphql/schema.ts`):**

```graphql
directive @requireAuth on FIELD_DEFINITION
directive @requireRole(role: Role!) on FIELD_DEFINITION

enum Role {
  STARTER
  PRO
}
```

**Usage Example:**

```graphql
type Query {
  # Requires authentication
  myProfile: User @requireAuth

  # Requires PRO role specifically
  advancedFeature: AdvancedData @requireRole(role: PRO)
}
```

### 3. GraphQL Context Updates (`src/graphql/context.ts`)

**Changes:**

- Added `ContextUser` interface for user information
- Updated `GraphQLContext` to include `user?: ContextUser`
- Modified `createGraphQLContext()` to extract user from Express request
- User info now available in all GraphQL resolvers via `context.user`

**Benefits:**

- GraphQL resolvers can access authenticated user
- Directives can check user role
- Consistent with Express middleware pattern

### 4. GraphQL Server Configuration (`src/graphql/server.ts`)

**Changes:**

- Import and apply auth directives to schema
- Added authentication middleware to `/graphql` endpoint
- Added PRO role requirement for GraphQL access

**Protection:**

```typescript
app.use(
  '/graphql',
  json(),
  authenticate,      // Require valid JWT
  requireProRole,    // Require PRO role
  expressMiddleware(apolloServer, { ... })
);
```

### 5. REST API Protection (`src/routes/todos.ts`)

**Changes:**

- Applied `authenticate` middleware to all todo routes
- Applied `requireAnyRole` to allow both STARTER and PRO users

**Result:**

```typescript
// All todo routes now require authentication and allow both roles
router.use(authenticate, requireAnyRole);
```

## Access Control Matrix

| Endpoint/Feature       | STARTER | PRO | Public |
| ---------------------- | ------- | --- | ------ |
| POST /api/auth/signup  | ✅      | ✅  | ✅     |
| POST /api/auth/login   | ✅      | ✅  | ✅     |
| POST /api/auth/logout  | ✅      | ✅  | ✅     |
| POST /api/auth/refresh | ✅      | ✅  | ✅     |
| GET /api/auth/me       | ✅      | ✅  | ❌     |
| GET /api/todos         | ✅      | ✅  | ❌     |
| POST /api/todos        | ✅      | ✅  | ❌     |
| PUT /api/todos/:id     | ✅      | ✅  | ❌     |
| DELETE /api/todos/:id  | ✅      | ✅  | ❌     |
| GraphQL /graphql       | ❌      | ✅  | ❌     |
| GraphQL Subscriptions  | ❌      | ✅  | ❌     |

## Security Features

### HTTP Status Codes

- `401 Unauthorized` - No token or invalid token
- `403 Forbidden` - Valid token but insufficient role
- `200/201` - Successful request with proper authorization

### Error Responses

**REST API:**

```json
{
  "success": false,
  "message": "Access denied. Required role: PRO",
  "userRole": "STARTER"
}
```

**GraphQL:**

```json
{
  "errors": [
    {
      "message": "Access denied. Required role: PRO",
      "extensions": {
        "code": "FORBIDDEN",
        "requiredRole": "PRO",
        "userRole": "STARTER"
      }
    }
  ]
}
```

## Testing Scenarios

### Test 1: STARTER User - REST API Access ✅

```bash
# Login as STARTER
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"starter@example.com","password":"password123"}'

# Use access token to access todos
curl http://localhost:4000/api/todos \
  -H "Authorization: Bearer <access_token>"

# Expected: 200 OK with todos list
```

### Test 2: STARTER User - GraphQL Access ❌

```bash
# Try to access GraphQL with STARTER token
curl -X POST http://localhost:4000/graphql \
  -H "Authorization: Bearer <starter_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ todos { id title } }"}'

# Expected: 403 Forbidden - Required role: PRO
```

### Test 3: PRO User - Full Access ✅

```bash
# Login as PRO
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@example.com","password":"password123"}'

# Access REST API
curl http://localhost:4000/api/todos \
  -H "Authorization: Bearer <pro_access_token>"
# Expected: 200 OK

# Access GraphQL
curl -X POST http://localhost:4000/graphql \
  -H "Authorization: Bearer <pro_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ todos { id title } }"}'
# Expected: 200 OK with GraphQL response
```

### Test 4: No Token - Denied ❌

```bash
# Try to access protected route without token
curl http://localhost:4000/api/todos

# Expected: 401 Unauthorized - Authentication required
```

## Integration Points

### With Authentication Middleware

- RBAC middleware expects `req.user` to be set by `authenticate()` middleware
- Always chain `authenticate` before RBAC middleware
- Order: `authenticate` → `requireRole(...)` → route handler

### With GraphQL Context

- User info flows from Express request → GraphQL context
- Directives check `context.user` for authorization
- Resolvers can access `context.user` directly

### Error Handling

- Middleware returns proper HTTP status codes
- GraphQL directives throw GraphQLError with extensions
- Consistent error format across REST and GraphQL

## Files Modified/Created

**Created:**

- `src/middleware/rbac.middleware.ts` (70 lines)
- `src/graphql/directives.ts` (95 lines)

**Modified:**

- `src/graphql/context.ts` - Added user to context
- `src/graphql/schema.ts` - Added directive definitions
- `src/graphql/server.ts` - Applied auth to GraphQL endpoint
- `src/routes/todos.ts` - Protected REST todo routes

## Next Steps (Phase 4)

Phase 4 will implement session management:

- Track user inactivity
- Auto-logout after 5 minutes of inactivity
- Update `lastActivityAt` timestamp
- Client-side session timeout handling

## Notes

- GraphQL endpoint is PRO-only because GraphQL provides more powerful querying capabilities
- REST API is available to both STARTER and PRO for basic CRUD operations
- All protected routes require valid JWT token
- Role information comes from JWT payload (verified and trusted)
- Activity tracking happens in `authenticate()` middleware automatically
