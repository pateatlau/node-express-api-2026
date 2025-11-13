# Caddy Reverse Proxy Implementation Action Plan

## 📋 Overview

This action plan guides you through implementing **Caddy** as a reverse proxy for your Node.js + Express backend, providing automatic HTTPS, load balancing, and caching with minimal configuration.

**Project Context:**

- Backend: Node.js + Express + TypeScript (Port 4000)
- APIs: REST + GraphQL + WebSocket (Socket.io)
- Databases: PostgreSQL + MongoDB
- Container: Docker + Docker Compose

**Implementation Timeline:** 3-5 days
**Complexity:** Low-Medium
**Risk Level:** Low

---

## 🎯 Goals

- [x] Set up Caddy as reverse proxy
- [x] Automatic HTTPS with Let's Encrypt
- [x] Load balance across 3 backend instances
- [x] Cache GET requests to reduce backend load
- [x] Proxy WebSocket connections for Socket.io
- [x] Add rate limiting and security headers
- [x] Health checks for backend instances
- [x] Monitoring and logging

---

## 📦 Phase 1: Preparation (Day 1 - Morning)

### 1.1 Create Directory Structure

```bash
cd /Users/patea/2026/projects/node-express-api-2026

# Create Caddy configuration directory
mkdir -p caddy/{config,data,logs}

# Set permissions
chmod 755 caddy
```

**Expected Output:**

```
node-express-api-2026/
├── caddy/
│   ├── config/        # Caddyfile location
│   ├── data/          # SSL certificates, cache
│   └── logs/          # Access and error logs
```

### 1.2 Document Current Setup

Create a checklist of your current configuration:

```bash
# Check current endpoints
echo "Current Endpoints:"
echo "- REST API: http://localhost:4000/api/*"
echo "- GraphQL: http://localhost:4000/graphql"
echo "- WebSocket: http://localhost:4000/socket.io"
echo "- Health: http://localhost:4000/health"
```

**Action Items:**

- [ ] List all API endpoints that need proxying
- [ ] Identify which endpoints should be cached (GET requests)
- [ ] Identify which endpoints need authentication bypass (health checks)
- [ ] Document current rate limiting configuration (from your middleware)

### 1.3 Update Backend for Proxy Awareness

**File: `src/config/env.ts`**

Add environment variable for trusted proxy:

```typescript
TRUSTED_PROXY: z.string().optional().default('caddy'),
```

**File: `src/app.ts`** (or where you configure Express)

Add trust proxy setting:

```typescript
// Trust Caddy proxy
if (env.NODE_ENV === 'production' || env.TRUSTED_PROXY) {
  app.set('trust proxy', true);
}
```

This ensures your backend correctly reads `X-Forwarded-For` headers from Caddy.

**Action Items:**

- [ ] Add `TRUSTED_PROXY` to env schema
- [ ] Enable `trust proxy` in Express
- [ ] Update CORS configuration to trust Caddy (if needed)

---

## 🔧 Phase 2: Basic Caddy Setup (Day 1 - Afternoon)

### 2.1 Create Caddyfile (Development)

**File: `caddy/config/Caddyfile.dev`**

```caddyfile
# Development Caddyfile (HTTP only, no SSL)
{
    # Global options
    admin localhost:2019
    log {
        output file /var/log/caddy/access.log
        format json
        level INFO
    }
}

# Development domain (localhost)
localhost:8080 {
    # Enable logging
    log {
        output file /var/log/caddy/localhost.log {
            roll_size 10MB
            roll_keep 10
        }
    }

    # Health check endpoint (bypass proxy for Caddy health)
    handle /caddy-health {
        respond "Caddy is healthy" 200
    }

    # Backend health check (no caching)
    handle /health {
        reverse_proxy {
            to backend-1:4001 backend-2:4002 backend-3:4003
            lb_policy least_conn
            health_uri /health
            health_interval 10s
            health_timeout 5s
            health_status 200
        }
    }

    # WebSocket endpoint (Socket.io)
    handle /socket.io/* {
        reverse_proxy {
            to backend-1:4001 backend-2:4002 backend-3:4003
            lb_policy ip_hash  # Sticky sessions for WebSocket
            health_uri /health
            health_interval 10s

            # WebSocket headers
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # REST API endpoints
    handle /api/* {
        # Simple caching for GET requests
        cache {
            ttl 5m
            match_path /api/*
            match_method GET
            key {
                path
                query
            }
        }

        reverse_proxy {
            to backend-1:4001 backend-2:4002 backend-3:4003
            lb_policy least_conn
            health_uri /health
            health_interval 10s

            # Proxy headers
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Forwarded-Host {host}
        }
    }

    # GraphQL endpoint
    handle /graphql* {
        # Cache only GET queries (not mutations)
        cache {
            ttl 1m
            match_path /graphql
            match_method GET
            key {
                path
                query
            }
        }

        reverse_proxy {
            to backend-1:4001 backend-2:4002 backend-3:4003
            lb_policy least_conn
            health_uri /health
            health_interval 10s

            # Proxy headers
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # Catch-all for other routes
    handle {
        reverse_proxy {
            to backend-1:4001 backend-2:4002 backend-3:4003
            lb_policy least_conn
            health_uri /health
        }
    }

    # Enable gzip compression
    encode gzip

    # Security headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

**Action Items:**

- [ ] Create `caddy/config/Caddyfile.dev`
- [ ] Review and customize caching TTL values
- [ ] Verify endpoint paths match your backend

### 2.2 Create Production Caddyfile

**File: `caddy/config/Caddyfile.prod`**

```caddyfile
# Production Caddyfile (Automatic HTTPS!)
{
    # Email for Let's Encrypt
    email your-email@example.com

    # Admin API (restrict to localhost)
    admin localhost:2019

    # Global log
    log {
        output file /var/log/caddy/access.log {
            roll_size 100MB
            roll_keep 30
        }
        format json
        level INFO
    }
}

# Production domain (replace with your actual domain)
api.yourdomain.com {
    # Enable detailed logging
    log {
        output file /var/log/caddy/api.log {
            roll_size 100MB
            roll_keep 30
        }
    }

    # Automatic HTTPS (Let's Encrypt)
    # No configuration needed - Caddy handles it!

    # Rate limiting (requires caddy-ratelimit plugin)
    rate_limit {
        zone {
            key {remote_host}
            events 100
            window 1m
        }
    }

    # Health check endpoint
    handle /health {
        reverse_proxy {
            to backend-1:4001 backend-2:4002 backend-3:4003
            lb_policy least_conn
            health_uri /health
            health_interval 30s
            health_timeout 10s
            health_status 200

            # Fail fast
            fail_duration 30s
            max_fails 3
        }
    }

    # WebSocket endpoint (Socket.io)
    handle /socket.io/* {
        reverse_proxy {
            to backend-1:4001 backend-2:4002 backend-3:4003
            lb_policy ip_hash  # Sticky sessions
            health_uri /health
            health_interval 30s

            # Long timeout for WebSocket
            transport http {
                read_timeout 7d
                write_timeout 7d
            }

            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # REST API with caching
    handle /api/* {
        cache {
            ttl 5m
            match_path /api/*
            match_method GET
            key {
                path
                query
                header Authorization  # Cache per user if authenticated
            }
            # Don't cache errors
            match_status 200 201
        }

        reverse_proxy {
            to backend-1:4001 backend-2:4002 backend-3:4003
            lb_policy least_conn
            health_uri /health
            health_interval 30s
            fail_duration 30s
            max_fails 3

            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Forwarded-Host {host}
        }
    }

    # GraphQL with minimal caching
    handle /graphql* {
        cache {
            ttl 1m
            match_path /graphql
            match_method GET
            key {
                path
                query
                header Authorization
            }
            match_status 200
        }

        reverse_proxy {
            to backend-1:4001 backend-2:4002 backend-3:4003
            lb_policy least_conn
            health_uri /health
            health_interval 30s

            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # Catch-all
    handle {
        reverse_proxy {
            to backend-1:4001 backend-2:4002 backend-3:4003
            lb_policy least_conn
            health_uri /health
        }
    }

    # Compression
    encode zstd gzip

    # Security headers
    header {
        # HSTS
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        # Remove server header
        -Server
    }
}

# HTTP redirect (automatic)
http://api.yourdomain.com {
    redir https://api.yourdomain.com{uri} permanent
}
```

**Action Items:**

- [ ] Create `caddy/config/Caddyfile.prod`
- [ ] Replace `your-email@example.com` with your actual email
- [ ] Replace `api.yourdomain.com` with your actual domain
- [ ] Review rate limiting values (100 req/min per IP)

---

## 🐳 Phase 3: Docker Integration (Day 2 - Morning)

### 3.1 Update Backend Dockerfile

**No changes needed!** Your existing `Dockerfile` is perfect. Just verify the `EXPOSE` port:

**File: `Dockerfile`**

```dockerfile
# Should already have this
EXPOSE 4000
```

### 3.2 Create Docker Compose with Caddy

**File: `docker-compose.caddy.yml`**

```yaml
version: '3.8'

services:
  # Caddy Reverse Proxy
  caddy:
    image: caddy:2.7-alpine
    container_name: todo-caddy
    ports:
      - '80:80' # HTTP
      - '443:443' # HTTPS
      - '443:443/udp' # HTTP/3
      - '2019:2019' # Admin API (localhost only)
    volumes:
      # Configuration
      - ./caddy/config/Caddyfile.dev:/etc/caddy/Caddyfile:ro
      # Data persistence (SSL certs, cache)
      - caddy_data:/data
      - caddy_config:/config
      # Logs
      - ./caddy/logs:/var/log/caddy
    environment:
      - CADDY_ADMIN=0.0.0.0:2019
    networks:
      - todo-network
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:2019/config/']
      interval: 30s
      timeout: 10s
      retries: 3
    depends_on:
      - backend-1
      - backend-2
      - backend-3

  # Backend Instance 1
  backend-1:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: todo-backend-1
    expose:
      - '4001' # Internal only, not published
    environment:
      - NODE_ENV=production
      - PORT=4001
      - API_TYPE=both
      - DB_TYPE=${DB_TYPE:-postgres}
      - DATABASE_URL=${DATABASE_URL}
      - MONGODB_URL=${MONGODB_URL}
      - INSTANCE_ID=backend-1
      - TRUSTED_PROXY=caddy
    networks:
      - todo-network
    depends_on:
      postgres:
        condition: service_healthy
      mongodb:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:4001/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Backend Instance 2
  backend-2:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: todo-backend-2
    expose:
      - '4002'
    environment:
      - NODE_ENV=production
      - PORT=4002
      - API_TYPE=both
      - DB_TYPE=${DB_TYPE:-postgres}
      - DATABASE_URL=${DATABASE_URL}
      - MONGODB_URL=${MONGODB_URL}
      - INSTANCE_ID=backend-2
      - TRUSTED_PROXY=caddy
    networks:
      - todo-network
    depends_on:
      postgres:
        condition: service_healthy
      mongodb:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:4002/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Backend Instance 3
  backend-3:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: todo-backend-3
    expose:
      - '4003'
    environment:
      - NODE_ENV=production
      - PORT=4003
      - API_TYPE=both
      - DB_TYPE=${DB_TYPE:-postgres}
      - DATABASE_URL=${DATABASE_URL}
      - MONGODB_URL=${MONGODB_URL}
      - INSTANCE_ID=backend-3
      - TRUSTED_PROXY=caddy
    networks:
      - todo-network
    depends_on:
      postgres:
        condition: service_healthy
      mongodb:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:4003/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    container_name: todo-postgres
    environment:
      - POSTGRES_USER=todouser
      - POSTGRES_PASSWORD=todopassword
      - POSTGRES_DB=tododb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - todo-network
    restart: unless-stopped
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U todouser -d tododb']
      interval: 10s
      timeout: 5s
      retries: 5

  # MongoDB Database
  mongodb:
    image: mongo:7.0
    container_name: todo-mongodb
    environment:
      - MONGO_INITDB_ROOT_USERNAME=todouser
      - MONGO_INITDB_ROOT_PASSWORD=todopassword
      - MONGO_INITDB_DATABASE=tododb
    volumes:
      - mongodb_data:/data/db
    networks:
      - todo-network
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  mongodb_data:
  caddy_data:
  caddy_config:

networks:
  todo-network:
    driver: bridge
```

**Action Items:**

- [ ] Create `docker-compose.caddy.yml`
- [ ] Update `DATABASE_URL` and `MONGODB_URL` in `.env`
- [ ] Verify service names match Caddyfile upstream configuration

### 3.3 Create Environment Variables

**File: `.env.caddy`**

```bash
# Database Configuration
DB_TYPE=postgres
DATABASE_URL=postgresql://todouser:todopassword@postgres:5432/tododb
MONGODB_URL=mongodb://todouser:todopassword@mongodb:27017/tododb?authSource=admin

# Backend Configuration
NODE_ENV=production
API_TYPE=both

# Caddy Configuration
CADDY_DOMAIN=localhost:8080  # Change to api.yourdomain.com in production
CADDY_EMAIL=your-email@example.com

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Optional: Redis for session/cache
# REDIS_URL=redis://redis:6379
```

**Action Items:**

- [ ] Create `.env.caddy` file
- [ ] Generate secure JWT secret: `openssl rand -base64 32`
- [ ] Add `.env.caddy` to `.gitignore`

---

## 🧪 Phase 4: Testing (Day 2 - Afternoon)

### 4.1 Start Services

```bash
# Build backend images
docker-compose -f docker-compose.caddy.yml build

# Start all services
docker-compose -f docker-compose.caddy.yml up -d

# Check all services are running
docker-compose -f docker-compose.caddy.yml ps

# Expected output:
# todo-caddy       running   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
# todo-backend-1   running   (healthy)
# todo-backend-2   running   (healthy)
# todo-backend-3   running   (healthy)
# todo-postgres    running   (healthy)
# todo-mongodb     running   (healthy)
```

### 4.2 Verify Caddy Configuration

```bash
# Check Caddy config is valid
docker exec todo-caddy caddy validate --config /etc/caddy/Caddyfile

# Expected output: "Valid configuration"

# Check Caddy is running
docker exec todo-caddy caddy list-modules

# View Caddy logs
docker logs todo-caddy --tail 50
```

### 4.3 Test Health Checks

```bash
# Test Caddy health
curl http://localhost:8080/caddy-health
# Expected: "Caddy is healthy"

# Test backend health through Caddy
curl http://localhost:8080/health
# Expected: {"status": "healthy", ...}

# Test direct backend (should still work)
curl http://localhost:4001/health
# This should FAIL (port not exposed) - that's correct!
```

### 4.4 Test API Endpoints

```bash
# Test REST API
curl http://localhost:8080/api/health
curl -X GET http://localhost:8080/api/todos

# Test with headers to see proxy info
curl -v http://localhost:8080/api/todos 2>&1 | grep "X-"

# Expected headers:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block

# Test GraphQL
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'

# Expected: {"data":{"__typename":"Query"}}
```

### 4.5 Test Caching

```bash
# First request (cache MISS)
time curl -s http://localhost:8080/api/todos > /dev/null
# Note the time (e.g., 0.150s)

# Second request (cache HIT - should be much faster!)
time curl -s http://localhost:8080/api/todos > /dev/null
# Note the time (e.g., 0.015s) - 10x faster!

# Check cache headers
curl -I http://localhost:8080/api/todos | grep -i cache

# Test cache invalidation with POST
curl -X POST http://localhost:8080/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Todo", "completed": false}'

# Verify GET is still cached but different response
curl http://localhost:8080/api/todos
```

### 4.6 Test WebSocket Connection

Create a test file:

**File: `test-websocket.js`**

```javascript
// Run: node test-websocket.js
import { io } from 'socket.io-client';

const socket = io('http://localhost:8080', {
  transports: ['websocket'],
  auth: {
    token: 'your-jwt-token-here',
  },
});

socket.on('connect', () => {
  console.log('✅ WebSocket connected via Caddy!');
  console.log('Socket ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ WebSocket connection failed:', error.message);
});

socket.on('disconnect', () => {
  console.log('WebSocket disconnected');
});

// Keep alive for 10 seconds
setTimeout(() => {
  socket.disconnect();
  process.exit(0);
}, 10000);
```

```bash
# Install socket.io-client if not already
npm install socket.io-client

# Run test
node test-websocket.js

# Expected: "✅ WebSocket connected via Caddy!"
```

### 4.7 Test Load Balancing

```bash
# Send 30 requests and check which backend handles them
for i in {1..30}; do
  curl -s http://localhost:8080/health | jq -r '.instance_id // "unknown"'
done | sort | uniq -c

# Expected output (roughly equal distribution):
#   10 backend-1
#   10 backend-2
#   10 backend-3
```

**Action Items:**

- [ ] All tests pass ✅
- [ ] Cache is working (10x speed improvement)
- [ ] Load balancing distributes evenly
- [ ] WebSocket connects successfully
- [ ] Security headers are present

---

## 📊 Phase 5: Monitoring & Observability (Day 3)

### 5.1 Set Up Caddy Admin API

```bash
# Access Caddy admin API
curl http://localhost:2019/config/ | jq

# Get reverse proxy stats
curl http://localhost:2019/config/apps/http/servers

# Get current upstreams
curl http://localhost:2019/config/apps/http/servers/srv0/routes
```

### 5.2 View Logs

```bash
# Tail Caddy access logs (JSON format)
tail -f caddy/logs/access.log | jq

# Filter for errors only
tail -f caddy/logs/access.log | jq 'select(.level == "error")'

# Filter for slow requests (>500ms)
tail -f caddy/logs/access.log | jq 'select(.duration > 0.5)'

# Count requests per endpoint
cat caddy/logs/access.log | jq -r '.request.uri' | sort | uniq -c | sort -rn | head -10
```

### 5.3 Create Monitoring Script

**File: `scripts/monitor-caddy.sh`**

```bash
#!/bin/bash
# Caddy monitoring script

echo "=== Caddy Health Check ==="
curl -s http://localhost:8080/caddy-health
echo ""

echo "=== Backend Health ==="
curl -s http://localhost:8080/health | jq
echo ""

echo "=== Active Connections ==="
docker stats todo-caddy --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
echo ""

echo "=== Backend Instance Stats ==="
docker stats todo-backend-1 todo-backend-2 todo-backend-3 --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo ""

echo "=== Recent Errors (last 10) ==="
tail -100 caddy/logs/access.log | jq 'select(.level == "error")' | tail -10
echo ""

echo "=== Top 10 Endpoints ==="
tail -1000 caddy/logs/access.log | jq -r '.request.uri' | sort | uniq -c | sort -rn | head -10
```

```bash
# Make executable
chmod +x scripts/monitor-caddy.sh

# Run monitoring
./scripts/monitor-caddy.sh
```

### 5.4 Set Up Prometheus Metrics (Optional)

Install Caddy with Prometheus plugin:

**File: `caddy/Dockerfile.metrics`**

```dockerfile
FROM caddy:2.7-builder AS builder

RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit \
    --with github.com/caddyserver/cache-handler \
    --with github.com/hslatman/caddy-prometheus

FROM caddy:2.7-alpine

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

Update Caddyfile to expose metrics:

```caddyfile
# Add to global options
{
    servers {
        metrics
    }
}

# Add metrics endpoint
localhost:9090 {
    metrics /metrics
}
```

**Action Items:**

- [ ] Set up log monitoring
- [ ] Create monitoring script
- [ ] (Optional) Set up Prometheus metrics
- [ ] Configure alerts for errors

---

## 🚀 Phase 6: Production Deployment (Day 4-5)

### 6.1 DNS Configuration

Before deploying to production:

```bash
# 1. Purchase domain (if not already done)
# 2. Point A record to your server IP
# Example:
# api.yourdomain.com  A  1.2.3.4
# www.api.yourdomain.com  CNAME  api.yourdomain.com

# 3. Verify DNS propagation
dig api.yourdomain.com
nslookup api.yourdomain.com
```

### 6.2 Update Production Configuration

**File: `docker-compose.prod.yml`**

```yaml
version: '3.8'

services:
  caddy:
    image: caddy:2.7-alpine
    container_name: todo-caddy-prod
    ports:
      - '80:80'
      - '443:443'
      - '443:443/udp'
    volumes:
      - ./caddy/config/Caddyfile.prod:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      - ./caddy/logs:/var/log/caddy
    environment:
      - CADDY_ADMIN=localhost:2019
    networks:
      - todo-network
    restart: always
    depends_on:
      - backend-1
      - backend-2
      - backend-3

  # ... (rest of services same as docker-compose.caddy.yml)
```

### 6.3 Deploy to Production

```bash
# On production server:

# 1. Pull latest code
git pull origin main

# 2. Update environment variables
cp .env.example .env.prod
nano .env.prod  # Set production values

# 3. Build images
docker-compose -f docker-compose.prod.yml build

# 4. Start services
docker-compose -f docker-compose.prod.yml up -d

# 5. Watch logs for any errors
docker-compose -f docker-compose.prod.yml logs -f caddy

# 6. Wait for Let's Encrypt certificate (1-2 minutes)
# Caddy will automatically obtain SSL certificate!

# 7. Verify HTTPS is working
curl https://api.yourdomain.com/health

# 8. Check SSL certificate
openssl s_client -connect api.yourdomain.com:443 -servername api.yourdomain.com < /dev/null | grep "Verify return code"
# Expected: "Verify return code: 0 (ok)"
```

### 6.4 Post-Deployment Verification

```bash
# Test all endpoints
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/api/todos
curl -X POST https://api.yourdomain.com/graphql -d '{"query":"{ __typename }"}'

# Check SSL grade (wait 5 minutes for initial scan)
curl "https://api.ssllabs.com/api/v3/analyze?host=api.yourdomain.com"

# Test from different locations
curl -I https://api.yourdomain.com/health

# Test rate limiting
for i in {1..150}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://api.yourdomain.com/api/todos
done | grep "429" | wc -l
# Should see some 429 (Too Many Requests) responses
```

**Action Items:**

- [ ] DNS configured and propagated
- [ ] SSL certificate obtained automatically (Let's Encrypt)
- [ ] HTTPS working with A+ SSL grade
- [ ] All endpoints accessible
- [ ] Rate limiting working
- [ ] Monitoring in place

---

## 🔄 Phase 7: Optimization & Tuning (Ongoing)

### 7.1 Cache Tuning

Monitor cache hit ratio:

```bash
# Count cache hits vs misses
grep -o '"cache_status":"[^"]*"' caddy/logs/access.log | sort | uniq -c

# Calculate hit ratio
HITS=$(grep '"cache_status":"hit"' caddy/logs/access.log | wc -l)
TOTAL=$(grep '"cache_status"' caddy/logs/access.log | wc -l)
RATIO=$(echo "scale=2; $HITS / $TOTAL * 100" | bc)
echo "Cache hit ratio: $RATIO%"

# Target: >70% hit ratio
```

Adjust cache TTL based on results:

```caddyfile
# If hit ratio is low, increase TTL
cache {
    ttl 10m  # Increased from 5m
}

# If hit ratio is high but data is stale, decrease TTL
cache {
    ttl 2m  # Decreased from 5m
}
```

### 7.2 Load Balancing Tuning

Monitor backend performance:

```bash
# Check response times per backend
tail -1000 caddy/logs/access.log | \
  jq -r '[.request.uri, .upstream, .duration] | @tsv' | \
  awk '{sum[$2]+=$3; count[$2]++} END {for (u in sum) print u, sum[u]/count[u]}' | \
  sort -k2 -rn

# If one backend is consistently slower, investigate or adjust weights
```

### 7.3 Resource Optimization

```bash
# Check Caddy memory usage
docker stats todo-caddy --no-stream

# If memory is high, tune cache size in Caddyfile
cache {
    max_size 100MB  # Limit cache size
}

# Monitor file descriptor usage
docker exec todo-caddy sh -c 'ls -l /proc/self/fd | wc -l'
```

**Action Items:**

- [ ] Monitor cache hit ratio (target: >70%)
- [ ] Tune cache TTL values
- [ ] Monitor backend response times
- [ ] Optimize resource usage

---

## 📝 Maintenance Tasks

### Daily

- [ ] Check Caddy logs for errors
- [ ] Monitor cache hit ratio
- [ ] Verify all backends are healthy

```bash
# Quick daily check
docker ps | grep todo-
docker logs todo-caddy --tail 100 | grep -i error
curl http://localhost:8080/health
```

### Weekly

- [ ] Review access logs for unusual patterns
- [ ] Check SSL certificate expiry (Caddy auto-renews, but verify)
- [ ] Review performance metrics
- [ ] Update Caddy if new version available

```bash
# Check SSL expiry
echo | openssl s_client -connect api.yourdomain.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Update Caddy
docker-compose -f docker-compose.prod.yml pull caddy
docker-compose -f docker-compose.prod.yml up -d caddy
```

### Monthly

- [ ] Rotate logs
- [ ] Review and optimize cache configuration
- [ ] Load test to verify performance
- [ ] Review security headers

```bash
# Rotate logs (automated)
docker exec todo-caddy caddy reload --config /etc/caddy/Caddyfile

# Load test
ab -n 10000 -c 100 https://api.yourdomain.com/health
```

---

## 🆘 Troubleshooting Guide

### Issue: Caddy won't start

```bash
# Check logs
docker logs todo-caddy

# Validate Caddyfile
docker run --rm -v $PWD/caddy/config:/etc/caddy caddy:2.7-alpine caddy validate --config /etc/caddy/Caddyfile

# Common issues:
# - Invalid Caddyfile syntax
# - Port 80/443 already in use
# - Backend services not running
```

### Issue: SSL certificate not obtained

```bash
# Check Caddy logs
docker logs todo-caddy | grep -i "certificate"

# Common issues:
# - DNS not pointing to server
# - Firewall blocking port 80/443
# - Let's Encrypt rate limit (5 failures per hour)

# Force reload
docker exec todo-caddy caddy reload --config /etc/caddy/Caddyfile
```

### Issue: Backend not receiving requests

```bash
# Check backend health
docker exec todo-backend-1 wget -O- http://localhost:4001/health

# Check network connectivity
docker exec todo-caddy ping backend-1

# Check Caddy upstream config
curl http://localhost:2019/config/apps/http/servers | jq
```

### Issue: WebSocket not connecting

```bash
# Check WebSocket headers
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:8080/socket.io/

# Verify sticky sessions (ip_hash) is set for WebSocket endpoint
docker exec todo-caddy caddy list-modules | grep "http.reverse_proxy"
```

### Issue: Cache not working

```bash
# Check if cache module is loaded
docker exec todo-caddy caddy list-modules | grep cache

# If not found, you need to build Caddy with cache plugin
# See Phase 5.4 for instructions
```

---

## 📚 Additional Resources

### Caddy Documentation

- Official Docs: https://caddyserver.com/docs/
- Caddyfile Tutorial: https://caddyserver.com/docs/caddyfile-tutorial
- Reverse Proxy: https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
- Automatic HTTPS: https://caddyserver.com/docs/automatic-https

### Caddy Plugins

- Rate Limiting: https://github.com/mholt/caddy-ratelimit
- Caching: https://github.com/caddyserver/cache-handler
- Prometheus: https://github.com/hslatman/caddy-prometheus

### Community

- Caddy Forum: https://caddy.community/
- GitHub Discussions: https://github.com/caddyserver/caddy/discussions
- Discord: https://caddyserver.com/discord

---

## ✅ Implementation Checklist

### Phase 1: Preparation

- [ ] Create directory structure
- [ ] Document current setup
- [ ] Update backend for proxy awareness

### Phase 2: Basic Setup

- [ ] Create Caddyfile.dev
- [ ] Create Caddyfile.prod
- [ ] Review and customize configurations

### Phase 3: Docker Integration

- [ ] Create docker-compose.caddy.yml
- [ ] Create .env.caddy
- [ ] Update backend environment variables

### Phase 4: Testing

- [ ] Start all services
- [ ] Verify Caddy configuration
- [ ] Test health checks
- [ ] Test API endpoints
- [ ] Test caching
- [ ] Test WebSocket
- [ ] Test load balancing

### Phase 5: Monitoring

- [ ] Set up log monitoring
- [ ] Create monitoring script
- [ ] Configure alerts

### Phase 6: Production

- [ ] Configure DNS
- [ ] Update production configuration
- [ ] Deploy to production
- [ ] Verify HTTPS and SSL
- [ ] Post-deployment verification

### Phase 7: Optimization

- [ ] Monitor cache hit ratio
- [ ] Tune cache TTL
- [ ] Monitor backend performance
- [ ] Optimize resources

---

## 🎉 Success Criteria

Your Caddy implementation is successful when:

- ✅ All 3 backend instances are running and healthy
- ✅ Caddy is load balancing requests evenly
- ✅ HTTPS is working with automatic certificate renewal
- ✅ Cache hit ratio is >70%
- ✅ WebSocket connections work through Caddy
- ✅ Rate limiting blocks excessive requests
- ✅ Security headers are present on all responses
- ✅ Response times are <100ms (for cached requests)
- ✅ Zero downtime during Caddy reloads
- ✅ SSL Labs grade is A+

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting guide above
2. Review Caddy logs: `docker logs todo-caddy`
3. Validate Caddyfile: `caddy validate`
4. Ask on Caddy forum: https://caddy.community/
5. Open GitHub issue (if bug): https://github.com/caddyserver/caddy/issues

---

**Document Version**: 1.0  
**Last Updated**: November 13, 2025  
**Estimated Completion**: 3-5 days  
**Risk Level**: Low  
**Recommended By**: GitHub Copilot

**Ready to implement? Start with Phase 1! 🚀**
