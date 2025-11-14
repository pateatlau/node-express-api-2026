# Phase 1: Microservices Foundation - Setup Guide

## 🎉 What We've Built

Phase 1 infrastructure is now complete! This foundation enables you to build and deploy microservices with:

- ✅ **Shared Utilities**: Authentication, logging, metrics for all services
- ✅ **Service Template**: Ready-to-use boilerplate for new services
- ✅ **API Gateway**: Caddy-based routing to microservices
- ✅ **Docker Orchestration**: Multi-service docker-compose setup
- ✅ **Monitoring Stack**: Prometheus, Grafana, Jaeger, Loki
- ✅ **Load Balancing**: 3 backend instances with health checks

---

## 📁 Directory Structure

```
node-express-api-2026/
├── services/
│   ├── shared/                          # Shared utilities for all services
│   │   ├── middleware/
│   │   │   ├── authenticate.ts          # JWT authentication
│   │   │   └── serviceAuth.ts           # Service-to-service auth
│   │   ├── utils/
│   │   │   ├── logger.ts                # Winston logger
│   │   │   └── metrics.ts               # Prometheus metrics
│   │   └── types/
│   │       └── index.ts                 # Shared TypeScript types
│   │
│   └── template/                        # Service template (copy for new services)
│       ├── src/
│       │   ├── index.ts                 # Main entry point
│       │   ├── routes/                  # API routes
│       │   ├── services/                # Business logic
│       │   └── middleware/              # Custom middleware
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       ├── .env.example
│       └── README.md
│
├── monitoring/
│   ├── prometheus.yml                   # Prometheus config
│   └── grafana/
│       ├── datasources/
│       │   └── datasources.yml          # Data source config
│       └── dashboards/
│           └── dashboards.yml           # Dashboard provisioning
│
├── Caddyfile.microservices              # API Gateway configuration
├── docker-compose.microservices.yml     # Multi-service orchestration
└── .env.microservices.example           # Environment variables template
```

---

## 🚀 Quick Start

### 1. Setup Environment Variables

```bash
# Copy environment template
cp .env.microservices.example .env.microservices

# Edit and configure (IMPORTANT: Change secrets in production!)
nano .env.microservices
```

### 2. Start the Infrastructure

```bash
# Start all services
docker-compose -f docker-compose.microservices.yml up -d

# Check service status
docker-compose -f docker-compose.microservices.yml ps

# View logs
docker-compose -f docker-compose.microservices.yml logs -f
```

### 3. Verify Services

- **API Gateway**: http://localhost:8080/health
- **Legacy Backend**: http://localhost:8080/api/health (load-balanced across 3 instances)
- **Prometheus**: http://localhost:9091
- **Grafana**: http://localhost:3000 (admin/admin)
- **Jaeger UI**: http://localhost:16686

---

## 🔧 Creating a New Microservice

### Step 1: Copy Template

```bash
# Copy the service template
cp -r services/template services/your-service-name
cd services/your-service-name
```

### Step 2: Configure Service

```bash
# Update package.json
{
  "name": "your-service-name",
  "description": "Your service description"
}

# Copy and configure .env
cp .env.example .env

# Update .env
SERVICE_NAME=your-service-name
PORT=4005
```

### Step 3: Implement Your Service

```typescript
// src/routes/example.routes.ts
import express from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';

const router = express.Router();

router.get('/example', authenticate, async (req, res) => {
  // Your logic here
  res.json({ success: true, data: 'Hello from your service!' });
});

export default router;
```

```typescript
// src/index.ts (add your routes)
import exampleRoutes from './routes/example.routes.js';
app.use('/api/example', exampleRoutes);
```

### Step 4: Add to Docker Compose

Add your service to `docker-compose.microservices.yml`:

```yaml
your-service-name:
  build:
    context: .
    dockerfile: services/your-service-name/Dockerfile
  container_name: your-service-name
  environment:
    - NODE_ENV=production
    - SERVICE_NAME=your-service-name
    - PORT=4005
    - SERVICE_API_KEY=${SERVICE_API_KEY}
  networks:
    - microservices
  restart: unless-stopped
  healthcheck:
    test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', 'http://localhost:4005/health']
    interval: 10s
    timeout: 5s
    retries: 3
```

### Step 5: Add Gateway Route

Add to `Caddyfile.microservices`:

```caddyfile
# Your Service Routes
handle /api/your-service/* {
    reverse_proxy your-service-name:4005 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}

        health_uri /health
        health_interval 10s
        health_timeout 5s
    }
}
```

### Step 6: Deploy

```bash
# Rebuild and restart
docker-compose -f docker-compose.microservices.yml up -d --build your-service-name

# Check logs
docker-compose -f docker-compose.microservices.yml logs -f your-service-name
```

---

## 📊 Monitoring & Observability

### Prometheus Metrics

All services expose metrics at `/metrics`:

- HTTP request duration
- HTTP request count
- Active connections
- Database query duration

**View metrics**: http://localhost:9091/targets

### Grafana Dashboards

**Access**: http://localhost:3000 (admin/admin)

Configured data sources:

- Prometheus (metrics)
- Loki (logs)
- Jaeger (distributed tracing)

### Distributed Tracing

**Jaeger UI**: http://localhost:16686

View request traces across services to debug performance issues.

### Centralized Logging

**Loki**: http://localhost:3100

All service logs are aggregated and queryable via Grafana.

---

## 🔒 Security

### JWT Authentication

All services use shared JWT authentication:

```typescript
import { authenticate } from '../../shared/middleware/authenticate.js';

// Protected route
router.get('/protected', authenticate, async (req, res) => {
  const userId = req.user?.userId; // User from JWT
  // Your logic
});
```

### Service-to-Service Authentication

For internal service calls:

```typescript
import axios from 'axios';
import { getServiceApiKey } from '../../shared/middleware/serviceAuth.js';

const response = await axios.get('http://other-service:4001/internal/data', {
  headers: {
    'X-Service-Key': getServiceApiKey(),
  },
});
```

Validate internal requests:

```typescript
import { authenticateService } from '../../shared/middleware/serviceAuth.js';

// Internal endpoint (service-to-service only)
router.get('/internal/data', authenticateService, async (req, res) => {
  // Only accessible with valid service API key
});
```

---

## 🔍 Health Checks

All services must implement `/health`:

```typescript
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: SERVICE_NAME,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});
```

---

## 🧪 Testing

### Test Individual Service

```bash
cd services/your-service-name
npm install
npm run dev
```

### Test via API Gateway

```bash
# Test health
curl http://localhost:8080/health

# Test backend (load balanced)
curl http://localhost:8080/api/health

# Test with auth
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8080/api/your-service/example
```

---

## 📈 Load Balancing

The API Gateway load balances requests across multiple backend instances:

- **Strategy**: Round-robin
- **Health Checks**: Every 10 seconds
- **Auto-recovery**: Unhealthy instances removed from rotation

---

## 🐛 Troubleshooting

### Service won't start

```bash
# Check service logs
docker-compose -f docker-compose.microservices.yml logs your-service-name

# Check health status
docker-compose -f docker-compose.microservices.yml ps
```

### Gateway routing issues

```bash
# Check Caddy logs
docker-compose -f docker-compose.microservices.yml logs api-gateway

# Test service directly (bypass gateway)
docker exec -it your-service-name wget -O- http://localhost:4005/health
```

### Database connection issues

```bash
# Check database is running
docker-compose -f docker-compose.microservices.yml ps postgres

# Check connection from service
docker exec -it your-service-name sh
wget -O- http://postgres:5432
```

### Metrics not appearing

```bash
# Check Prometheus targets
curl http://localhost:9091/targets

# Test service metrics endpoint
curl http://localhost:8080/api/your-service/metrics
```

---

## 🗺️ Next Steps (Phase 2)

Now that the foundation is complete, you can:

1. **Week 3-4**: Extract Auth Service from monolith
   - Copy auth routes to new service
   - Setup dedicated PostgreSQL database
   - Implement Redis pub/sub for events
   - Gradual traffic migration (10% → 100%)

2. **Continue with implementation plan**: See `FULLSTACK_IMPLEMENTATION_PLAN.md`

---

## 📚 Useful Commands

```bash
# Start all services
docker-compose -f docker-compose.microservices.yml up -d

# Stop all services
docker-compose -f docker-compose.microservices.yml down

# Restart specific service
docker-compose -f docker-compose.microservices.yml restart your-service-name

# View logs (all services)
docker-compose -f docker-compose.microservices.yml logs -f

# View logs (specific service)
docker-compose -f docker-compose.microservices.yml logs -f your-service-name

# Rebuild service
docker-compose -f docker-compose.microservices.yml build your-service-name

# Scale service (multiple instances)
docker-compose -f docker-compose.microservices.yml up -d --scale your-service-name=3

# Check resource usage
docker stats

# Execute command in service container
docker exec -it your-service-name sh

# Clean up everything
docker-compose -f docker-compose.microservices.yml down -v
```

---

## 💡 Best Practices

1. **Always use shared middleware** from `services/shared/`
2. **Log important events** with appropriate log levels
3. **Implement health checks** for all services
4. **Use environment variables** for configuration
5. **Keep services stateless** when possible
6. **Implement graceful shutdown** handling
7. **Add metrics** for critical operations
8. **Test service independently** before integration
9. **Document your API** with OpenAPI/Swagger
10. **Follow the service template** structure

---

## 🎯 Success Criteria

- ✅ All services start without errors
- ✅ API Gateway routes requests correctly
- ✅ Health checks pass for all services
- ✅ Metrics visible in Prometheus
- ✅ Dashboards accessible in Grafana
- ✅ Distributed tracing works in Jaeger
- ✅ Load balancing distributes requests evenly

---

## 📞 Support

For questions or issues:

- Check service logs first
- Review the service template README
- Consult `FULLSTACK_IMPLEMENTATION_PLAN.md`
- Test services individually before debugging gateway

---

**🎉 Phase 1 Complete! Ready to build microservices!**
