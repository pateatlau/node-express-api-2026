# API Authentication Strategy

## Overview

This document outlines the authentication and authorization strategy for the Todo API. The API will support JWT (JSON Web Token) based authentication with refresh token rotation for enhanced security.

## Architecture

### Authentication Flow

```
┌─────────┐                    ┌─────────┐                    ┌──────────┐
│ Client  │                    │   API   │                    │ Database │
└────┬────┘                    └────┬────┘                    └────┬─────┘
     │                              │                              │
     │  POST /auth/register         │                              │
     ├─────────────────────────────>│                              │
     │  { email, password, name }   │                              │
     │                              │  Hash password (bcrypt)      │
     │                              │  Create user record          │
     │                              ├─────────────────────────────>│
     │                              │                              │
     │                              │<─────────────────────────────┤
     │  { accessToken, refreshToken }                              │
     │<─────────────────────────────┤                              │
     │                              │                              │
     │  POST /auth/login            │                              │
     ├─────────────────────────────>│                              │
     │  { email, password }         │                              │
     │                              │  Verify credentials          │
     │                              ├─────────────────────────────>│
     │                              │                              │
     │                              │<─────────────────────────────┤
     │  { accessToken, refreshToken }                              │
     │<─────────────────────────────┤                              │
     │                              │                              │
     │  GET /api/todos              │                              │
     │  Authorization: Bearer <JWT> │                              │
     ├─────────────────────────────>│                              │
     │                              │  Verify JWT                  │
     │                              │  Extract user ID             │
     │                              │  Fetch user's todos          │
     │                              ├─────────────────────────────>│
     │                              │                              │
     │                              │<─────────────────────────────┤
     │  { todos: [...] }            │                              │
     │<─────────────────────────────┤                              │
     │                              │                              │
     │  POST /auth/refresh          │                              │
     │  { refreshToken }            │                              │
     ├─────────────────────────────>│                              │
     │                              │  Verify refresh token        │
     │                              │  Revoke old token            │
     │                              │  Issue new tokens            │
     │                              ├─────────────────────────────>│
     │                              │                              │
     │  { accessToken, refreshToken }                              │
     │<─────────────────────────────┤                              │
     │                              │                              │
```

## Token Strategy

### Access Token (JWT)

- **Purpose**: Authenticate API requests
- **Lifetime**: 15 minutes
- **Storage**: Memory only (not localStorage/sessionStorage)
- **Contents**:
  ```json
  {
    "sub": "user-id",
    "email": "user@example.com",
    "name": "User Name",
    "iat": 1234567890,
    "exp": 1234567890
  }
  ```

### Refresh Token

- **Purpose**: Obtain new access tokens
- **Lifetime**: 7 days
- **Storage**: HTTP-only, Secure, SameSite cookie
- **Rotation**: New refresh token issued on each refresh
- **Contents**:
  ```json
  {
    "sub": "user-id",
    "tokenId": "unique-token-id",
    "iat": 1234567890,
    "exp": 1234567890
  }
  ```

## Database Schema

### Users Table (PostgreSQL)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

### Refresh Tokens Table (PostgreSQL)

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
```

### MongoDB Schema

```typescript
// User Schema
const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Refresh Token Schema
const RefreshTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});
```

### Todo Schema Updates

Add `userId` field to associate todos with users:

**PostgreSQL:**

```sql
ALTER TABLE todos ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX idx_todos_user_id ON todos(user_id);
```

**MongoDB:**

```typescript
const TodoSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
```

## API Endpoints

### Authentication Endpoints

#### Register User

```
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}

Response 201:
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Login

```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response 200:
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Refresh Access Token

```
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response 200:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Logout

```
POST /auth/logout
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response 204: No Content
```

#### Get Current User

```
GET /auth/me
Authorization: Bearer <access-token>

Response 200:
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2025-11-12T00:00:00.000Z"
}
```

### Protected Endpoints

All `/api/*` endpoints require authentication:

```
GET /api/todos
Authorization: Bearer <access-token>

Response 200:
{
  "data": [...],
  "pagination": {...}
}
```

## Middleware

### Authentication Middleware

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      email: string;
      name: string;
    };

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Optional Authentication Middleware

For endpoints that work with or without authentication:

```typescript
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      email: string;
      name: string;
    };

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
    };
  } catch {
    // Invalid token, but continue without user
  }

  next();
};
```

## Security Best Practices

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Password Hashing

- Algorithm: bcrypt
- Rounds: 12 (configurable via environment)

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
```

### Token Security

- Store JWT secret in environment variables
- Use different secrets for access and refresh tokens
- Implement token rotation for refresh tokens
- Revoke refresh tokens on logout
- Clean up expired refresh tokens periodically

### Rate Limiting

- Login: 5 attempts per 15 minutes per IP
- Register: 3 attempts per hour per IP
- Refresh: 10 attempts per 15 minutes per user
- API endpoints: 100 requests per 15 minutes per user

### CORS Configuration

```typescript
const corsOptions = {
  origin: process.env.CORS_ORIGIN,
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
};
```

## Environment Variables

Add to `.env`:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Password Hashing
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100
```

## GraphQL Authentication

### Context Setup

```typescript
// src/graphql/context.ts
import { Request } from 'express';
import jwt from 'jsonwebtoken';

export interface GraphQLContext {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export const createContext = ({ req }: { req: Request }): GraphQLContext => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return {};
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      email: string;
      name: string;
    };

    return {
      user: {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
      },
    };
  } catch {
    return {};
  }
};
```

### Protected Resolvers

```typescript
// src/graphql/resolvers/todos.ts
export const todoResolvers = {
  Query: {
    todos: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const repository = RepositoryFactory.getTodoRepository();
      return repository.findByUserId(context.user.id);
    },
  },

  Mutation: {
    createTodo: async (
      _parent: unknown,
      args: { input: CreateTodoInput },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }

      const repository = RepositoryFactory.getTodoRepository();
      return repository.create({
        ...args.input,
        userId: context.user.id,
      });
    },
  },
};
```

## Testing Strategy

### Unit Tests

- Password hashing and verification
- JWT token generation and validation
- Token expiry handling
- Refresh token rotation

### Integration Tests

- User registration flow
- Login with valid/invalid credentials
- Access protected endpoints with valid/invalid tokens
- Token refresh flow
- Logout and token revocation

### Example Test

```typescript
describe('Authentication', () => {
  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const response = await request(app).post('/auth/register').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toMatchObject({
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('should reject weak passwords', async () => {
      const response = await request(app).post('/auth/register').send({
        email: 'test@example.com',
        password: 'weak',
        name: 'Test User',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('password');
    });
  });

  describe('GET /api/todos', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app).get('/api/todos');

      expect(response.status).toBe(401);
    });

    it('should return todos for authenticated user', async () => {
      const token = await createTestToken({ id: 'user-1' });

      const response = await request(app).get('/api/todos').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
```

## Migration Path

### Phase 1: Database Setup (Week 1)

1. Create user and refresh_token tables/collections
2. Add userId to todos schema
3. Run migrations

### Phase 2: Core Implementation (Week 2)

1. Implement user repository
2. Implement authentication service
3. Add JWT utilities
4. Create auth routes

### Phase 3: Middleware & Protection (Week 3)

1. Add authentication middleware
2. Protect existing API routes
3. Update GraphQL context and resolvers
4. Update DataLoader to filter by user

### Phase 4: Testing & Documentation (Week 4)

1. Write comprehensive tests
2. Update API documentation
3. Create Postman collection
4. Update frontend integration guide

### Phase 5: Deployment

1. Set environment variables in production
2. Run database migrations
3. Deploy with zero downtime
4. Monitor authentication metrics

## Monitoring & Metrics

Track the following metrics:

- Failed login attempts per IP
- Token refresh rate
- Average token lifetime usage
- Authentication errors (expired, invalid, missing)
- User registration rate
- Active sessions count

## Future Enhancements

1. **OAuth 2.0 Support**
   - Google Sign-In
   - GitHub Sign-In
   - Apple Sign-In

2. **Two-Factor Authentication (2FA)**
   - TOTP (Time-based One-Time Password)
   - SMS verification
   - Email verification

3. **Session Management**
   - View active sessions
   - Revoke specific sessions
   - Device tracking

4. **Advanced Security**
   - IP whitelisting
   - Anomaly detection
   - Brute force protection
   - Account lockout policy

5. **Password Recovery**
   - Email-based password reset
   - Security questions
   - Account recovery codes

## References

- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)
- [bcrypt Best Practices](https://github.com/kelektiv/node.bcrypt.js#security-issues-and-concerns)
