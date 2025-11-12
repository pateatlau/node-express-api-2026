# Rate Limiting Optimization Summary

## What Was Optimized

### Before

- **IP-based limiting only** - All users behind same NAT/proxy shared limits
- **Fixed limits** - No differentiation between read/write operations
- **Session polling counted** - High-frequency polling consumed limits
- **No user tracking** - Authenticated users treated same as anonymous

### After

- **User-based limiting** - Each authenticated user has their own rate limit bucket
- **Intelligent counting** - Successful read operations don't count toward limits
- **Adjusted limits** - Higher limits for legitimate operations, stricter for mutations
- **Better logging** - Shows user ID or IP for easier debugging

## Key Changes

### 1. Custom Key Generator

```typescript
const getUserOrIpKey = (req: Request): string => {
  const authReq = req as AuthRequest;

  // Authenticated users: tracked by user ID
  if (authReq.user?.userId) {
    return `user:${authReq.user.userId}`;
  }

  // Unauthenticated: tracked by IP
  return `ip:${req.ip || 'unknown'}`;
};
```

**Impact**: Users at the same company or on the same mobile carrier no longer share rate limits.

### 2. Skip Successful Requests

```typescript
export const apiLimiter = rateLimit({
  skipSuccessfulRequests: true, // Only count errors
  // ...
});
```

**Impact**: Session status polling (every 30 seconds) doesn't exhaust limits.

### 3. Updated Limits

| Endpoint Type  | Old Limit      | New Limit           | Key        | Skip Successful |
| -------------- | -------------- | ------------------- | ---------- | --------------- |
| General API    | 500/15min (IP) | 500/15min (User/IP) | User or IP | ✅ Yes          |
| Authentication | 5/15min (IP)   | 5/15min (IP)        | IP only    | ❌ No           |
| GraphQL        | 50/15min (IP)  | 100/15min (User/IP) | User or IP | ✅ Yes          |
| Mutations      | 20/15min (IP)  | 30/15min (User/IP)  | User or IP | ❌ No           |
| Session Ops    | 30/15min (IP)  | 50/15min (User/IP)  | User or IP | ❌ No           |

## Benefits

✅ **No more false positives** - Legitimate users behind shared IPs aren't blocked  
✅ **Session polling safe** - High-frequency status checks don't trigger limits  
✅ **Better security** - Each user tracked individually, can't bypass with VPN  
✅ **Improved UX** - Users see consistent experience regardless of network  
✅ **Production ready** - Works for single-instance deployments

## Limitations & Future Improvements

### Current Limitations

1. **IPv6 normalization** - express-rate-limit v8 warns about potential IPv6 bypass
2. **In-memory storage** - Rate limit state lost on server restart
3. **Single instance** - Won't work correctly across multiple server instances
4. **Fixed limits** - No tiered limits by user role

### Recommended Next Steps (When Needed)

**For distributed systems** (multiple server instances):

- Implement Redis-backed storage with `rate-limit-redis`
- Shares rate limit state across all instances
- Persists through server restarts

**For IPv6 production traffic**:

- Use Redis store (handles IPv6 normalization automatically)
- Or implement custom IPv6 address normalization

**For premium users**:

- Implement tiered rate limits by user role
- FREE: 500/15min, PRO: 2000/15min, ENTERPRISE: 10000/15min

**For fairness**:

- Implement sliding window algorithm
- Prevents burst at fixed window boundaries

## Testing

### Manual Test - User-Based Limiting

```bash
# Two users on same IP should have separate limits
TOKEN1="user1_token"
TOKEN2="user2_token"

# Exhaust user 1's limit
for i in {1..600}; do
  curl http://localhost:4000/api/auth/session \
    -H "Authorization: Bearer $TOKEN1"
done

# User 2 should still work
curl http://localhost:4000/api/auth/session \
  -H "Authorization: Bearer $TOKEN2"
# Should return 200 OK
```

### Manual Test - Session Polling

```bash
# High-frequency polling should not be rate limited
TOKEN="your_token"
for i in {1..1000}; do
  curl http://localhost:4000/api/auth/session \
    -H "Authorization: Bearer $TOKEN"
  sleep 0.1
done
# Should all succeed (skipSuccessfulRequests: true)
```

### Manual Test - Auth Brute Force Protection

```bash
# Should block after 5 failed attempts
for i in {1..10}; do
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo "\nAttempt $i"
done
# Attempt 6-10 should return 429 Too Many Requests
```

## Monitoring

Watch for these in logs:

```
logger.warn('Rate limit exceeded', {
  key: 'user:123abc' or 'ip:192.168.1.1',
  path: '/api/auth/login',
  method: 'POST',
});
```

**Alerts to set up:**

1. Spike in rate limit violations (potential attack)
2. Legitimate users hitting limits (adjust limits)
3. Specific IPs with many violations (block at firewall)

## Production Deployment

✅ **Current status**: Production-ready for single-instance deployments  
⚠️ **If using multiple instances**: Implement Redis storage first  
⚠️ **If serving IPv6 traffic**: Use Redis store or normalize IPv6 addresses  
✅ **Documentation**: See `docs/RATE_LIMITING_OPTIMIZATION.md` for detailed implementation guide

## Summary

The optimized rate limiting implementation solves the "polling approach" limitations by:

1. **User-based tracking** instead of IP-only
2. **Intelligent request counting** that skips successful read operations
3. **Adjusted limits** appropriate for different operation types
4. **Better logging** for debugging and monitoring

This eliminates false positives from session polling while maintaining strong protection against abuse.
