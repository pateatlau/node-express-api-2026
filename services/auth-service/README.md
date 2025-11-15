# Phase 2 Backend - Auth Microservice Implementation

**Date**: November 15, 2025  
**Status**: ✅ Setup Complete - Ready for Testing  
**Branch**: `main` (microservices)

---

## 📋 Overview

Successfully extracted authentication functionality from the monolithic backend into a dedicated microservice. The auth-service handles:

- User registration and login
- JWT token generation and validation
- Session management and tracking
- Cross-device authentication synchronization
- Activity tracking and timeout management

---

## 🏗️ Architecture

### Service Structure

```
services/auth-service/
├── src/
│   ├── events/
│   │   └── publisher.ts          # Redis pub/sub event broadcasting
│   ├── lib/
│   │   ├── deviceInfo.utils.ts   # Device detection utilities
│   │   ├── jwt.utils.ts          # JWT token operations
│   │   └── metrics.ts            # Prometheus metrics
│   ├── middleware/
│   │   ├── auth.middleware.ts    # JWT authentication
│   │   └── rateLimiter.ts        # Rate limiting
│   ├── routes/
│   │   └── auth.routes.ts        # All auth endpoints
│   ├── schemas/
│   │   └── auth.schema.ts        # Zod validation schemas
│   ├── services/
│   │   ├── auth.service.ts       # Authentication logic
│   │   └── session.service.ts    # Session management
│   └── index.ts                  # Express app entry point
├── prisma/
│   └── schema.prisma             # Auth database schema
├── .env                          # Environment configuration
├── .env.example                  # Example configuration
├── Dockerfile                    # Production image
├── Dockerfile.dev                # Development image
├── docker-compose.yml            # Service orchestration
├── package.json                  # Dependencies
└── tsconfig.json                 # TypeScript configuration
```

---

## 🔌 API Endpoints

### Public Endpoints

| Method | Endpoint   | Description                       |
| ------ | ---------- | --------------------------------- |
| GET    | `/config`  | Get session timeout configuration |
| POST   | `/signup`  | Register new user                 |
| POST   | `/login`   | Login with email/password         |
| POST   | `/refresh` | Refresh access token              |

### Protected Endpoints (Require Bearer Token)

| Method | Endpoint        | Description                  |
| ------ | --------------- | ---------------------------- |
| GET    | `/me`           | Get current user info        |
| GET    | `/session`      | Get current session status   |
| GET    | `/sessions`     | Get all active sessions      |
| POST   | `/logout`       | Logout current session       |
| POST   | `/activity`     | Update last activity         |
| DELETE | `/sessions/:id` | Terminate specific session   |
| DELETE | `/sessions/all` | Terminate all other sessions |

### System Endpoints

| Method | Endpoint   | Description        |
| ------ | ---------- | ------------------ |
| GET    | `/health`  | Health check       |
| GET    | `/metrics` | Prometheus metrics |

---

## 🗄️ Database Schema

**Database**: PostgreSQL (dedicated instance on port 5433)  
**Name**: `auth_db`

### Tables

**users**

```prisma
model User {
  id             String    @id @default(uuid())
  name           String
  email          String    @unique
  password       String    // bcrypt hashed
  role           Role      @default(STARTER)
  lastActivityAt DateTime  @default(now())
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  sessions       Session[]
}
```

**sessions**

```prisma
model Session {
  id           String   @id @default(uuid())
  userId       String
  sessionToken String   @unique
  deviceInfo   Json
  ipAddress    String?
  lastActivity DateTime @default(now())
  createdAt    DateTime @default(now())
  expiresAt    DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 🔄 Event-Driven Architecture

### Redis Pub/Sub Events

The auth-service publishes events to Redis for cross-service communication:

| Event              | Channel                         | Data                                  |
| ------------------ | ------------------------------- | ------------------------------------- |
| User Registered    | `auth:user.registered`          | userId, email                         |
| User Login         | `auth:user.login`               | userId, sessionId                     |
| User Logout        | `auth:user.logout`              | userId, sessionId                     |
| Session Created    | `auth:session.created`          | userId, sessionId, deviceInfo         |
| Session Terminated | `auth:session.terminated`       | userId, sessionId, targetSessionToken |
| Session Deleted    | `auth:session.deleted`          | userId, sessionId, reason             |
| Bulk Termination   | `auth:sessions.bulk_terminated` | userId, count                         |
| Activity Updated   | `auth:session.activity_updated` | userId, sessionId                     |
| Token Refreshed    | `auth:token.refreshed`          | userId                                |

---

## 🚀 Deployment Configuration

### Docker Compose Services

```yaml
services:
  auth-service:
    container: auth-service
    port: 4001
    database: postgres-auth:5432/auth_db
    redis: redis-caddy:6379
    health: /health

  postgres-auth:
    container: postgres-auth
    port: 5433 (host) -> 5432 (container)
    database: auth_db
    user: postgres
    volume: postgres-auth-data
```

### Environment Variables

```env
NODE_ENV=development
PORT=4001
SERVICE_NAME=auth-service
DATABASE_URL=postgresql://postgres:postgres@postgres-auth:5432/auth_db
REDIS_URL=redis://redis-caddy:6379
JWT_ACCESS_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
SESSION_TIMEOUT_MINUTES=5
SESSION_LIFETIME_HOURS=168
MAX_SESSIONS_PER_USER=5
CORS_ORIGIN=http://localhost:8080
```

---

## 🔀 Caddy Routing

### Updated Caddyfile.dev

```caddyfile
# Auth Service (Microservice - Phase 2)
handle /api/auth/* {
    reverse_proxy {
        to auth-service:4001
        health_uri /health
        health_interval 10s
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
    }
}

# Legacy backend for all other /api/* routes
handle /api/* {
    reverse_proxy {
        to backend-1:4001 backend-2:4002 backend-3:4003
        lb_policy least_conn
        health_uri /health
    }
}
```

### Feature Flag Approach

To enable gradual migration, you can:

1. **Full Microservice** (default): All `/api/auth/*` goes to auth-service
2. **Legacy Fallback**: Comment out auth-service block in Caddyfile to route to legacy backend
3. **Percentage Rollout**: Use Caddy's load balancing to split traffic

---

## 📊 Monitoring

### Prometheus Metrics

- `auth_operations_total{operation, status}` - Total auth operations
- `auth_tokens_generated_total{type}` - Tokens generated
- `auth_password_hash_duration_seconds` - Password hashing time
- `auth_active_sessions` - Current active sessions

### Health Checks

- **Auth Service**: `http://localhost:4001/health`
- **PostgreSQL**: `pg_isready -U postgres -d auth_db`
- **Caddy Gateway**: `http://localhost:8080/health`

---

## 🧪 Testing Checklist

### Service Health

- [ ] Auth service starts successfully
- [ ] PostgreSQL auth_db accessible
- [ ] Redis connection established
- [ ] Prisma migrations applied

### API Functionality

- [ ] POST `/signup` - User registration
- [ ] POST `/login` - User login
- [ ] GET `/me` - Get user info
- [ ] POST `/refresh` - Token refresh
- [ ] GET `/sessions` - List sessions
- [ ] DELETE `/sessions/:id` - Terminate session
- [ ] DELETE `/sessions/all` - Terminate all sessions
- [ ] POST `/logout` - Logout

### Integration

- [ ] Requests from Caddy gateway work
- [ ] Redis events published correctly
- [ ] Session timeouts respected
- [ ] Cross-device logout functions
- [ ] Rate limiting works

### Security

- [ ] JWT tokens validated
- [ ] Passwords hashed with bcrypt
- [ ] CORS configured correctly
- [ ] Rate limiting prevents abuse
- [ ] Refresh tokens in httpOnly cookies

---

## 🚦 Getting Started

### 1. Install Dependencies

```bash
cd services/auth-service
npm install
```

### 2. Setup Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Or in Docker
docker-compose up -d postgres-auth
docker-compose exec auth-service npm run prisma:migrate:deploy
```

### 3. Start Service

**Standalone (Development)**:

```bash
npm run dev
```

**Docker Compose**:

```bash
docker-compose up -d
```

### 4. Verify Health

```bash
curl http://localhost:4001/health
```

### 5. Test Authentication

```bash
# Register
curl -X POST http://localhost:4001/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:4001/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 🔧 Development Commands

```bash
# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production
npm start

# Type check
npm run type-check

# Prisma commands
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio

# Docker commands
docker-compose up -d              # Start all services
docker-compose logs -f auth-service  # View logs
docker-compose down               # Stop all services
```

---

## 🐛 Troubleshooting

### Service Won't Start

1. Check PostgreSQL is running: `docker ps | grep postgres-auth`
2. Check Redis is running: `docker ps | grep redis`
3. Verify environment variables in `.env`
4. Check logs: `docker-compose logs auth-service`

### Database Connection Issues

1. Ensure DATABASE_URL is correct
2. Check postgres-auth health: `docker-compose ps`
3. Test connection: `docker-compose exec postgres-auth psql -U postgres -d auth_db`

### Prisma Migration Errors

1. Reset database: `npm run prisma:migrate reset`
2. Push schema: `npm run db:push`
3. Generate client: `npm run prisma:generate`

### Redis Pub/Sub Not Working

1. Check Redis connection: `docker-compose exec redis-caddy redis-cli ping`
2. Monitor events: `docker-compose exec redis-caddy redis-cli MONITOR`
3. Verify REDIS_URL in .env

---

## 📈 Migration Strategy

### Phase 2.1: Parallel Operation (Week 3)

- ✅ Auth service deployed alongside monolith
- ✅ Caddy routes `/api/auth/*` to auth-service
- ⚠️ Monolith still has auth code (backup)
- Monitor metrics and errors

### Phase 2.2: Traffic Validation (Week 3-4)

- Start with 10% traffic to auth-service
- Monitor error rates and performance
- Gradually increase to 50%, then 100%
- Keep feature flag to roll back if needed

### Phase 2.3: Monolith Cleanup (Week 4)

- Remove auth routes from monolith
- Archive legacy auth code
- Update documentation
- Celebrate! 🎉

---

## 📚 Next Steps

### Phase 3: AI Microservice (Weeks 7-8)

- Extract AI/Chat functionality
- Create ai-service on port 4002
- Integrate with OpenAI API
- RAG implementation (optional)

### Phase 4: Todos Microservice (Future)

- Extract todos CRUD operations
- Create todos-service on port 4003
- Support both REST and GraphQL

### Phase 5: WebSocket Gateway (Future)

- Dedicated websocket-gateway on port 4004
- Real-time session updates
- Chat notifications
- Cross-device sync

---

## ✅ Completion Checklist

- [x] Service structure created
- [x] Authentication logic extracted
- [x] Session management implemented
- [x] Redis pub/sub events
- [x] Prisma schema and migrations
- [x] Docker configuration
- [x] Caddy routing updated
- [ ] Testing complete
- [ ] Documentation finalized
- [ ] Production deployment ready

---

**Phase 2 Status**: ✅ **SETUP COMPLETE**  
**Next Action**: Start auth-service and test all endpoints  
**Estimated Testing Time**: 1-2 hours

---

_Last Updated: November 15, 2025_  
_Version: 1.0.0_  
_Author: Development Team_
