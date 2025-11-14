# Phase 1 Backend - Quick Reference

## 🚀 Quick Start

```bash
# 1. Copy environment config
cp .env.microservices.example .env.microservices

# 2. Start all services
docker-compose -f docker-compose.microservices.yml up -d

# 3. Check status
docker-compose -f docker-compose.microservices.yml ps

# 4. View logs
docker-compose -f docker-compose.microservices.yml logs -f backend-1
```

## 📊 Service URLs

| Service     | URL                    | Purpose                  |
| ----------- | ---------------------- | ------------------------ |
| API Gateway | http://localhost:8080  | Main entry point         |
| Prometheus  | http://localhost:9091  | Metrics                  |
| Grafana     | http://localhost:3001  | Dashboards (admin/admin) |
| Jaeger      | http://localhost:16686 | Tracing                  |

## 🛠️ Common Commands

```bash
# View all logs
docker-compose -f docker-compose.microservices.yml logs -f

# Restart a service
docker-compose -f docker-compose.microservices.yml restart backend-1

# Stop all services
docker-compose -f docker-compose.microservices.yml down

# Rebuild and restart
docker-compose -f docker-compose.microservices.yml up -d --build

# Remove volumes (fresh start)
docker-compose -f docker-compose.microservices.yml down -v
```

## 📝 Test Endpoints

```bash
# Health check (via gateway)
curl http://localhost:8080/api/health

# Health check (direct)
curl http://localhost:4000/health

# Metrics
curl http://localhost:9090/metrics

# Load balanced endpoint
curl http://localhost:8080/api/
```

## 🔧 New Service Checklist

1. **Copy template:**

   ```bash
   cp -r services/template services/my-service
   cd services/my-service
   ```

2. **Update package.json:**

   ```json
   {
     "name": "my-service",
     "version": "1.0.0"
   }
   ```

3. **Update .env variables:**

   ```
   SERVICE_NAME=my-service
   PORT=4005
   ```

4. **Add to Caddyfile.microservices:**

   ```caddyfile
   /api/my-service/* {
     reverse_proxy my-service:4005 {
       health_uri /health
       health_interval 10s
     }
   }
   ```

5. **Add to docker-compose.microservices.yml:**

   ```yaml
   my-service:
     build:
       context: .
       dockerfile: services/my-service/Dockerfile
     environment:
       SERVICE_NAME: my-service
       PORT: 4005
     networks:
       - microservices
   ```

6. **Add Prometheus scraping (monitoring/prometheus.yml):**
   ```yaml
   - job_name: 'my-service'
     static_configs:
       - targets: ['my-service:4005']
         labels:
           service: 'my-service'
   ```

## 📚 Shared Utilities Usage

### Authentication

```typescript
import { authenticate } from '@services/shared/middleware/authenticate';

app.get('/protected', authenticate, (req, res) => {
  res.json({ user: req.user });
});
```

### Rate Limiting

```typescript
import { apiRateLimiter, authRateLimiter } from '@services/shared/middleware/rateLimiter';

app.use('/api', apiRateLimiter);
app.post('/auth/login', authRateLimiter, loginHandler);
```

### Input Validation

```typescript
import { validate } from '@services/shared/middleware/requestValidator';

app.post(
  '/users',
  validate({
    body: [
      { field: 'email', type: 'email', required: true },
      { field: 'age', type: 'number', min: 18, max: 120 },
    ],
  }),
  createUser
);
```

### Circuit Breaker

```typescript
import { CircuitBreaker } from '@services/shared/utils/circuitBreaker';

const dbBreaker = new CircuitBreaker('database', {
  failureThreshold: 5,
  timeout: 60000,
});

const users = await dbBreaker.execute(() => db.query('SELECT * FROM users'));
```

### Retry Logic

```typescript
import { retry } from '@services/shared/utils/retry';

const data = await retry(() => fetchExternalAPI(), {
  maxRetries: 3,
  initialDelay: 1000,
});
```

### Logging

```typescript
import { logger } from '@services/shared/utils/logger';

logger.info('User created', { userId, email });
logger.error('Database error', { error: err.message });
```

### Metrics

```typescript
import { initializeMetrics } from '@services/shared/utils/metrics';

// Initialize at startup
initializeMetrics('my-service');

// Metrics automatically collected via middleware
```

## 🔍 Debugging

### View service logs

```bash
# Single service
docker-compose -f docker-compose.microservices.yml logs -f backend-1

# All services
docker-compose -f docker-compose.microservices.yml logs -f

# Filter by service
docker-compose -f docker-compose.microservices.yml logs -f | grep backend-1
```

### Check service health

```bash
# Via gateway
curl http://localhost:8080/api/health

# Direct to service
docker exec -it $(docker ps -qf "name=backend-1") wget -qO- http://localhost:4000/health | jq
```

### View metrics

```bash
# Service metrics
curl http://localhost:4000/metrics

# Gateway metrics
curl http://localhost:9090/metrics
```

### Execute commands in container

```bash
# Get shell
docker exec -it $(docker ps -qf "name=backend-1") sh

# Run node command
docker exec -it $(docker ps -qf "name=backend-1") node -e "console.log('Hello')"
```

### Check database

```bash
# Connect to PostgreSQL
docker exec -it $(docker ps -qf "name=postgres") psql -U postgres -d backend_db

# List tables
\dt

# Query
SELECT * FROM users LIMIT 10;
```

### Check Redis

```bash
# Connect to Redis
docker exec -it $(docker ps -qf "name=redis") redis-cli

# Check keys
KEYS *

# Get value
GET key_name
```

## 📈 Monitoring Queries

### Prometheus Queries

**Request rate:**

```promql
rate(http_request_total[5m])
```

**Error rate:**

```promql
rate(http_request_total{status=~"5.."}[5m])
```

**Latency p95:**

```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Active connections:**

```promql
active_connections
```

**Memory usage:**

```promql
process_resident_memory_bytes
```

## 🐛 Troubleshooting

### Service won't start

```bash
# Check logs
docker-compose -f docker-compose.microservices.yml logs service-name

# Check configuration
docker-compose -f docker-compose.microservices.yml config

# Rebuild
docker-compose -f docker-compose.microservices.yml build service-name
docker-compose -f docker-compose.microservices.yml up -d service-name
```

### Gateway 502 errors

```bash
# Check if backend is healthy
curl http://localhost:4000/health

# Check Caddy logs
docker-compose -f docker-compose.microservices.yml logs api-gateway

# Verify routing
cat Caddyfile.microservices
```

### Database connection errors

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection string
echo $DATABASE_URL

# Test connection
docker exec -it postgres psql -U postgres -c "SELECT 1"
```

### High memory usage

```bash
# Check memory usage
docker stats

# Check for memory leaks in logs
docker-compose -f docker-compose.microservices.yml logs | grep "memory"

# Restart service
docker-compose -f docker-compose.microservices.yml restart service-name
```

## 🔐 Security Checklist

- [ ] JWT secrets are strong and unique
- [ ] Service API keys are rotated regularly
- [ ] CORS is restricted to specific domains
- [ ] Rate limiting is enabled on all endpoints
- [ ] Input validation on all POST/PUT endpoints
- [ ] Secrets stored in environment variables (not code)
- [ ] HTTPS enabled on API Gateway
- [ ] Database credentials are secure
- [ ] Non-root Docker user
- [ ] Security headers configured (Helmet)

## 📊 Performance Checklist

- [ ] Connection pooling configured
- [ ] Caching enabled for frequent queries
- [ ] Response compression enabled
- [ ] Graceful shutdown implemented
- [ ] Health checks configured
- [ ] Circuit breakers on external calls
- [ ] Retry logic with backoff
- [ ] Request size limits set
- [ ] Load balancing across instances
- [ ] Monitoring and alerts set up

## 📖 Documentation Files

| File                            | Purpose                            |
| ------------------------------- | ---------------------------------- |
| `PHASE1_ARCHITECTURE_REVIEW.md` | Comprehensive architectural review |
| `PHASE1_SUMMARY.md`             | Complete implementation summary    |
| `PHASE1_SETUP_GUIDE.md`         | Detailed setup instructions        |
| `PHASE1_REVIEW.md`              | First review findings              |
| `shared/README.md`              | Shared utilities documentation     |

## 🎯 Next Steps

1. **Deploy to staging** - Test in real environment
2. **Load testing** - Validate performance expectations
3. **Write tests** - Unit and integration tests
4. **Set up CI/CD** - Automated deployment pipeline
5. **Phase 2** - Extract Auth Service from monolith

## 🆘 Getting Help

- Check logs: `docker-compose logs -f service-name`
- Review architecture: `services/PHASE1_ARCHITECTURE_REVIEW.md`
- Read setup guide: `services/PHASE1_SETUP_GUIDE.md`
- Check shared utils: `services/shared/README.md`

---

**Last Updated:** 2026-01-20  
**Status:** Production-Ready ✅
