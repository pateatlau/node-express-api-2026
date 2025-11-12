# Authentication Quick Start Guide

This guide provides a quick overview of implementing JWT authentication in the Todo API. For detailed documentation, see `AUTHENTICATION.md`.

## Quick Setup (5 Steps)

### 1. Install Dependencies

```bash
npm install jsonwebtoken bcrypt
npm install --save-dev @types/jsonwebtoken @types/bcrypt
```

### 2. Generate JWT Secrets

```bash
# Generate access token secret
openssl rand -base64 32

# Generate refresh token secret
openssl rand -base64 32
```

Add these to your `.env` file:

```bash
JWT_SECRET="generated-access-secret-here"
JWT_REFRESH_SECRET="generated-refresh-secret-here"
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=12
```

### 3. Run Database Migrations

#### PostgreSQL (Prisma)

Create migration files in `prisma/migrations/`:

```sql
-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create refresh_tokens table
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add userId to todos
ALTER TABLE todos ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_todos_user_id ON todos(user_id);
```

Run migrations:

```bash
npm run prisma:migrate
```

#### MongoDB (Mongoose)

Models will be created automatically. Just define schemas in code (see Phase 2 of checklist).

### 4. Implement Core Services

Create these files in order:

1. **Password Service** - `src/services/PasswordService.ts`
2. **Token Service** - `src/services/TokenService.ts`
3. **Auth Service** - `src/services/AuthService.ts`
4. **Auth Middleware** - `src/middleware/auth.ts`
5. **Auth Routes** - `src/routes/auth.routes.ts`

### 5. Protect Your Routes

Update `src/app.ts`:

```typescript
import authRoutes from './routes/auth.routes';
import { authenticate } from './middleware/auth';

// Public routes
app.use('/auth', authRoutes);

// Protected routes
app.use('/api', authenticate, apiRoutes);
```

## Testing Your Implementation

### 1. Register a User

```bash
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'
```

Expected response:

```json
{
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "name": "Test User"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

### 2. Login

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

### 3. Access Protected Endpoint

```bash
# Save the access token from login/register
TOKEN="your-access-token-here"

curl -X GET http://localhost:4000/api/todos \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Refresh Token

```bash
curl -X POST http://localhost:4000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token-here"
  }'
```

## Common Issues & Solutions

### Issue: "Invalid token" error

**Solution:** Check that:

- JWT_SECRET is set in `.env`
- Token hasn't expired
- Token is sent in `Authorization: Bearer <token>` format

### Issue: "User was denied access on the database"

**Solution:** Run database migrations:

```bash
npm run prisma:migrate  # PostgreSQL
# or ensure MongoDB is running
```

### Issue: Password validation fails

**Solution:** Ensure password meets requirements:

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Issue: CORS errors from frontend

**Solution:** Update CORS_ORIGIN in `.env`:

```bash
CORS_ORIGIN="http://localhost:5173"  # Your frontend URL
```

## Development Workflow

1. **Make changes** to auth services/routes
2. **Run tests**: `npm test`
3. **Check lint**: `npm run lint`
4. **Format code**: `npm run format`
5. **Test manually** with curl or Postman
6. **Update documentation** if API changes

## Security Checklist

Before deploying to production:

- [ ] Change default JWT secrets to strong random values
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS in production
- [ ] Set secure cookie options (httpOnly, secure, sameSite)
- [ ] Enable rate limiting on auth endpoints
- [ ] Review CORS settings
- [ ] Set up monitoring for failed login attempts
- [ ] Implement token cleanup job for expired refresh tokens
- [ ] Document password requirements for users
- [ ] Set up alerts for suspicious authentication activity

## Next Steps

Once basic authentication is working:

1. Review `AUTHENTICATION.md` for detailed architecture
2. Follow `AUTHENTICATION_CHECKLIST.md` for complete implementation
3. Add tests for all auth flows
4. Consider adding OAuth 2.0 support
5. Implement 2FA for additional security

## Resources

- **Detailed Documentation**: `docs/AUTHENTICATION.md`
- **Implementation Checklist**: `docs/AUTHENTICATION_CHECKLIST.md`
- **JWT Best Practices**: https://tools.ietf.org/html/rfc8725
- **OWASP Auth Guide**: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- **bcrypt Documentation**: https://github.com/kelektiv/node.bcrypt.js

## Support

For questions or issues:

1. Check the troubleshooting section above
2. Review the detailed documentation
3. Check existing issues in the repository
4. Create a new issue with details about your problem
