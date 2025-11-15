# 🐛 Bug Review Report

## Auth Microservice - November 15, 2025

---

## 🚨 CRITICAL BUGS

### 1. **Session Token Mismatch in Logout Flow** 🔴 **SEVERITY: CRITICAL**

**Location**: `src/routes/auth.routes.ts:195-212`

**Issue**: Logout tries to use JWT access token as session token, but sessions now use generated UUIDs

```typescript
// In logout endpoint:
const sessionToken = authHeader.substring(7); // This is a JWT access token
const session = await getSessionByToken(sessionToken); // ❌ Will never find session
```

**Root Cause**: After fixing the session architecture, we now generate unique session tokens, but logout still tries to look up sessions using the JWT access token.

**Impact**:

- Logout never actually deletes sessions from database
- Sessions accumulate indefinitely
- Users appear logged out but sessions remain active
- Can't properly terminate sessions remotely

**Fix Required**:

```typescript
// Option 1: Store session token separately in client
// Client needs to track both JWT and session token

// Option 2: Add sessionId to JWT payload
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string; // Add this
  type: 'access' | 'refresh';
}

// Then in createSession, return session and include sessionId in JWT
const session = await createSession(userId, deviceInfo, req.ip);
const tokens = generateTokens(user.id, user.email, user.role, session.id);

// In logout, extract sessionId from JWT
const decoded = verifyAccessToken(token);
const session = await getSessionById(decoded.sessionId);
```

---

### 2. **Session Activity Tracking Broken** 🔴 **SEVERITY: HIGH**

**Location**: `src/routes/auth.routes.ts:516-527`

**Issue**: Activity endpoint tries to update session by token, but uses JWT instead of session token

```typescript
const sessionToken = authHeader?.replace('Bearer ', ''); // JWT access token
if (sessionToken) {
  await updateLastActivity(sessionToken); // ❌ Will fail - session not found
}
```

**Impact**:

- Session timeout never updates
- Sessions appear to expire even when user is active
- Users get kicked out after 5 minutes despite activity

**Fix Required**: Same as Bug #1 - need to track session ID in JWT or separately

---

### 3. **Sessions Query Broken** 🔴 **SEVERITY: HIGH**

**Location**: `src/routes/auth.routes.ts:393`

**Issue**: Tries to compare JWT access token with session tokens

```typescript
const currentToken = authHeader?.replace('Bearer ', '');
const sessions = await getActiveSessions(authReq.user.userId, currentToken);
// currentToken is JWT, but sessions have UUID tokens - will never match
```

**Impact**:

- Can't identify current session in session list
- UI can't highlight which device user is on
- Risk of terminating current session accidentally

**Fix Required**: Same as Bug #1

---

### 4. **Multiple Prisma Client Instances** 🟠 **SEVERITY: MEDIUM**

**Location**: `src/services/auth.service.ts:16` and `src/services/session.service.ts:9`

**Issue**: Each service creates its own Prisma client instance

```typescript
// In auth.service.ts
const prisma = new PrismaClient();

// In session.service.ts
const prisma = new PrismaClient(); // ❌ Second instance
```

**Impact**:

- Inefficient database connection pooling
- Potential connection pool exhaustion under load
- Transactions can't span services
- Memory waste

**Fix Required**:

```typescript
// Create src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Then import in services:
import { prisma } from '../lib/prisma.js';
```

---

### 5. **Session Ownership Not Validated** 🟠 **SEVERITY: MEDIUM**

**Location**: `src/routes/auth.routes.ts:450-481`

**Issue**: DELETE /sessions/:id doesn't verify session belongs to authenticated user

```typescript
const { id } = req.params;
const session = await getSessionById(id);

if (!session) {
  res.status(404).json({ ... });
  return;
}

// ❌ Missing: Check if session.userId === authReq.user.userId
await terminateSession(id);  // User can delete anyone's session!
```

**Impact**:

- User can terminate other users' sessions if they know the session ID
- Security vulnerability - privilege escalation
- Users can be forcibly logged out by attackers

**Fix Required**:

```typescript
const { id } = req.params;
const session = await getSessionById(id);

if (!session) {
  res.status(404).json({ success: false, message: 'Session not found' });
  return;
}

// Verify session belongs to authenticated user
if (session.userId !== authReq.user.userId) {
  res.status(403).json({ success: false, message: 'Access denied' });
  return;
}

await terminateSession(id);
```

---

## ⚠️ MEDIUM BUGS

### 6. **No Prisma Client Cleanup on Shutdown** 🟡 **SEVERITY: MEDIUM**

**Location**: `src/index.ts:120-130`

**Issue**: Graceful shutdown doesn't disconnect Prisma

```typescript
process.on('SIGTERM', async () => {
  console.log('[SIGTERM] Shutting down gracefully...');
  await closePublisher(); // Closes Redis
  // ❌ Missing: await prisma.$disconnect()
  process.exit(0);
});
```

**Impact**:

- Database connections not cleaned up
- Potential connection leaks
- Database may log connection errors

**Fix Required**:

```typescript
// In src/lib/prisma.ts (new file)
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

// In src/index.ts
import { disconnectPrisma } from './lib/prisma.js';

process.on('SIGTERM', async () => {
  console.log('[SIGTERM] Shutting down gracefully...');
  await Promise.all([closePublisher(), disconnectPrisma()]);
  process.exit(0);
});
```

---

### 7. **Session Timeout Not Actually Enforced** 🟡 **SEVERITY: MEDIUM**

**Location**: `src/services/session.service.ts:269-284`

**Issue**: Session timeout is calculated but never enforced

```typescript
export async function getSessionInfo(userId: string) {
  const session = await prisma.session.findFirst({ where: { userId } });

  // Calculates timeout but doesn't delete expired sessions
  const timeRemaining = Math.max(0, SESSION_TIMEOUT_MS - timeElapsed);
  const isExpired = timeRemaining === 0;

  return { isExpired, ... };  // ❌ Just returns info, doesn't enforce
}
```

**Impact**:

- Sessions claimed "expired" but still valid in DB
- User can still use "expired" sessions
- Session timeout is cosmetic only
- Security issue - sessions live beyond intended timeout

**Fix Required**:

```typescript
export async function getSessionInfo(userId: string) {
  const session = await prisma.session.findFirst({ where: { userId } });

  if (!session) {
    throw new Error('No active session found');
  }

  const now = new Date().getTime();
  const lastActivityMs = session.lastActivity.getTime();
  const timeElapsed = now - lastActivityMs;
  const timeRemaining = Math.max(0, SESSION_TIMEOUT_MS - timeElapsed);
  const isExpired = timeRemaining === 0;

  // Delete session if timeout exceeded
  if (isExpired) {
    await prisma.session.delete({ where: { id: session.id } });
    await publishAuthEvent('session.terminated', {
      userId: session.userId,
      sessionId: session.id,
      reason: 'inactivity_timeout'
    });
    throw new Error('Session expired due to inactivity');
  }

  return { lastActivityAt: session.lastActivity, isExpired: false, ... };
}
```

---

### 8. **Race Condition in Session Limit Check** 🟡 **SEVERITY: MEDIUM**

**Location**: `src/services/session.service.ts:55-77`

**Issue**: Count and delete not atomic - race condition if multiple logins

```typescript
const existingSessions = await prisma.session.count({ where: { userId } });

if (existingSessions >= MAX_SESSIONS_PER_USER) {
  const oldestSession = await prisma.session.findFirst({ ... });
  // ❌ Another session could be created here before delete
  await prisma.session.delete({ where: { id: oldestSession.id } });
}

const session = await prisma.session.create({ ... });
```

**Impact**:

- User could have more than MAX_SESSIONS_PER_USER
- Race condition on concurrent logins
- Unlikely but possible

**Fix Required**:

```typescript
// Use transaction
const session = await prisma.$transaction(async (tx) => {
  const existingSessions = await tx.session.count({ where: { userId } });

  if (existingSessions >= MAX_SESSIONS_PER_USER) {
    const oldestSession = await tx.session.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (oldestSession) {
      await tx.session.delete({ where: { id: oldestSession.id } });
    }
  }

  return await tx.session.create({ data: { ... } });
});
```

---

### 9. **Error Response Inconsistency** 🟡 **SEVERITY: LOW**

**Location**: Multiple routes

**Issue**: Some routes still use old error format instead of centralized handler

```typescript
// Some routes:
res.status(500).json({
  success: false,
  message: 'Failed to register user',
  error: error instanceof Error ? error.message : 'Unknown error', // ❌ Inconsistent
});

// Should use:
throw error; // Let centralized error handler deal with it
```

**Impact**:

- Inconsistent error responses
- Some errors bypass centralized error handler
- Error tracking incomplete
- Client-side error handling complicated

**Fix Required**: Remove try-catch from routes and let errors bubble to centralized handler

---

### 10. **No IP Address Validation** 🟡 **SEVERITY: LOW**

**Location**: `src/routes/auth.routes.ts:71, 140`

**Issue**: req.ip used without validation

```typescript
await createSession(result.user.id, deviceInfo, req.ip); // req.ip could be undefined or spoofed
```

**Impact**:

- Session tracking may be incomplete
- IP address could be spoofed if not behind trusted proxy
- Debugging difficulties

**Fix Required**:

```typescript
// Get real IP considering proxies
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

await createSession(result.user.id, deviceInfo, getClientIp(req));
```

---

## 🔍 LOGIC ISSUES

### 11. **Logout "Success" Even on Failure** 🟡 **SEVERITY: LOW**

**Location**: `src/routes/auth.routes.ts:217-223`

**Issue**: Catch block returns 200 success even if logout failed

```typescript
} catch (error) {
  console.error('[LOGOUT] Error:', error);
  res.clearCookie('refreshToken');
  res.status(200).json({  // ❌ Always returns success
    success: true,
    message: 'Logout successful',
  });
}
```

**Rationale**: Probably intentional for UX (don't show errors to user)

**Issue**: Masks real problems, makes debugging harder

**Better Approach**:

```typescript
} catch (error) {
  console.error('[LOGOUT] Error:', error);
  res.clearCookie('refreshToken');
  // Log error but return success for UX
  // Include error ID for support debugging
  res.status(200).json({
    success: true,
    message: 'Logout successful',
    _debug: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}
```

---

### 12. **Dynamic Import in Request Handler** 🟡 **SEVERITY: LOW**

**Location**: `src/routes/auth.routes.ts:520`

**Issue**: Dynamic import in hot path

```typescript
const { updateLastActivity } = await import('../services/session.service.js');
await updateLastActivity(sessionToken);
```

**Impact**:

- Unnecessary performance overhead
- Already imported at top of file
- Confusing code

**Fix**: Use existing import

```typescript
// Already imported at top:
import { updateLastActivity } from '../services/session.service.js';

// In handler:
await updateLastActivity(sessionToken);
```

---

## 📊 BUG SEVERITY SUMMARY

| Severity    | Count  | Blocking                        |
| ----------- | ------ | ------------------------------- |
| 🔴 Critical | 3      | YES - Session management broken |
| 🟠 High     | 2      | YES - Security issues           |
| 🟡 Medium   | 7      | NO - But should fix soon        |
| **Total**   | **12** | **3 blocking bugs**             |

---

## 🎯 CRITICAL PATH FIXES

### Must Fix Before Testing (Blocking)

1. **Fix Session Token Architecture** (Bug #1, #2, #3)
   - Add sessionId to JWT payload
   - Update generateTokens to accept sessionId
   - Update all session lookups to use sessionId from JWT
   - Estimated time: 2 hours

2. **Fix Session Ownership Validation** (Bug #5)
   - Add userId check in DELETE /sessions/:id
   - Estimated time: 15 minutes

### Must Fix Before Production

3. **Create Singleton Prisma Client** (Bug #4)
   - Create src/lib/prisma.ts
   - Update all imports
   - Add disconnect on shutdown (Bug #6)
   - Estimated time: 30 minutes

4. **Enforce Session Timeout** (Bug #7)
   - Delete sessions on timeout
   - Update getSessionInfo
   - Estimated time: 30 minutes

5. **Fix Race Condition** (Bug #8)
   - Use Prisma transactions
   - Estimated time: 20 minutes

---

## 🔧 FIX IMPLEMENTATION PRIORITY

**Phase 1: Critical (Today)**

- [ ] Bug #1: Fix session token mismatch in logout
- [ ] Bug #2: Fix session activity tracking
- [ ] Bug #3: Fix sessions query
- [ ] Bug #5: Add session ownership validation

**Phase 2: High Priority (This Week)**

- [ ] Bug #4: Create singleton Prisma client
- [ ] Bug #6: Add Prisma cleanup on shutdown
- [ ] Bug #7: Enforce session timeout
- [ ] Bug #8: Fix race condition in session limit

**Phase 3: Cleanup (Before Production)**

- [ ] Bug #9: Standardize error handling
- [ ] Bug #10: Add IP validation
- [ ] Bug #11: Improve logout error handling
- [ ] Bug #12: Remove dynamic import

---

## 🧪 TESTING REQUIREMENTS

After fixes, must test:

1. **Session Management**
   - [ ] Login creates session
   - [ ] Logout deletes session
   - [ ] Activity updates session timestamp
   - [ ] Session timeout enforced
   - [ ] Max sessions limit works
   - [ ] Can't delete other users' sessions

2. **Concurrency**
   - [ ] Multiple concurrent logins
   - [ ] Race condition in session limit

3. **Error Scenarios**
   - [ ] Session not found
   - [ ] Expired sessions
   - [ ] Invalid tokens
   - [ ] Database failures

---

## 💡 RECOMMENDATIONS

1. **Add Integration Tests**
   - Test full auth flow end-to-end
   - Test session lifecycle
   - Test concurrent operations

2. **Add Monitoring**
   - Track session creation/deletion rates
   - Alert on session count anomalies
   - Monitor Prisma connection pool

3. **Add Logging**
   - Log all session operations
   - Track session lifecycle events
   - Debug session token issues

4. **Documentation**
   - Document session token architecture
   - Explain JWT vs session token distinction
   - API client implementation guide

---

**Review Date**: November 15, 2025  
**Reviewed By**: GitHub Copilot  
**Status**: 🔴 **CRITICAL BUGS FOUND** - Not ready for testing until fixed  
**Blocker Count**: 3 critical bugs must be fixed first
