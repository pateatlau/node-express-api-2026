# Testing Plan - Authentication & RBAC

Comprehensive manual testing plan for the Todo application with authentication, session management, and role-based access control.

---

## Test Environment Setup

Before beginning tests:

1. **Start Backend Server**

   ```bash
   cd node-express-api-2026
   npm run dev
   # Verify: Server started successfully on port 4000
   ```

2. **Start Frontend Server**

   ```bash
   cd react-stack-2026
   npm run dev
   # Verify: Vite server running on port 5173
   ```

3. **Open Browser DevTools**
   - Network tab for monitoring requests
   - Console tab for errors
   - Application tab for localStorage/cookies

4. **Create Test Users** (if not exists)
   ```bash
   # Access signup page: http://localhost:5173/signup
   # Create STARTER user: starter@test.com / Test123!
   # Create PRO user: pro@test.com / Test123!
   ```

---

## Test Suite 1: Authentication Flow

### Test 1.1: User Signup (STARTER Role)

**Steps**:

1. Navigate to http://localhost:5173/signup
2. Fill form:
   - Name: "Test Starter"
   - Email: "starter1@test.com"
   - Password: "SecurePass123!"
   - Role: "STARTER"
3. Click "Create Account"

**Expected Results**:

- ✅ Redirected to home page (`/`)
- ✅ User info displayed in header
- ✅ Role badge shows "STARTER" in blue
- ✅ Only REST API card visible on home
- ✅ No GraphQL link in header
- ✅ `accessToken` stored in localStorage
- ✅ `refreshToken` cookie set (check Application tab)
- ✅ Success toast: "Account created successfully"

**Network Verification**:

- POST `/api/auth/signup` returns 201
- Response includes `user` and `accessToken`
- `Set-Cookie` header present with `refreshToken`

---

### Test 1.2: User Signup (PRO Role)

**Steps**:

1. Navigate to http://localhost:5173/signup
2. Fill form:
   - Name: "Test Pro"
   - Email: "pro1@test.com"
   - Password: "SecurePass123!"
   - Role: "PRO"
3. Click "Create Account"

**Expected Results**:

- ✅ Redirected to home page (`/`)
- ✅ Role badge shows "PRO" in purple
- ✅ Both REST and GraphQL cards visible
- ✅ GraphQL link in header
- ✅ GraphQL card has "PRO ONLY" badge

---

### Test 1.3: Signup with Existing Email

**Steps**:

1. Try to signup with email from Test 1.1
2. Click "Create Account"

**Expected Results**:

- ✅ Error message: "User with this email already exists"
- ✅ No redirect
- ✅ Form remains populated
- ✅ Error toast displayed

---

### Test 1.4: User Login

**Steps**:

1. Logout if logged in
2. Navigate to http://localhost:5173/login
3. Enter credentials:
   - Email: "starter1@test.com"
   - Password: "SecurePass123!"
4. Click "Login"

**Expected Results**:

- ✅ Redirected to home page
- ✅ User authenticated
- ✅ Session timer starts in header
- ✅ Success toast: "Login successful"

---

### Test 1.5: Login with Wrong Password

**Steps**:

1. Navigate to /login
2. Enter wrong password
3. Click "Login"

**Expected Results**:

- ✅ Error message: "Invalid credentials"
- ✅ No redirect
- ✅ Error toast displayed
- ✅ Password field cleared

---

### Test 1.6: Logout

**Steps**:

1. Login as any user
2. Click "Logout" button in header

**Expected Results**:

- ✅ Redirected to /login
- ✅ `accessToken` removed from localStorage
- ✅ `refreshToken` cookie cleared
- ✅ Header no longer visible
- ✅ Success toast: "Logged out successfully"

---

## Test Suite 2: Session Timeout & Activity Tracking

### Test 2.1: Session Warning at 1 Minute

⏱️ **Duration**: ~4 minutes

**Steps**:

1. Login as any user
2. Stay completely idle (don't move mouse or type)
3. Watch session timer in header
4. Wait for 4 minutes

**Expected Results**:

- ✅ Timer counts down from 5:00 to 1:00
- ✅ At 1:00 remaining, warning toast appears
- ✅ Toast message: "Your session will expire in 60 seconds due to inactivity..."
- ✅ Timer turns yellow (1-2 min) then red (<1 min)
- ✅ `/api/auth/session` called every 30 seconds (check Network tab)

**Network Monitoring**:

- GET `/api/auth/session` every 30 seconds
- Response includes `timeRemainingMs` and `isExpired: false`

---

### Test 2.2: Auto-Logout After 5 Minutes

⏱️ **Duration**: ~5 minutes

**Steps**:

1. Continue from Test 2.1 or start fresh
2. Stay idle for full 5 minutes
3. Do not interact with page

**Expected Results**:

- ✅ At 0:00, automatic logout occurs
- ✅ Redirected to `/login?reason=session_expired`
- ✅ Error toast: "Your session has expired. Please login again."
- ✅ All authentication state cleared
- ✅ localStorage cleared
- ✅ Cookies cleared

---

### Test 2.3: Activity Resets Timer

⏱️ **Duration**: ~4.5 minutes

**Steps**:

1. Login as any user
2. Wait 4 minutes (warning appears at 1:00)
3. Move mouse or type in console
4. Watch timer in header

**Expected Results**:

- ✅ Timer resets back to 5:00 (or near 5:00)
- ✅ Warning toast disappears
- ✅ Timer color returns to green/gray
- ✅ `/api/auth/me` called when activity detected
- ✅ No logout occurs

**Activity Events Tracked**:

- Mouse movement
- Mouse clicks
- Keyboard input
- Scrolling
- Touch events

**Network Monitoring**:

- GET `/api/auth/me` called (max once per 30 seconds)
- Response includes updated `lastActivityAt`

---

### Test 2.4: Activity Throttling

**Steps**:

1. Login as any user
2. Rapidly move mouse back and forth
3. Monitor Network tab

**Expected Results**:

- ✅ `/api/auth/me` called at most once per 30 seconds
- ✅ No excessive requests despite rapid movement
- ✅ No rate limit errors (429)

---

## Test Suite 3: Role-Based Access Control (RBAC)

### Test 3.1: STARTER User - Home Page

**Steps**:

1. Login as STARTER user
2. View home page

**Expected Results**:

- ✅ Only REST API card visible
- ✅ GraphQL card hidden
- ✅ No GraphQL link in header navigation

---

### Test 3.2: STARTER User - Manual GraphQL Access

**Steps**:

1. Login as STARTER user
2. Manually navigate to http://localhost:5173/graphql

**Expected Results**:

- ✅ Access denied page displayed
- ✅ Message: "This page requires PRO role"
- ✅ Current role shown: "STARTER"
- ✅ "Go to Home" button displayed
- ✅ Page styled with error design

---

### Test 3.3: PRO User - Home Page

**Steps**:

1. Login as PRO user
2. View home page

**Expected Results**:

- ✅ Both REST and GraphQL cards visible
- ✅ GraphQL card has "PRO ONLY" badge
- ✅ GraphQL link in header navigation
- ✅ 2-column grid layout

---

### Test 3.4: PRO User - GraphQL Access

**Steps**:

1. Login as PRO user
2. Click "GraphQL" in header or card
3. View GraphQL todos page

**Expected Results**:

- ✅ GraphQL page loads successfully
- ✅ Todos list displayed (if any exist)
- ✅ Can create new todos
- ✅ Can update todos
- ✅ Can delete todos
- ✅ No access denied errors

**Network Monitoring**:

- POST `/graphql` requests successful (200)
- `Authorization: Bearer <token>` header present
- No 401 or 403 errors

---

### Test 3.5: Backend GraphQL Protection

**Steps**:

1. Login as STARTER user
2. Open browser console
3. Try to make GraphQL request manually:
   ```javascript
   fetch('http://localhost:4000/graphql', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
     },
     body: JSON.stringify({
       query: '{ todos { data { id title } } }',
     }),
   })
     .then((r) => r.json())
     .then(console.log);
   ```

**Expected Results**:

- ✅ 401 Unauthorized error
- ✅ Message: "Access denied" or similar
- ✅ Backend enforces PRO requirement

---

## Test Suite 4: Token Management

### Test 4.1: Access Token in Requests

**Steps**:

1. Login as any user
2. Make any authenticated request (e.g., navigate to /rest)
3. Check Network tab

**Expected Results**:

- ✅ All authenticated requests have `Authorization` header
- ✅ Header format: `Bearer <jwt-token>`
- ✅ Token matches value in localStorage

---

### Test 4.2: Access Token Expiration

⏱️ **Duration**: ~15 minutes (or modify JWT_ACCESS_EXPIRY to 1m for testing)

**Steps**:

1. Login as any user
2. Wait for access token to expire (15 minutes)
3. Make an authenticated request (navigate to /rest)

**Expected Results**:

- ✅ Initial request returns 401
- ✅ Frontend automatically calls `/api/auth/refresh`
- ✅ New access token obtained
- ✅ Original request retried with new token
- ✅ User stays logged in (no redirect to login)
- ✅ No visible error to user

**Network Monitoring**:

1. GET `/api/todos` → 401
2. POST `/api/auth/refresh` → 200 (new token)
3. GET `/api/todos` → 200 (retry with new token)

---

### Test 4.3: Refresh Token Expiration

⏱️ **Duration**: 7 days (or modify for testing)

**Steps**:

1. Delete or expire `refreshToken` cookie
2. Make an authenticated request

**Expected Results**:

- ✅ Request fails with 401
- ✅ Refresh attempt fails (no refresh token)
- ✅ User logged out automatically
- ✅ Redirected to /login
- ✅ Toast: "Session expired, please login again"

---

### Test 4.4: Invalid Token

**Steps**:

1. Login as any user
2. Manually modify `accessToken` in localStorage
3. Make an authenticated request

**Expected Results**:

- ✅ 401 error: "Invalid or expired token"
- ✅ Attempt to refresh token
- ✅ If refresh succeeds, user stays logged in
- ✅ If refresh fails, user logged out

---

## Test Suite 5: Rate Limiting

### Test 5.1: Normal Usage - No Rate Limits

**Steps**:

1. Login as any user
2. Navigate between pages normally
3. Create/edit a few todos
4. Monitor Network tab

**Expected Results**:

- ✅ All requests successful (200/201)
- ✅ No 429 errors
- ✅ Rate limit headers present:
  - `RateLimit-Limit: 500`
  - `RateLimit-Remaining: <number>`

---

### Test 5.2: Session Polling Rate Limits

⏱️ **Duration**: 5 minutes

**Steps**:

1. Login as any user
2. Stay logged in for 5 minutes
3. Count `/api/auth/session` requests in Network tab

**Expected Results**:

- ✅ Approximately 10 requests in 5 minutes (1 per 30 seconds)
- ✅ No 429 rate limit errors
- ✅ Total requests well under 500/15min limit

---

### Test 5.3: Authentication Rate Limit

**Steps**:

1. Logout
2. Try to login with wrong password 6+ times quickly
3. Observe response

**Expected Results**:

- ✅ First 5 attempts: 401 (invalid credentials)
- ✅ 6th attempt: 429 (rate limit exceeded)
- ✅ Message: "Too many authentication attempts"
- ✅ Must wait 15 minutes before retrying
- ✅ Rate limit headers indicate retry time

---

### Test 5.4: GraphQL Rate Limit

**Steps**:

1. Login as PRO user
2. Make 51+ GraphQL requests quickly (use browser console or tool)
3. Monitor responses

**Expected Results**:

- ✅ First 50 requests: 200 OK
- ✅ 51st request: 429
- ✅ Error: "Too many GraphQL requests"
- ✅ `retryAfter` value provided

---

## Test Suite 6: Navigation & Routing

### Test 6.1: Authenticated User - Invalid Route

**Steps**:

1. Login as any user
2. Navigate to http://localhost:5173/invalid-page

**Expected Results**:

- ✅ 404 Not Found page displayed
- ✅ "Go to Home" button visible
- ✅ "Go Back" button visible
- ✅ Message: "Page Not Found"
- ✅ No redirect to login

---

### Test 6.2: Unauthenticated User - Invalid Route

**Steps**:

1. Logout (not logged in)
2. Navigate to http://localhost:5173/invalid-page

**Expected Results**:

- ✅ Redirected to /login
- ✅ No 404 page shown
- ✅ Login form displayed

---

### Test 6.3: Authenticated User - Login/Signup Pages

**Steps**:

1. Login as any user
2. Try to navigate to /login
3. Try to navigate to /signup

**Expected Results**:

- ✅ Both routes redirect to home (/)
- ✅ Cannot access login/signup while authenticated
- ✅ User stays on home page

---

### Test 6.4: Unauthenticated User - Protected Routes

**Steps**:

1. Logout
2. Try to navigate to /rest
3. Try to navigate to /graphql
4. Try to navigate to / (home)

**Expected Results**:

- ✅ All routes redirect to /login
- ✅ After login, redirected to originally requested page
- ✅ Location state preserved (`from` location)

---

## Test Suite 7: UI/UX Testing

### Test 7.1: Header Components

**Steps**:

1. Login as any user
2. Inspect header

**Expected Results**:

- ✅ Logo/brand displayed
- ✅ Navigation links (Home, REST API, GraphQL\*)
- ✅ User name displayed
- ✅ Role badge (STARTER/PRO) with correct color
- ✅ Session timer with countdown
- ✅ Logout button
- ✅ Timer color changes based on time:
  - Gray/green: >2 minutes
  - Yellow: 1-2 minutes
  - Red: <1 minute

\*GraphQL only for PRO users

---

### Test 7.2: Toast Notifications

**Steps**:

1. Perform various actions that trigger toasts
2. Observe toast behavior

**Expected Results**:

- ✅ Success toast: Green background, checkmark icon
- ✅ Error toast: Red background, X icon
- ✅ Warning toast: Yellow background, alert icon
- ✅ Info toast: Blue background, info icon
- ✅ Auto-dismiss after configured time
- ✅ Manual close button works
- ✅ Multiple toasts stack properly
- ✅ Smooth animations (fade in/out)

---

### Test 7.3: Loading States

**Steps**:

1. Perform actions with loading states
2. Observe UI feedback

**Expected Results**:

- ✅ Login button shows "Logging in..." when clicked
- ✅ Signup button shows loading state
- ✅ Todo operations show loading spinners
- ✅ Buttons disabled during loading
- ✅ Loading states clear on completion

---

### Test 7.4: Form Validation

**Steps**:

1. Try to submit forms with invalid data
2. Test various validation scenarios

**Signup/Login Forms**:

- ✅ Email validation (valid email format)
- ✅ Password minimum length
- ✅ Required fields cannot be empty
- ✅ Error messages displayed inline
- ✅ Form submit disabled until valid

**Todo Forms**:

- ✅ Title required
- ✅ Title minimum length
- ✅ Validation errors displayed

---

### Test 7.5: Responsive Design

**Steps**:

1. Test on different screen sizes
2. Use DevTools responsive mode

**Breakpoints**:

- Mobile (320-768px)
- Tablet (768-1024px)
- Desktop (1024px+)

**Expected Results**:

- ✅ Header collapses to mobile menu
- ✅ Cards stack vertically on mobile
- ✅ Forms adjust width
- ✅ Buttons remain accessible
- ✅ No horizontal scroll
- ✅ Text remains readable

---

## Test Suite 8: Cross-Device Authentication Synchronization

⚠️ **See [CROSS_DEVICE_SYNC.md](./CROSS_DEVICE_SYNC.md) for comprehensive documentation.**

### Test 8.1: Session Creation & Display

**Steps**:

1. Login to Browser A
2. Navigate to `/settings/sessions`
3. Verify session list displays

**Expected Results**:

- ✅ Current session shown with blue ring and "Current Device" badge
- ✅ Device info displayed (browser, OS, device type)
- ✅ IP address shown
- ✅ Created date and last activity timestamps
- ✅ WebSocket connected (check browser console)

**Database Verification**:

```sql
-- In Prisma Studio (http://localhost:5555)
SELECT * FROM sessions;
-- Should show 1 session with deviceInfo JSON
```

---

### Test 8.2: Cross-Device Login & Auto-Refresh

**Steps**:

1. Browser A: Login and stay on `/settings/sessions`
2. Browser B: Open new browser/incognito, login with same credentials
3. Watch Browser A's session list (do NOT refresh manually)

**Expected Results**:

- ✅ Browser A's list automatically refreshes without manual page reload
- ✅ Browser B's session appears in Browser A's list within 1-2 seconds
- ✅ Both sessions visible in both browsers
- ✅ Current device badge shows correctly in each browser
- ✅ Backend logs: "Session update broadcast sent"
- ✅ Browser A console: "[useActiveSessions] Session update received"

**Database Verification**:

```sql
SELECT * FROM sessions WHERE userId = '<user-id>';
-- Should show 2 sessions
```

---

### Test 8.3: Single Device Logout

**Steps**:

1. Login in Browser A and Browser B (same user)
2. In Browser A, go to `/settings/sessions`
3. Click "Logout" button on Browser B's session card
4. Watch Browser B immediately

**Expected Results**:

- ✅ Browser B logged out within 1 second
- ✅ Browser B shows toast: "You have been logged out from this device"
- ✅ Browser B redirected to `/login`
- ✅ Browser A remains logged in
- ✅ Browser A's session list auto-updates (removes Browser B)
- ✅ Database has only 1 session remaining (Browser A)

**Backend Logs**:

```
Force logout broadcast sent to user <user-id>
Session update broadcast sent to user <user-id>
WebSocket client disconnected
```

---

### Test 8.4: Logout All Other Devices

**Steps**:

1. Login in Browser A, B, and C (same user, 3 browsers total)
2. In Browser A, go to `/settings/sessions`
3. Click "Logout All Other Devices" button
4. Watch Browser B and C

**Expected Results**:

- ✅ Browser B and C immediately logged out (within 1 second)
- ✅ Toast in B and C: "You have been logged out from all other devices"
- ✅ Browser A remains logged in (current session NOT logged out)
- ✅ Browser A's session list shows only 1 session (current)
- ✅ Database has only 1 session remaining
- ✅ All 3 browsers were visible before logout, 1 after

**Database Verification**:

```sql
SELECT COUNT(*) FROM sessions WHERE userId = '<user-id>';
-- Should show 1 (only Browser A)
```

---

### Test 8.5: Session Expiration

⏱️ **Duration**: 1-2 minutes

**Setup**:

1. Edit `.env` in backend:
   ```bash
   SESSION_LIFETIME_HOURS=0.0027  # ≈10 seconds
   SESSION_CLEANUP_SCHEDULE="* * * * *"  # Every minute
   ```
2. Restart backend: `npm run dev`

**Steps**:

1. Login to Browser A
2. Wait 10 seconds without any activity (don't move mouse, don't click)
3. Wait up to 60 more seconds for cron job to detect expiration

**Expected Results**:

- ✅ After ~70 seconds total: Browser receives `force-logout` event
- ✅ Toast: "Your session expired due to inactivity"
- ✅ Automatic redirect to `/login?reason=session_expired`
- ✅ Session deleted from database
- ✅ Backend logs: "Expired sessions cleaned up: 1"

**Important**: Restore production values after testing:

```bash
SESSION_LIFETIME_HOURS=168  # 7 days
SESSION_CLEANUP_SCHEDULE="*/15 * * * *"  # Every 15 minutes
```

Then restart backend.

---

### Test 8.6: Maximum Sessions Limit

**Steps**:

1. Login from 6 different browsers/incognito windows with same user
2. Check `/settings/sessions` in any browser
3. Check database

**Expected Results**:

- ✅ Only 5 sessions visible (MAX_SESSIONS_PER_USER=5)
- ✅ Oldest session automatically deleted when 6th created
- ✅ First browser forcefully logged out if still open
- ✅ Database shows max 5 sessions per user

**Database Verification**:

```sql
SELECT COUNT(*) FROM sessions WHERE userId = '<user-id>';
-- Should show exactly 5
```

---

### Test 8.7: WebSocket Reconnection

⏱️ **Duration**: ~30 seconds

**Steps**:

1. Login to Browser A
2. Keep browser open on any authenticated page
3. Restart backend server (Ctrl+C, then `npm run dev`)
4. Watch browser console

**Expected Results**:

- ✅ WebSocket disconnects when backend stops
- ✅ Browser console: "WebSocket disconnected, reason: transport close"
- ✅ Automatic reconnection attempts (max 5)
- ✅ Exponential backoff delays: 1s, 2s, 4s, 8s, 16s
- ✅ When backend restarts: reconnection succeeds
- ✅ Console: "WebSocket reconnected successfully"
- ✅ Re-authenticates automatically with stored token
- ✅ User experience uninterrupted

---

## Test Suite 9: Edge Cases & Error Handling

### Test 9.1: Backend Offline

**Steps**:

1. Stop backend server
2. Try to login

**Expected Results**:

- ✅ Error toast: "Network error"
- ✅ Graceful error handling
- ✅ No app crash
- ✅ User can retry

---

### Test 9.2: Database Connection Lost

**Steps**:

1. Stop PostgreSQL
2. Make authenticated request

**Expected Results**:

- ✅ Backend returns 500 error
- ✅ Frontend shows error message
- ✅ User notified of issue

---

### Test 9.3: Malformed Data

**Steps**:

1. Try to create todo with extremely long title (1000+ chars)
2. Try to send invalid JSON

**Expected Results**:

- ✅ Validation error returned
- ✅ 400 Bad Request
- ✅ Error message explains issue
- ✅ No server crash

---

### Test 9.4: Concurrent Sessions

**Steps**:

1. Login in Browser A
2. Login in Browser B (same user)
3. Logout in Browser A
4. Try to use Browser B

**Expected Results**:

- ✅ Both sessions work independently
- ✅ Logout in A doesn't affect B
- ✅ Each has own access token
- ✅ Shared refresh token (cookie-based)

---

### Test 9.5: Browser Refresh During Session

**Steps**:

1. Login as any user
2. Navigate to /rest page
3. Refresh browser (F5)

**Expected Results**:

- ✅ User remains logged in
- ✅ State persisted from localStorage
- ✅ Page loads correctly
- ✅ No redirect to login

---

## Test Results Template

Use this template to record test results:

```
## Test Run: [Date]
**Tester**: [Name]
**Environment**: [Local/Staging/Production]
**Browser**: [Chrome/Firefox/Safari] [Version]

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 1.1 | User Signup (STARTER) | ✅ PASS | |
| 1.2 | User Signup (PRO) | ✅ PASS | |
| 1.3 | Signup Existing Email | ✅ PASS | |
| ... | ... | ... | ... |

**Issues Found**:
1. [Description of issue]
   - **Severity**: High/Medium/Low
   - **Steps to Reproduce**: ...
   - **Expected**: ...
   - **Actual**: ...

**Summary**:
- Total Tests: 50
- Passed: 48
- Failed: 2
- Blocked: 0
```

---

## Automated Testing Recommendations

For future implementation:

**Backend (E2E Tests)**:

```bash
# Using Jest + Supertest
npm install --save-dev jest supertest @types/jest @types/supertest
```

**Frontend (Component Tests)**:

```bash
# Using Vitest + React Testing Library
npm install --save-dev vitest @testing-library/react @testing-library/user-event
```

**E2E Tests**:

```bash
# Using Playwright or Cypress
npm install --save-dev @playwright/test
```

---

## Testing Schedule

**Before Each Deployment**:

- Run full test suite
- Record results
- Fix critical issues

**Weekly**:

- Smoke tests (Test Suites 1, 3, 6)
- Monitor production errors

**Monthly**:

- Full regression testing
- Performance testing
- Security audit

---

## Success Criteria

Phase 10 testing is complete when:

- ✅ All authentication flows work correctly
- ✅ Session timeout and warnings function as designed
- ✅ RBAC properly restricts access
- ✅ Rate limiting prevents abuse without impacting normal use
- ✅ Token refresh happens seamlessly
- ✅ Navigation and routing work for all user states
- ✅ No critical bugs found
- ✅ Documentation is accurate and complete

---

**Ready to start testing!** Follow each test suite in order and document results.
