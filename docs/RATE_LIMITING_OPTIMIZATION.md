# Rate Limiting Optimization Guide

## Overview

This document explains the optimized rate limiting strategy implemented in the application and provides additional optimization options for production deployments.

## Current Implementation

### 1. User-Based Rate Limiting (✅ Implemented)

**Problem Solved:** Multiple users behind the same IP (corporate NAT, mobile carriers) were sharing rate limits.

**Solution:**

```typescript
const getUserOrIpKey = (req: Request): string => {
  const authReq = req as AuthRequest;

  // For authenticated requests, use user ID
  if (authReq.user?.userId) {
    return `user:${authReq.user.userId}`;
  }

  // For unauthenticated requests, use IP
  return `ip:${req.ip}`;
};
```

**Benefits:**

- Each authenticated user gets their own rate limit bucket
- Prevents legitimate users from being blocked by others on same IP
- Still protects unauthenticated endpoints with IP-based limiting
- Prevents VPN/proxy bypass for authenticated routes

### 2. Intelligent Request Counting (✅ Implemented)

**Problem Solved:** High-frequency session polling (every 30 seconds) was consuming rate limits.

**Solution:**

- `apiLimiter`: Uses `skipSuccessfulRequests: true` - only counts errors
- `authLimiter`: Counts all attempts (security critical)
- `sessionLogoutLimiter`: Counts all operations but with generous limits

**Benefits:**

- Legitimate polling doesn't exhaust limits
- Failed requests (potential attacks) are counted
- Authentication attempts strictly monitored

### 3. Adjusted Limits (✅ Implemented)

| Limiter              | Old Limit      | New Limit        | Reason                       |
| -------------------- | -------------- | ---------------- | ---------------------------- |
| apiLimiter           | 500/15min (IP) | 500/15min (User) | User-based + skip successful |
| authLimiter          | 5/15min (IP)   | 5/15min (IP)     | Keep IP-based for security   |
| graphqlLimiter       | 50/15min (IP)  | 100/15min (User) | User-based + skip successful |
| mutationLimiter      | 20/15min (IP)  | 30/15min (User)  | User-based tracking          |
| sessionLogoutLimiter | 30/15min (IP)  | 50/15min (User)  | User-based + generous        |

### 4. Improved Logging

Now logs user ID or IP for better debugging:

```typescript
logger.warn('Rate limit exceeded', {
  key: getUserOrIpKey(req), // Shows "user:123" or "ip:192.168.1.1"
  path: req.path,
  method: req.method,
});
```

## Future Optimizations

### Option 1: Redis-Backed Rate Limiting

**When to implement:** When deploying multiple server instances behind a load balancer

**Benefits:**

- Share rate limit state across all server instances
- Persistent rate limit counters (survive server restarts)
- Better accuracy in distributed systems

**Implementation:**

1. Install Redis store:

```bash
npm install rate-limit-redis ioredis
```

2. Configure Redis client:

```typescript
// src/config/redis.ts
import Redis from 'ioredis';

export const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});
```

3. Update rate limiters:

```typescript
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/redis.js';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:api:', // Namespace keys
  }),
  keyGenerator: getUserOrIpKey,
  skipSuccessfulRequests: true,
  // ... rest of config
});
```

**Environment variables:**

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password
```

### Option 2: Sliding Window Algorithm

**When to implement:** When fixed windows cause burst issues at window resets

**Benefits:**

- More fair distribution of requests over time
- Prevents burst at window boundaries
- Better user experience

**Implementation:**

Use `rate-limit-redis` with sliding window:

```typescript
import { RedisStore } from 'rate-limit-redis';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:api:',
    // Enable sliding window (requires Redis sorted sets)
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
  // Sliding window calculation
  skipFailedRequests: false,
  skipSuccessfulRequests: true,
});
```

**Comparison:**

Fixed Window:

```
0-15min: 500 requests allowed
15-30min: 500 new requests allowed
User can burst 1000 requests at minute 14-16
```

Sliding Window:

```
Any 15-minute period: 500 requests allowed
At minute 16: counts requests from minute 1-16
Smooth distribution of requests
```

### Option 3: Tiered Rate Limiting

**When to implement:** When you have different user tiers (free, pro, enterprise)

**Benefits:**

- Better service for premium users
- Revenue opportunity (rate limits as a feature)
- Flexible limits based on user needs

**Implementation:**

1. Add user role to AuthRequest:

```typescript
// src/types/auth.types.ts
export interface User {
  userId: string;
  email: string;
  role: 'free' | 'pro' | 'enterprise' | 'admin';
}
```

2. Create tiered key generator:

```typescript
const getTieredKey = (req: Request): { key: string; max: number } => {
  const authReq = req as AuthRequest;

  if (authReq.user?.userId) {
    const role = authReq.user.role || 'free';

    // Different limits per tier
    const limits = {
      free: 500,
      pro: 2000,
      enterprise: 10000,
      admin: 999999, // Effectively unlimited
    };

    return {
      key: `user:${authReq.user.userId}`,
      max: limits[role],
    };
  }

  return {
    key: `ip:${req.ip}`,
    max: 100, // Strict for unauthenticated
  };
};
```

3. Update rate limiter with dynamic max:

```typescript
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    const { max } = getTieredKey(req);
    return max;
  },
  keyGenerator: (req) => {
    const { key } = getTieredKey(req);
    return key;
  },
  skipSuccessfulRequests: true,
  // ... rest of config
});
```

### Option 4: Dynamic Rate Limiting Based on Load

**When to implement:** When you need to throttle under high load

**Benefits:**

- Protect server from overload
- Graceful degradation
- Automatic recovery

**Implementation:**

```typescript
import os from 'os';

const getAdaptiveMax = (baseMax: number): number => {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;

  if (cpuUsage > 0.8) {
    return Math.floor(baseMax * 0.5); // Reduce by 50%
  } else if (cpuUsage > 0.6) {
    return Math.floor(baseMax * 0.75); // Reduce by 25%
  }

  return baseMax;
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => getAdaptiveMax(500),
  keyGenerator: getUserOrIpKey,
  skipSuccessfulRequests: true,
  // ... rest of config
});
```

### Option 5: Exempt Specific Endpoints

**When to implement:** When certain read-only endpoints should have higher limits

**Benefits:**

- Different limits for different endpoint types
- Better UX for read-heavy applications
- More granular control

**Implementation:**

```typescript
// src/middleware/rateLimiter.ts

// Very lenient for session status polling
export const sessionStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Allow high frequency polling
  keyGenerator: getUserOrIpKey,
  skipSuccessfulRequests: true,
  message: 'Too many session status requests',
});

// In routes:
router.get('/api/auth/session', sessionStatusLimiter, getCurrentSession);
router.get('/api/auth/sessions', apiLimiter, getActiveSessions);
router.post('/api/auth/logout', authLimiter, logout);
```

## Monitoring & Observability

### Log Analysis

Current implementation logs rate limit violations:

```typescript
logger.warn('Rate limit exceeded', {
  key: getUserOrIpKey(req),
  path: req.path,
  method: req.method,
});
```

**Monitoring tips:**

1. Track rate limit violations by user/IP
2. Alert on sudden spikes (potential attack)
3. Identify legitimate users hitting limits (adjust accordingly)

### Metrics to Track

1. **Rate limit hit rate**: % of requests blocked
2. **Users affected**: Unique users hitting limits
3. **Endpoints**: Which endpoints trigger limits most
4. **False positives**: Legitimate users blocked

### Example Monitoring with Prometheus

```typescript
import { Counter, Gauge } from 'prom-client';

const rateLimitCounter = new Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total rate limit violations',
  labelNames: ['endpoint', 'key'],
});

// In rate limit handler:
handler: (req, res) => {
  const key = getUserOrIpKey(req);
  rateLimitCounter.inc({ endpoint: req.path, key });

  logger.warn('Rate limit exceeded', { key, path: req.path });
  res.status(429).json({ error: 'Too many requests' });
};
```

## Testing Rate Limits

### Manual Testing

1. **Test authentication limits:**

```bash
# Should block after 5 attempts
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo "\nAttempt $i"
done
```

2. **Test user-based limits:**

```bash
# Two users on same IP should have separate limits
TOKEN1="user1_token"
TOKEN2="user2_token"

# User 1 - 500 requests
for i in {1..600}; do
  curl http://localhost:3000/api/auth/session \
    -H "Authorization: Bearer $TOKEN1"
done

# User 2 - should still work
curl http://localhost:3000/api/auth/session \
  -H "Authorization: Bearer $TOKEN2"
```

3. **Test session polling:**

```bash
# Should not be rate limited (skipSuccessfulRequests: true)
for i in {1..1000}; do
  curl http://localhost:3000/api/auth/session \
    -H "Authorization: Bearer $TOKEN"
  sleep 0.1
done
```

### Automated Tests

```typescript
// tests/rateLimiter.test.ts
import request from 'supertest';
import app from '../app';

describe('Rate Limiting', () => {
  it('should block after 5 failed login attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' })
        .expect(401);
    }

    // 6th attempt should be rate limited
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrong' })
      .expect(429);
  });

  it('should have separate limits per user', async () => {
    const token1 = 'user1_token';
    const token2 = 'user2_token';

    // Exhaust user1's limit
    for (let i = 0; i < 500; i++) {
      await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);
    }

    // User2 should still work
    await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
  });
});
```

## Production Checklist

- [x] User-based rate limiting for authenticated endpoints
- [x] Intelligent request counting (skip successful reads)
- [x] Adjusted limits for session polling
- [x] Comprehensive logging
- [ ] Redis-backed storage (for distributed systems)
- [ ] Sliding window algorithm (for fairness)
- [ ] Tiered limits by user role (for monetization)
- [ ] Monitoring and alerting
- [ ] Load testing with realistic traffic patterns

## Summary

**Current Status:**

- ✅ User-based limiting prevents shared IP issues
- ✅ Intelligent counting reduces false positives
- ✅ Session polling won't exhaust limits
- ✅ Improved logging for debugging

**Next Steps (if needed):**

1. Add Redis for distributed systems
2. Implement sliding windows for fairness
3. Add tiered limits for user roles
4. Set up monitoring and alerting

The current implementation is **production-ready** for single-instance deployments. Implement Redis-backed storage when scaling to multiple instances.
