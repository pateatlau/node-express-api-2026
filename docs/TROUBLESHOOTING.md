# Troubleshooting Guide

This guide covers common issues you might encounter while developing or using the Todo application with authentication.

---

## Table of Contents

1. [Authentication Issues](#authentication-issues)
2. [Session & Timeout Issues](#session--timeout-issues)
3. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
4. [Rate Limiting](#rate-limiting)
5. [GraphQL Issues](#graphql-issues)
6. [Database Issues](#database-issues)
7. [Environment & Configuration](#environment--configuration)
8. [Network & CORS](#network--cors)

---

## Authentication Issues

### Problem: "No token provided" Error

**Symptoms**:

- Getting 401 Unauthorized errors
- Message: "No token provided. Please authenticate."

**Causes**:

1. Access token not stored in localStorage
2. Authorization header not being sent
3. Token was cleared (logout or manual deletion)

**Solutions**:

```javascript
// Check if token exists in localStorage
const token = localStorage.getItem('accessToken');
console.log('Access Token:', token);

// Verify axios interceptor is adding header
// Check Network tab in DevTools → Headers → Authorization
```

**Fix**:

- Login again to get a new token
- Check that axios interceptor is properly configured
- Verify token is being stored after login

---

### Problem: "Invalid or expired token"

**Symptoms**:

- 401 error with message "Invalid or expired token"
- Happens after 15 minutes of inactivity

**Causes**:

1. Access token expired (15-minute lifetime)
2. JWT secret mismatch between what signed the token and what's verifying it
3. Token was manually modified

**Solutions**:

```javascript
// The app should automatically refresh the token
// Check if refresh interceptor is working

// Manual token refresh
await authApi.refreshAccessToken();
```

**Fix**:

- Frontend should automatically call `/api/auth/refresh` on 401 errors
- Check that `refreshToken` cookie exists
- If refresh fails, user needs to login again

---

### Problem: "User not found" After Token Verification

**Symptoms**:

- Token is valid but getting "User not found" error
- User was deleted from database

**Causes**:

- User account was deleted but token still exists
- Database connection issue

**Solutions**:

- Logout and login again
- Clear localStorage: `localStorage.clear()`
- Check database for user existence

---

## Session & Timeout Issues

### Problem: Session Expires Too Quickly

**Symptoms**:

- Getting logged out frequently
- "Session expired due to inactivity" message

**Configuration**:

```bash
# .env
SESSION_TIMEOUT_MINUTES=5  # Increase this value
```

**Causes**:

1. Session timeout too short (default: 5 minutes)
2. Activity tracking not working
3. User is actually inactive

**Solutions**:

- Increase `SESSION_TIMEOUT_MINUTES` in `.env`
- Verify activity tracker is running (check Network tab for `/api/auth/me` calls)
- Move mouse or interact with the page to reset timeout

---

### Problem: Session Warning Not Showing

**Symptoms**:

- No toast warning at 1 minute remaining
- User gets logged out without warning

**Causes**:

1. `SessionManager` not enabled
2. Toast system not working
3. `warningThreshold` misconfigured

**Check**:

```tsx
// App.tsx - Verify SessionManager is enabled
<SessionManager
  enabled={isAuthenticated}
  warningThreshold={60000} // 1 minute
  showExpiryToast={true}
/>
```

**Solutions**:

- Verify `SessionManager` component is rendered
- Check browser console for errors
- Test with shorter timeout (1 minute) for faster testing

---

### Problem: Activity Tracking Not Working

**Symptoms**:

- Session expires even when user is active
- `/api/auth/me` not being called

**Causes**:

1. `ActivityTracker` not enabled
2. Throttle interval too long
3. Event listeners not attached

**Check**:

```tsx
// App.tsx
<ActivityTracker
  enabled={isAuthenticated}
  throttleInterval={30000} // 30 seconds
  debug={true} // Enable debug logging
/>
```

**Solutions**:

- Enable debug mode to see activity logs
- Verify component is rendered when authenticated
- Check Network tab for `/api/auth/me` requests
- Try reducing `throttleInterval` to 10000 (10 seconds) for testing

---

### Problem: Session State Not Syncing Across Tabs

**Symptoms**:

- Logout in one tab doesn't affect other tabs
- Inconsistent session states

**Causes**:

- LocalStorage events not being listened to
- Multiple session providers polling independently

**Solutions**:

- Refresh the other tab to get updated state
- Implement storage event listeners:

```javascript
window.addEventListener('storage', (e) => {
  if (e.key === 'accessToken' && !e.newValue) {
    // Token was removed, logout in this tab too
    logout();
  }
});
```

---

## Role-Based Access Control (RBAC)

### Problem: "Access denied. Required role: PRO"

**Symptoms**:

- 403 Forbidden error
- Message shows required role and current role

**Causes**:

- User has STARTER role but trying to access PRO-only features
- GraphQL endpoint requires PRO role

**Which Features Require PRO**:

- ✅ GraphQL API (`/graphql`)
- ✅ GraphQL page in UI (`/graphql`)
- ❌ REST API (available to all)
- ❌ Home page (available to all)

**Solutions**:

1. **Upgrade to PRO** (requires changing role in database):

```sql
-- In PostgreSQL
UPDATE "User"
SET role = 'PRO'
WHERE email = 'user@example.com';
```

2. **Use REST API instead** (available to STARTER users):
   - Navigate to `/rest` instead of `/graphql`

3. **Create new PRO account**:
   - Signup with role selection: Choose "PRO"

---

### Problem: GraphQL Card Not Showing on Home Page

**Symptoms**:

- PRO user can't see GraphQL card on home page
- Only REST card visible

**Causes**:

- Role check logic issue
- User role not loaded properly

**Check**:

```javascript
// Browser console
const auth = JSON.parse(localStorage.getItem('auth-storage'));
console.log('User Role:', auth?.state?.user?.role);
```

**Solutions**:

- Verify user role is "PRO" in localStorage
- Refresh the page
- Logout and login again
- Check `Home.tsx` conditional rendering logic

---

## Rate Limiting

### Problem: "Too many requests" (429 Error)

**Symptoms**:

- 429 error with "Too many requests" message
- `RateLimit-*` headers in response
- Requests being blocked

**Rate Limits**:

- General API: 500 req/15min
- Auth endpoints: 5 req/15min
- GraphQL: 50 req/15min
- Mutations: 20 req/15min

**Causes**:

1. Too many requests in short time
2. Multiple components polling same endpoint
3. Infinite loops in code

**Solutions**:

1. **Wait for rate limit to reset** (check `RateLimit-Reset` header)
2. **Check for polling issues**:

```javascript
// Look for duplicate useEffect hooks
// Check Network tab → Filter by endpoint
// Count requests per minute
```

3. **Reduce polling frequency**:

```tsx
// Increase pollInterval
<SessionProvider pollInterval={60000} /> // 60 seconds
```

4. **Implement request throttling**:

```javascript
// Use debounce or throttle for user actions
import { debounce } from 'lodash';
const debouncedSave = debounce(saveTodo, 1000);
```

---

### Problem: Rate Limit Exceeded on Session Polling

**Symptoms**:

- 429 errors for `/api/auth/session`
- Multiple session requests in Network tab

**Causes**:

- SessionProvider always enabled (even when logged out)
- Multiple SessionProviders rendering
- Polling interval too short

**Solutions**:

```tsx
// Ensure SessionProvider only polls when authenticated
<SessionProvider pollInterval={30000}>
  {/* SessionProvider internally checks isAuthenticated */}
</SessionProvider>

// NOT this:
<SessionProvider enabled={true} /> // Always polls!
```

**Verify**:

- Only ONE `SessionProvider` in component tree
- `SessionContext` properly checks `isAuthenticated`
- Polling interval is reasonable (30-60 seconds)

---

## GraphQL Issues

### Problem: GraphQL Returns 401 Unauthorized

**Symptoms**:

- POST http://localhost:4000/graphql 401
- Working for REST but not GraphQL

**Causes**:

1. Bearer token not included in GraphQL requests
2. Apollo Client auth link not configured
3. User has STARTER role (needs PRO)

**Check Apollo Client Configuration**:

```typescript
// apolloClient.ts
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// Must chain authLink before httpLink
const splitLink = split(
  ({ query }) => {
    /* subscription check */
  },
  wsLink,
  authLink.concat(httpLink) // ✅ Correct
);
```

**Solutions**:

- Verify `authLink` is properly configured
- Check Network tab → GraphQL request → Headers → Authorization
- Ensure user has PRO role
- Try logout and login again

---

### Problem: GraphQL Subscriptions Not Working

**Symptoms**:

- WebSocket connection fails
- Real-time updates not received

**Causes**:

1. WebSocket auth not configured
2. WebSocket URL incorrect
3. Server not configured for subscriptions

**Check WebSocket Configuration**:

```typescript
// apolloClient.ts
const wsLink = new GraphQLWsLink(
  createClient({
    url: GRAPHQL_WS_URL,
    connectionParams: () => {
      const token = localStorage.getItem('accessToken');
      return {
        authorization: token ? `Bearer ${token}` : '',
      };
    },
  })
);
```

**Solutions**:

- Verify `VITE_GRAPHQL_WS_URL` is set correctly (`ws://localhost:4000/graphql`)
- Check browser console for WebSocket errors
- Ensure backend WebSocket server is running

---

## Database Issues

### Problem: "Unable to connect to PostgreSQL"

**Symptoms**:

- App crashes on startup
- Error: "connect ECONNREFUSED"

**Causes**:

1. PostgreSQL not running
2. Wrong connection credentials
3. Database doesn't exist

**Solutions**:

```bash
# Check if PostgreSQL is running
psql -U postgres

# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql

# Check connection string in .env
DATABASE_URL="postgresql://user:password@localhost:5432/tododb"

# Create database if it doesn't exist
createdb tododb

# Run migrations
npx prisma migrate dev
```

---

### Problem: Migration Errors

**Symptoms**:

- "Table already exists" error
- "Migration failed" messages

**Solutions**:

```bash
# Reset database (CAUTION: Deletes all data!)
npx prisma migrate reset

# Apply migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate

# Check migration status
npx prisma migrate status
```

---

### Problem: User Not Found in Database

**Symptoms**:

- Can't login with created account
- "Invalid credentials" error

**Check Database**:

```bash
# Connect to database
psql -d tododb

# List all users
SELECT email, role FROM "User";

# Check specific user
SELECT * FROM "User" WHERE email = 'user@example.com';
```

**Solutions**:

- Verify user exists in database
- Re-create account using signup
- Check password is correctly hashed (should start with `$2b$`)

---

## Environment & Configuration

### Problem: Environment Variables Not Loading

**Symptoms**:

- `undefined` values for env variables
- App behaves as if env vars don't exist

**Causes**:

1. `.env` file not in correct location
2. Variable names incorrect
3. Server not restarted after env changes

**Solutions**:

```bash
# Backend: Ensure .env is in project root
node-express-api-2026/
  ├── .env          ✅ Correct location
  ├── src/
  └── package.json

# Frontend: Variables must start with VITE_
VITE_API_URL=http://localhost:4000  ✅ Correct
API_URL=http://localhost:4000        ❌ Won't work

# Restart servers after .env changes
# Backend
npm run dev

# Frontend
npm run dev
```

---

### Problem: JWT Secrets Too Short

**Symptoms**:

- Error: "secretOrPrivateKey has a minimum key length"
- Authentication fails

**Solutions**:

```bash
# Generate secure secrets (32+ characters)
openssl rand -base64 32

# Update .env
JWT_ACCESS_SECRET="generated-secret-here"
JWT_REFRESH_SECRET="another-generated-secret"
```

---

## Network & CORS

### Problem: CORS Errors in Browser Console

**Symptoms**:

```
Access to XMLHttpRequest at 'http://localhost:4000/api/auth/login'
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Causes**:

- CORS not configured correctly
- Frontend origin not allowed

**Solutions**:

```bash
# Backend .env - Set correct frontend URL
CORS_ORIGIN=http://localhost:5173

# For production
CORS_ORIGIN=https://yourdomain.com

# Multiple origins (in cors config)
corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}
```

---

### Problem: Cookies Not Being Set

**Symptoms**:

- `refreshToken` cookie not in browser
- Login works but refresh fails

**Causes**:

1. `credentials: 'include'` not set in axios
2. `sameSite` policy too strict
3. HTTPS required but using HTTP

**Solutions**:

```javascript
// Frontend axios config
const client = axios.create({
  baseURL: API_URL,
  withCredentials: true, // ✅ Required for cookies
});

// Backend cookie config (development)
res.cookie('refreshToken', token, {
  httpOnly: true,
  secure: false, // false for HTTP (development)
  sameSite: 'lax', // or 'none' for cross-origin
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

---

## Common Error Messages

| Error                               | Likely Cause                       | Solution                              |
| ----------------------------------- | ---------------------------------- | ------------------------------------- |
| "No token provided"                 | Not authenticated                  | Login again                           |
| "Session expired"                   | 5 min inactivity                   | Login again, increase timeout         |
| "Access denied. Required role: PRO" | STARTER user accessing PRO feature | Upgrade role or use REST API          |
| "Too many requests"                 | Rate limit exceeded                | Wait 15 minutes or reduce requests    |
| "Invalid credentials"               | Wrong email/password               | Check credentials, verify user exists |
| "User not found"                    | Account deleted or doesn't exist   | Create new account                    |
| "connect ECONNREFUSED"              | Database not running               | Start PostgreSQL                      |
| "Migration failed"                  | Database schema issue              | Run `prisma migrate reset`            |

---

## Still Having Issues?

If none of these solutions work:

1. **Check application logs** (backend console output)
2. **Inspect Network tab** in browser DevTools
3. **Clear browser cache and localStorage**
4. **Try in incognito/private mode**
5. **Restart both backend and frontend servers**
6. **Check PostgreSQL is running** (`brew services list`)
7. **Verify all environment variables are set** (compare with `.env.example`)

---

## Debug Mode

Enable debug logging for troubleshooting:

```tsx
// Frontend - Activity Tracker
<ActivityTracker enabled={true} debug={true} />

// Frontend - Session Manager
<SessionManager enabled={true} debug={true} />
```

```bash
# Backend - Set log level
LOG_LEVEL=debug
```

Check browser console and backend logs for detailed information.

---

## Additional Resources

- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [README](../README.md)
