# Phase 4: Testing Guide

## 🚦 Current Status: Docker Not Running

Before proceeding with Phase 4 testing, you need to start Docker Desktop.

### Step 1: Start Docker Desktop

**macOS:**

1. Open **Docker Desktop** from Applications or Spotlight
2. Wait for Docker to fully start (whale icon in menu bar should be steady)
3. Verify by running: `docker info`

### Step 2: Run the Test Suite

Once Docker is running, execute these tests in order:

---

## 🧪 Test Suite

### Test 1: Validate Caddyfile Configurations

Before starting services, validate the Caddyfile syntax:

```bash
cd /Users/patea/2026/projects/node-express-api-2026

# Validate development Caddyfile
docker run --rm \
  -v $PWD/caddy/config/Caddyfile.dev:/etc/caddy/Caddyfile \
  caddy:2.7-alpine \
  caddy validate --config /etc/caddy/Caddyfile

# Validate production Caddyfile
docker run --rm \
  -v $PWD/caddy/config/Caddyfile.prod:/etc/caddy/Caddyfile \
  caddy:2.7-alpine \
  caddy validate --config /etc/caddy/Caddyfile
```

**Expected Output:** `Valid configuration` ✅

---

### Test 2: Start the Stack

```bash
cd /Users/patea/2026/projects/node-express-api-2026

# Start all services
./caddy/start-dev.sh
```

**Expected Output:**

- Services pull/build successfully
- All containers start and become healthy
- Access points displayed (http://localhost:8080)

**Wait Time:** 1-2 minutes for first build, ~30 seconds for subsequent starts

---

### Test 3: Health Check Tests

```bash
# Test 1: Backend health through Caddy
curl -i http://localhost:8080/health

# Expected response:
# HTTP/1.1 200 OK
# {
#   "status": "healthy",
#   "database": "connected",
#   "instance_id": "backend-1" (or backend-2, backend-3),
#   "uptime": 12.34,
#   "timestamp": "2025-11-13T..."
# }

# Test 2: Caddy proxy health
curl -i http://localhost:8080/caddy-health

# Expected response:
# HTTP/1.1 200 OK
# {
#   "status": "healthy",
#   "proxy": "caddy",
#   "timestamp": "2025-11-13T..."
# }

# Test 3: Verify all instances respond
for i in {1..10}; do
  echo "Request $i:"
  curl -s http://localhost:8080/health | jq -r '.instance_id'
done

# Expected: Should see backend-1, backend-2, backend-3 distributed
```

---

### Test 4: Load Balancing Verification

```bash
# Test load distribution (50 requests)
echo "Testing load balancing distribution..."
for i in {1..50}; do
  curl -s http://localhost:8080/health | jq -r '.instance_id'
done | sort | uniq -c

# Expected output (roughly equal distribution):
#   17 backend-1
#   16 backend-2
#   17 backend-3

# Verify least_conn strategy
# The backend with fewest connections should receive next request
```

---

### Test 5: Security Headers Verification

```bash
# Check security headers are applied
curl -I http://localhost:8080/health

# Expected headers:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Server header should be removed or minimal

# Check CORS headers
curl -I -H "Origin: http://localhost:8080" http://localhost:8080/api/todos

# Expected:
# Access-Control-Allow-Origin header should be present
```

---

### Test 6: API Endpoint Tests

#### REST API Test

```bash
# Test REST endpoint (if you have auth, add token)
curl -X GET http://localhost:8080/api/todos

# Expected: JSON response with todos or auth required message

# Test with verbose to see routing
curl -v http://localhost:8080/api/todos
```

#### GraphQL Test

```bash
# Test GraphQL endpoint
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'

# Expected: GraphQL response or auth required

# Test GraphQL introspection
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name } } }"}'
```

#### API Documentation Test

```bash
# Access Swagger docs (if enabled)
curl -I http://localhost:8080/api-docs

# Expected: 200 OK or redirect to Swagger UI
```

---

### Test 7: WebSocket Connection Test

```bash
# Test WebSocket endpoint (basic connection test)
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://localhost:8080/socket.io/

# Expected:
# HTTP/1.1 101 Switching Protocols
# Connection: upgrade
# Upgrade: websocket
```

**For full WebSocket testing, use a client:**

Create a test file `test-websocket.js`:

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:8080', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ WebSocket connected!');
  console.log('Socket ID:', socket.id);

  // Test event
  socket.emit('test', { message: 'Hello from client' });
});

socket.on('disconnect', () => {
  console.log('❌ WebSocket disconnected');
});

socket.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

// Keep alive for 10 seconds
setTimeout(() => {
  socket.disconnect();
  process.exit(0);
}, 10000);
```

Run: `node test-websocket.js`

---

### Test 8: Service Health and Logs

```bash
# Check all containers are running
docker-compose -f docker-compose.caddy.yml ps

# Expected: All services should show "Up" with "(healthy)" status

# Check Caddy logs
docker-compose -f docker-compose.caddy.yml logs caddy --tail=50

# Check backend logs
docker-compose -f docker-compose.caddy.yml logs backend-1 --tail=20
docker-compose -f docker-compose.caddy.yml logs backend-2 --tail=20
docker-compose -f docker-compose.caddy.yml logs backend-3 --tail=20

# Check database logs
docker-compose -f docker-compose.caddy.yml logs postgres --tail=20
docker-compose -f docker-compose.caddy.yml logs mongodb --tail=20
```

---

### Test 9: Caddy Admin API

```bash
# Get current Caddy configuration
curl http://localhost:2019/config/ | jq

# Check upstream health
curl http://localhost:2019/reverse_proxy/upstreams | jq

# Expected: Should show all 3 backend instances with health status

# Get metrics
curl http://localhost:2019/metrics
```

---

### Test 10: Database Connectivity

```bash
# Test PostgreSQL connection from backend
docker exec backend-1 sh -c "node -e \"
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\\\$connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch(err => console.error('❌ PostgreSQL error:', err))
  .finally(() => prisma.\\\$disconnect());
\""

# Test MongoDB connection from backend
docker exec backend-1 sh -c "node -e \"
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URL)
  .then(() => {
    console.log('✅ MongoDB connected');
    mongoose.disconnect();
  })
  .catch(err => console.error('❌ MongoDB error:', err));
\""
```

---

### Test 11: Failover Testing

```bash
# Stop one backend instance
docker stop backend-1

# Make requests - should still work with backend-2 and backend-3
for i in {1..10}; do
  curl -s http://localhost:8080/health | jq -r '.instance_id'
done

# Expected: Only backend-2 and backend-3 responses

# Start backend-1 again
docker start backend-1

# Wait for health check (10 seconds)
sleep 10

# Verify backend-1 rejoins load balancing
for i in {1..15}; do
  curl -s http://localhost:8080/health | jq -r '.instance_id'
done

# Expected: backend-1, backend-2, backend-3 all present
```

---

### Test 12: Performance Testing (Optional)

```bash
# Install Apache Bench if not available
# macOS: brew install httpd (includes ab)

# Benchmark health endpoint
ab -n 1000 -c 10 http://localhost:8080/health

# Expected results:
# - Requests per second: Should be high (varies by machine)
# - No failed requests
# - Even distribution across backends

# Check distribution after load test
docker-compose -f docker-compose.caddy.yml logs caddy | grep "backend-" | tail -20
```

---

## ✅ Success Criteria

Phase 4 is complete when:

- [ ] Caddyfile configurations validated successfully
- [ ] All services start and become healthy
- [ ] Health endpoints respond correctly
- [ ] Load balancing distributes requests across all 3 backends
- [ ] Security headers are present in responses
- [ ] REST API endpoints accessible through Caddy
- [ ] GraphQL endpoint accessible through Caddy
- [ ] WebSocket connections work correctly
- [ ] Databases are accessible from backend instances
- [ ] Failover works (backends can be stopped/started)
- [ ] Logs are being written correctly
- [ ] No errors in Caddy or backend logs

---

## 🐛 Common Issues & Solutions

### Issue: Port 8080 already in use

```bash
# Find what's using port 8080
lsof -i :8080

# Kill the process or use a different port in Caddyfile.dev
```

### Issue: Backend health checks failing

```bash
# Check backend logs
docker-compose -f docker-compose.caddy.yml logs backend-1

# Verify environment variables
docker exec backend-1 env | grep -E "(PORT|DATABASE|INSTANCE)"

# Test health endpoint directly
docker exec backend-1 wget -qO- http://localhost:4001/health
```

### Issue: Database connection errors

```bash
# Check database containers are running
docker-compose -f docker-compose.caddy.yml ps postgres mongodb

# Check database logs
docker-compose -f docker-compose.caddy.yml logs postgres
docker-compose -f docker-compose.caddy.yml logs mongodb

# Verify .env.caddy has correct credentials
cat .env.caddy | grep -E "(POSTGRES|MONGO)"
```

### Issue: WebSocket not working

```bash
# Check Caddy logs for upgrade errors
docker-compose -f docker-compose.caddy.yml logs caddy | grep -i upgrade

# Verify ip_hash is configured for Socket.io
docker exec caddy-dev cat /etc/caddy/Caddyfile | grep -A5 "socket.io"
```

---

## 📊 Test Results Template

Use this template to document your test results:

```
# Phase 4 Test Results - [Date]

## Environment
- Docker Version: [run: docker --version]
- Docker Compose Version: [run: docker-compose --version]
- macOS Version: [run: sw_vers -productVersion]

## Test Results

### ✅ Caddyfile Validation
- Caddyfile.dev: [PASS/FAIL]
- Caddyfile.prod: [PASS/FAIL]

### ✅ Service Startup
- All services started: [PASS/FAIL]
- Time to healthy: [X seconds]

### ✅ Health Checks
- /health endpoint: [PASS/FAIL]
- /caddy-health endpoint: [PASS/FAIL]
- All instances responding: [PASS/FAIL]

### ✅ Load Balancing
- Traffic distribution: [PASS/FAIL]
- Distribution ratio: [X% / Y% / Z%]

### ✅ Security Headers
- Headers present: [PASS/FAIL]
- Listed headers: [...]

### ✅ API Endpoints
- REST API: [PASS/FAIL]
- GraphQL: [PASS/FAIL]
- API Docs: [PASS/FAIL]

### ✅ WebSocket
- Connection successful: [PASS/FAIL]
- Sticky sessions: [PASS/FAIL]

### ✅ Database Connectivity
- PostgreSQL: [PASS/FAIL]
- MongoDB: [PASS/FAIL]

### ✅ Failover
- Backend stop/start: [PASS/FAIL]
- Auto-recovery: [PASS/FAIL]

## Issues Found
[List any issues encountered]

## Notes
[Any additional observations]
```

---

## 🎯 Next Steps After Phase 4

Once all tests pass:

1. **Phase 5: Monitoring & Observability**
   - Set up log aggregation
   - Add metrics collection
   - Create dashboards

2. **Phase 6: Production Deployment**
   - Update Caddyfile.prod with real domain
   - Generate production secrets
   - Deploy to production server
   - Configure DNS

3. **Phase 7: Optimization & Tuning**
   - Performance tuning
   - Cache optimization
   - Rate limit adjustments

---

**Ready to start?** Once Docker Desktop is running, execute the tests above! 🚀
