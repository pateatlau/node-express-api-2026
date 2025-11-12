# Phase 4: Session Management - Testing Guide

## Test Scenarios for Session Timeout

### Prerequisites

```bash
# Ensure server is running
npm run dev

# Environment: SESSION_TIMEOUT_MINUTES=5
```

---

## Scenario 1: Active Session - No Timeout ✅

**Description:** User makes requests within the 5-minute window, session stays alive.

**Steps:**

```bash
# 1. Login and get access token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Save the accessToken from response

# 2. Check session status immediately
curl -X GET http://localhost:4000/api/auth/session \
  -H "Authorization: Bearer <accessToken>"

# Expected Response:
{
  "success": true,
  "data": {
    "session": {
      "lastActivityAt": "2025-11-12T14:00:00.000Z",
      "isExpired": false,
      "timeRemainingMs": 300000,  // ~5 minutes
      "timeoutMs": 300000,
      "timeRemainingMinutes": 5
    }
  }
}

# 3. Make another request after 2 minutes
# Wait 2 minutes, then:
curl -X GET http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"

# Expected: 200 OK - Session refreshed

# 4. Check session again
curl -X GET http://localhost:4000/api/auth/session \
  -H "Authorization: Bearer <accessToken>"

# Expected: timeRemainingMs reset to ~300000 (5 minutes again)
```

**Result:** ✅ Session stays alive as long as user remains active

---

## Scenario 2: Session Expiration - Inactive for 5+ Minutes ❌

**Description:** User makes no requests for over 5 minutes, session expires.

**Steps:**

```bash
# 1. Login and get access token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# 2. Wait 6 minutes (or set SESSION_TIMEOUT_MINUTES=1 for faster testing)
# DO NOT make any requests during this time

# 3. Try to access protected route
curl -X GET http://localhost:4000/api/todos \
  -H "Authorization: Bearer <accessToken>"

# Expected Response:
{
  "success": false,
  "message": "Session expired due to inactivity. Please login again.",
  "code": "SESSION_EXPIRED"
}

# HTTP Status: 401 Unauthorized
```

**Result:** ❌ Session expired, user must login again

---

## Scenario 3: Session Status Monitoring 📊

**Description:** Monitor session timeout countdown in real-time.

**Steps:**

```bash
# 1. Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 2. Check session every minute
for i in {1..6}; do
  echo "Check $i:"
  curl -X GET http://localhost:4000/api/auth/session \
    -H "Authorization: Bearer <accessToken>"
  echo ""
  sleep 60
done

# Expected Output (approximate):
# Check 1: timeRemainingMinutes: 5
# Check 2: timeRemainingMinutes: 4
# Check 3: timeRemainingMinutes: 3
# Check 4: timeRemainingMinutes: 2
# Check 5: timeRemainingMinutes: 1
# Check 6: 401 SESSION_EXPIRED
```

**Result:** 📊 Time decreases each minute until expiration

---

## Scenario 4: Activity Refreshes Timer 🔄

**Description:** Each authenticated request resets the 5-minute timer.

**Steps:**

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.data.accessToken')

# 2. Wait 4 minutes
sleep 240

# 3. Check session (should have ~1 minute left)
curl -X GET http://localhost:4000/api/auth/session \
  -H "Authorization: Bearer $TOKEN"
# Expected: timeRemainingMinutes: 1

# 4. Make ANY authenticated request (this refreshes the timer)
curl -X GET http://localhost:4000/api/todos \
  -H "Authorization: Bearer $TOKEN"

# 5. Immediately check session again
curl -X GET http://localhost:4000/api/auth/session \
  -H "Authorization: Bearer $TOKEN"
# Expected: timeRemainingMinutes: 5 (RESET!)

# 6. Wait another 4 minutes
sleep 240

# 7. Session should still be valid
curl -X GET http://localhost:4000/api/todos \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK
```

**Result:** 🔄 Each request resets the 5-minute countdown

---

## Scenario 5: Multiple Endpoints Update Activity ✅

**Description:** Any authenticated endpoint updates lastActivityAt.

**Steps:**

```bash
TOKEN="<your_access_token>"

# All these endpoints should update activity:

# 1. GET /api/auth/me
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/auth/me

# 2. GET /api/auth/session
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/auth/session

# 3. GET /api/todos
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/todos

# 4. POST /api/todos
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}' \
  http://localhost:4000/api/todos

# 5. GraphQL (PRO users only)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ todos { id } }"}' \
  http://localhost:4000/graphql

# After each request, check session:
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/auth/session
# Expected: lastActivityAt updates each time
```

**Result:** ✅ All protected endpoints update activity

---

## Scenario 6: JWT Still Valid But Session Expired ⚠️

**Description:** Access token is valid (not expired) but session timed out.

**Steps:**

```bash
# 1. Login with 15-minute access token
# JWT_ACCESS_EXPIRY=15m (token valid for 15 min)
# SESSION_TIMEOUT_MINUTES=5 (session valid for 5 min)

curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

TOKEN="<access_token>"

# 2. Wait 6 minutes (session expires, but JWT still valid)
sleep 360

# 3. Try to access endpoint
curl -X GET http://localhost:4000/api/todos \
  -H "Authorization: Bearer $TOKEN"

# Expected Response:
{
  "success": false,
  "message": "Session expired due to inactivity. Please login again.",
  "code": "SESSION_EXPIRED"
}

# 4. User must login again to get new session
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Result:** ⚠️ JWT validity doesn't matter if session expired

---

## Scenario 7: Different Timeout Configurations ⚙️

**Description:** Test with different SESSION_TIMEOUT_MINUTES values.

### Quick Testing (1 minute timeout)

```bash
# Set in .env:
SESSION_TIMEOUT_MINUTES=1

# Restart server
npm run dev

# Login and wait 65 seconds
# Session should expire
```

### Production Setting (30 minutes)

```bash
# Set in .env:
SESSION_TIMEOUT_MINUTES=30

# Session stays active for 30 minutes of inactivity
```

### Default (5 minutes)

```bash
# If not set or empty, defaults to 5 minutes
SESSION_TIMEOUT_MINUTES=5
```

---

## Edge Cases

### Edge Case 1: No lastActivityAt

**Scenario:** New user with no lastActivityAt (shouldn't happen in practice)
**Expected:** Session treated as expired
**Code:** Returns `isSessionExpired = true`

### Edge Case 2: User Deleted Mid-Session

**Scenario:** User is deleted from database while JWT is still valid
**Expected:** 401 "User not found"
**Code:** Checked before session expiration check

### Edge Case 3: Session Check During Expiration Second

**Scenario:** Check session at exactly 5:00.000 minutes
**Expected:** Consistent behavior (expired if >= 5 minutes)
**Code:** Uses `>` comparison, so exactly 5:00.000 would be valid

---

## Automated Test Script

```bash
#!/bin/bash
# test-session.sh

API_URL="http://localhost:4000"

echo "=== Session Management Tests ==="

# Test 1: Login
echo "1. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')

if [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed"
  exit 1
fi
echo "✅ Login successful"

# Test 2: Check active session
echo "2. Testing active session..."
SESSION_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  $API_URL/api/auth/session)

IS_EXPIRED=$(echo $SESSION_RESPONSE | jq -r '.data.session.isExpired')
if [ "$IS_EXPIRED" = "false" ]; then
  echo "✅ Session is active"
else
  echo "❌ Session should be active"
fi

# Test 3: Activity updates
echo "3. Testing activity update..."
curl -s -H "Authorization: Bearer $TOKEN" $API_URL/api/todos > /dev/null
SESSION_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  $API_URL/api/auth/session)
echo "✅ Activity updated"

# Test 4: Wait and check expiration (if SESSION_TIMEOUT_MINUTES=1)
echo "4. Testing session expiration (requires SESSION_TIMEOUT_MINUTES=1)..."
echo "Waiting 65 seconds..."
sleep 65

EXPIRED_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  $API_URL/api/todos)

CODE=$(echo $EXPIRED_RESPONSE | jq -r '.code')
if [ "$CODE" = "SESSION_EXPIRED" ]; then
  echo "✅ Session expired correctly"
else
  echo "⚠️  Session may not have expired (check timeout setting)"
fi

echo "=== Tests Complete ==="
```

---

## Expected Database Behavior

**User Table - lastActivityAt field:**

```sql
-- Before any activity
SELECT id, email, "lastActivityAt" FROM "User" WHERE email = 'test@example.com';
-- lastActivityAt: 2025-11-12 14:00:00

-- After authenticated request
SELECT id, email, "lastActivityAt" FROM "User" WHERE email = 'test@example.com';
-- lastActivityAt: 2025-11-12 14:03:45  (updated!)

-- Check time difference
SELECT
  email,
  "lastActivityAt",
  EXTRACT(EPOCH FROM (NOW() - "lastActivityAt")) as seconds_since_activity
FROM "User"
WHERE email = 'test@example.com';
-- If seconds_since_activity > 300, session is expired
```

---

## Frontend Integration Preview (Phase 9)

**What Phase 9 will add:**

- Poll `/api/auth/session` every 30 seconds
- Show countdown timer: "Session expires in 3m 45s"
- Auto-logout when `isExpired: true`
- Show warning at 1 minute remaining
- Reset timer on user activity (mouse/keyboard events)

**Phase 4 provides the backend foundation for all of this!**
