# Backend Endpoints Checklist for Caddy Configuration

## 📋 Current Endpoints

### ✅ Health & Monitoring

- **GET** `/health` - Health check endpoint (no auth required)
  - Returns: `{status, database, instance_id, uptime, timestamp}`
  - **Caching**: ❌ No (always fresh)
  - **Rate Limiting**: ✅ Moderate (part of API limiter)

### 🔐 Authentication Endpoints

- **POST** `/api/auth/register` - User registration
- **POST** `/api/auth/login` - User login
- **POST** `/api/auth/logout` - User logout
- **POST** `/api/auth/refresh` - Refresh access token
- **GET** `/api/auth/session` - Get current session
- **Caching**: ❌ No (always fresh, user-specific)
- **Rate Limiting**: ✅ Strict (5 req/15min for login/register)

### 📝 Todo Endpoints

- **GET** `/api/todos` - List all todos (user-specific)
- **POST** `/api/todos` - Create new todo
- **GET** `/api/todos/:id` - Get single todo
- **PUT** `/api/todos/:id` - Update todo
- **DELETE** `/api/todos/:id` - Delete todo
- **Caching**:
  - GET requests: ✅ Yes (5 minutes)
  - POST/PUT/DELETE: ❌ No
- **Rate Limiting**: ✅ Moderate (100 req/15min)

### 🔍 GraphQL Endpoint

- **POST** `/graphql` - GraphQL queries and mutations
- **GET** `/graphql` - GraphQL playground (development only)
- **Caching**:
  - Queries (GET): ✅ Yes (1 minute)
  - Mutations (POST): ❌ No
- **Rate Limiting**: ✅ Moderate (100 req/15min for queries, 30 req/15min for mutations)

### 🔌 WebSocket Endpoint

- **WS** `/socket.io/*` - Socket.io WebSocket connection
  - Used for: Cross-device authentication sync
  - **Caching**: ❌ Not applicable (WebSocket)
  - **Rate Limiting**: ✅ Connection limit (50 req/15min for session logout)
  - **Load Balancing**: ⚠️ Requires sticky sessions (ip_hash)

### 📚 Documentation

- **GET** `/api-docs` - Swagger API documentation
- **Caching**: ✅ Yes (long TTL - static content)
- **Rate Limiting**: ✅ Light

### 🏠 Root Endpoint

- **GET** `/` - API information and available endpoints
- **Caching**: ✅ Yes (long TTL)
- **Rate Limiting**: ✅ Light

---

## 🎯 Caddy Configuration Requirements

### Endpoints That Should Be Cached

✅ **Cache these (GET requests only):**

- `/api/todos` (5 minutes)
- `/api/todos/:id` (5 minutes)
- `/graphql` (1 minute, only GET/queries)
- `/api-docs` (30 minutes)
- `/` (30 minutes)

❌ **Never cache these:**

- `/health` (always fresh for health checks)
- `/api/auth/*` (user-specific, security sensitive)
- Any POST/PUT/DELETE requests
- `/socket.io/*` (WebSocket, not cacheable)

### Endpoints Requiring Special Handling

#### 1. WebSocket (`/socket.io/*`)

```caddyfile
# Must use ip_hash for sticky sessions
lb_policy ip_hash
# Longer timeouts for persistent connections
transport http {
    read_timeout 7d
    write_timeout 7d
}
```

#### 2. Health Check (`/health`)

```caddyfile
# No caching, used for load balancer health checks
# Should respond quickly
# No rate limiting (internal use)
```

#### 3. Authentication (`/api/auth/*`)

```caddyfile
# No caching (user-specific)
# Strict rate limiting already in app
# Forward all headers (cookies, auth tokens)
```

#### 4. GraphQL (`/graphql`)

```caddyfile
# Cache GET requests (queries) only
# Don't cache POST requests (mutations)
# Preserve all headers (authorization)
```

---

## 🔒 CORS Configuration

### Allowed Origins

- Development: `http://localhost:5173`
- Production: Will be configured in environment

### Required Headers

- `X-Forwarded-For` - Client IP address
- `X-Forwarded-Proto` - Request protocol (http/https)
- `X-Forwarded-Host` - Original host header
- `X-Real-IP` - Client real IP

---

## 📊 Rate Limiting Configuration

Current rate limiting in backend:

- **API General**: 500 req/15min per user
- **Auth Endpoints**: 5 req/15min per IP (login/register)
- **GraphQL Queries**: 100 req/15min per user
- **GraphQL Mutations**: 30 req/15min per user
- **Session Logout**: 50 req/15min per IP

**Caddy should add gateway-level rate limiting:**

- 100 requests per minute per IP (general)
- This works **in addition to** backend rate limiting

---

## ✅ Phase 1 Completion Checklist

### Backend Configuration

- [x] Added `TRUSTED_PROXY` environment variable
- [x] Added `INSTANCE_ID` environment variable
- [x] Enabled `trust proxy` in Express
- [x] Updated `/health` endpoint to return instance_id
- [x] Documented all current endpoints

### Directory Structure

- [x] Created `caddy/config/` directory
- [x] Created `caddy/data/` directory
- [x] Created `caddy/logs/` directory
- [x] Created endpoint documentation

### Next Steps (Phase 2)

- [ ] Create `Caddyfile.dev` configuration
- [ ] Create `Caddyfile.prod` configuration
- [ ] Test Caddyfile syntax
- [ ] Document cache strategy

---

## 📝 Notes

### Current Setup

- **Framework**: Express.js + TypeScript
- **Port**: 4000 (development), will use 4001/4002/4003 for multiple instances
- **Database**: PostgreSQL (primary) + MongoDB (optional)
- **API Type**: Both REST and GraphQL
- **WebSocket**: Socket.io for real-time sync

### Considerations

1. Backend already has rate limiting - Caddy adds gateway-level protection
2. Backend uses JWT tokens in cookies - Caddy must forward all cookies
3. CORS is configured in backend - Caddy just proxies, doesn't modify
4. WebSocket requires sticky sessions to maintain connection state

---

**Document Created**: November 13, 2025  
**Status**: Phase 1 Complete ✅  
**Next Phase**: Create Caddyfile configurations
