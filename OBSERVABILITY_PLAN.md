# Observability Implementation Plan

## 🎯 Overview

**Goal**: Implement comprehensive observability stack for the existing application to enable monitoring, tracing, and debugging.

**Timeline**: 1-2 weeks  
**Effort**: Medium  
**Priority**: HIGH (Foundation for future microservices)

---

## 📊 Observability Stack

### **The Three Pillars**

```
┌─────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY STACK                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   METRICS   │  │   TRACES    │  │    LOGS     │            │
│  │             │  │             │  │             │            │
│  │ Prometheus  │  │   Jaeger    │  │    Loki     │            │
│  │             │  │             │  │             │            │
│  │ • Counters  │  │ • Spans     │  │ • Errors    │            │
│  │ • Gauges    │  │ • Timeline  │  │ • Debug     │            │
│  │ • Histogram │  │ • Duration  │  │ • Audit     │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │             │                              │
│                    │   Grafana   │                              │
│                    │             │                              │
│                    │ • Dashboards│                              │
│                    │ • Alerts    │                              │
│                    │ • Visualize │                              │
│                    └─────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗓️ Week-by-Week Plan

### **Week 1: Core Infrastructure**

#### **Day 1: Prometheus + Grafana Setup**

**Morning: Infrastructure (2-3 hours)**

**Tasks:**

- [ ] Update docker-compose.caddy.yml with monitoring services
- [ ] Configure Prometheus to scrape backends
- [ ] Setup Grafana with Prometheus datasource
- [ ] Verify basic connectivity

**docker-compose.caddy.yml additions:**

```yaml
services:
  # ... existing services (caddy, backend-1, backend-2, backend-3, postgres, mongo, redis)

  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - '9090:9090'
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
      - '--web.enable-lifecycle'
    networks:
      - caddy-network
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - '3000:3000'
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_SECURITY_ADMIN_USER=admin
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    depends_on:
      - prometheus
    networks:
      - caddy-network
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
```

**Create monitoring directory structure:**

```bash
mkdir -p monitoring/prometheus
mkdir -p monitoring/grafana/provisioning/datasources
mkdir -p monitoring/grafana/provisioning/dashboards
mkdir -p monitoring/grafana/dashboards
```

**monitoring/prometheus/prometheus.yml:**

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'local-dev'
    replica: 'prometheus-1'

scrape_configs:
  # Backend instances
  - job_name: 'backend'
    static_configs:
      - targets:
          - 'backend-1:4000'
          - 'backend-2:4000'
          - 'backend-3:4000'
        labels:
          service: 'backend'
          environment: 'development'

  # Caddy metrics
  - job_name: 'caddy'
    static_configs:
      - targets:
          - 'caddy:2019'
        labels:
          service: 'caddy'
          environment: 'development'

  # PostgreSQL exporter (optional - add later)
  - job_name: 'postgres'
    static_configs:
      - targets:
          - 'postgres-exporter:9187'
        labels:
          service: 'postgres'
          environment: 'development'

  # Redis exporter (optional - add later)
  - job_name: 'redis'
    static_configs:
      - targets:
          - 'redis-exporter:9121'
        labels:
          service: 'redis'
          environment: 'development'

  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets:
          - 'localhost:9090'
```

**monitoring/grafana/provisioning/datasources/prometheus.yml:**

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    jsonData:
      timeInterval: '15s'
```

**monitoring/grafana/provisioning/dashboards/default.yml:**

```yaml
apiVersion: 1

providers:
  - name: 'Default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
```

**Afternoon: Enhance Backend Metrics (2-3 hours)**

**Tasks:**

- [ ] Review existing Prometheus metrics in backend
- [ ] Add missing critical metrics
- [ ] Organize metrics by category
- [ ] Test metrics endpoint

**src/utils/metrics.ts (enhance existing):**

```typescript
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Create a Registry
export const register = new Registry();

// Set default labels
register.setDefaultLabels({
  app: 'todo-backend',
  environment: process.env.NODE_ENV || 'development',
});

// ============================================
// HTTP METRICS
// ============================================

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'instance'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'instance'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestSize = new Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route', 'instance'],
  buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000],
  registers: [register],
});

export const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code', 'instance'],
  buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000],
  registers: [register],
});

// ============================================
// BUSINESS METRICS
// ============================================

export const activeUsers = new Gauge({
  name: 'active_users_total',
  help: 'Total number of active users (with valid sessions)',
  registers: [register],
});

export const activeSessions = new Gauge({
  name: 'active_sessions_total',
  help: 'Total number of active sessions',
  registers: [register],
});

export const todosTotal = new Gauge({
  name: 'todos_total',
  help: 'Total number of todos',
  labelNames: ['status'],
  registers: [register],
});

export const userSignups = new Counter({
  name: 'user_signups_total',
  help: 'Total number of user signups',
  labelNames: ['role'],
  registers: [register],
});

export const userLogins = new Counter({
  name: 'user_logins_total',
  help: 'Total number of user logins',
  labelNames: ['status'], // success, failed
  registers: [register],
});

// ============================================
// DATABASE METRICS
// ============================================

export const databaseQueries = new Counter({
  name: 'database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

export const databaseConnectionPool = new Gauge({
  name: 'database_connection_pool',
  help: 'Database connection pool status',
  labelNames: ['state'], // active, idle, waiting
  registers: [register],
});

// ============================================
// REDIS METRICS
// ============================================

export const redisCommands = new Counter({
  name: 'redis_commands_total',
  help: 'Total number of Redis commands',
  labelNames: ['command', 'status'],
  registers: [register],
});

export const redisCommandDuration = new Histogram({
  name: 'redis_command_duration_seconds',
  help: 'Duration of Redis commands in seconds',
  labelNames: ['command'],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

// ============================================
// WEBSOCKET METRICS
// ============================================

export const websocketConnections = new Gauge({
  name: 'websocket_connections_total',
  help: 'Total number of active WebSocket connections',
  registers: [register],
});

export const websocketMessages = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['direction', 'event'], // direction: inbound/outbound
  registers: [register],
});

// ============================================
// ERROR METRICS
// ============================================

export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route', 'severity'], // severity: warning, error, critical
  registers: [register],
});

export const uncaughtExceptions = new Counter({
  name: 'uncaught_exceptions_total',
  help: 'Total number of uncaught exceptions',
  registers: [register],
});

// ============================================
// SYSTEM METRICS
// ============================================

export const nodeProcessMemory = new Gauge({
  name: 'nodejs_memory_usage_bytes',
  help: 'Node.js memory usage in bytes',
  labelNames: ['type'], // rss, heapTotal, heapUsed, external
  registers: [register],
});

export const nodeProcessUptime = new Gauge({
  name: 'nodejs_process_uptime_seconds',
  help: 'Node.js process uptime in seconds',
  registers: [register],
});

// Update system metrics every 15 seconds
setInterval(() => {
  const memUsage = process.memoryUsage();
  nodeProcessMemory.set({ type: 'rss' }, memUsage.rss);
  nodeProcessMemory.set({ type: 'heapTotal' }, memUsage.heapTotal);
  nodeProcessMemory.set({ type: 'heapUsed' }, memUsage.heapUsed);
  nodeProcessMemory.set({ type: 'external' }, memUsage.external);
  nodeProcessUptime.set(process.uptime());
}, 15000);

// ============================================
// HELPER FUNCTIONS
// ============================================

// Update business metrics periodically
export async function updateBusinessMetrics(prisma: any) {
  try {
    // Active sessions
    const sessionCount = await prisma.session.count({
      where: {
        expiresAt: { gt: new Date() },
      },
    });
    activeSessions.set(sessionCount);

    // Active users (unique users with active sessions)
    const activeUserCount = await prisma.session.groupBy({
      by: ['userId'],
      where: {
        expiresAt: { gt: new Date() },
      },
      _count: true,
    });
    activeUsers.set(activeUserCount.length);

    // Todos by status
    const todoStats = await prisma.todo.groupBy({
      by: ['status'],
      _count: true,
    });
    todoStats.forEach((stat: any) => {
      todosTotal.set({ status: stat.status }, stat._count);
    });
  } catch (error) {
    console.error('Error updating business metrics:', error);
  }
}
```

**src/middleware/metricsMiddleware.ts:**

```typescript
import { Request, Response, NextFunction } from 'express';
import {
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
} from '../utils/metrics';

const INSTANCE_ID = process.env.INSTANCE_ID || 'backend-1';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Track request size
  const requestSize = parseInt(req.headers['content-length'] || '0', 10);
  if (requestSize > 0) {
    httpRequestSize.observe(
      { method: req.method, route: req.route?.path || req.path, instance: INSTANCE_ID },
      requestSize
    );
  }

  // Hook into response
  const originalSend = res.send;
  res.send = function (data: any): Response {
    // Track response size
    const responseSize = Buffer.byteLength(JSON.stringify(data));
    httpResponseSize.observe(
      {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode.toString(),
        instance: INSTANCE_ID,
      },
      responseSize
    );

    return originalSend.call(this, data);
  };

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
      instance: INSTANCE_ID,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
  });

  next();
}
```

**Update src/index.ts:**

```typescript
import { metricsMiddleware } from './middleware/metricsMiddleware';
import { register, updateBusinessMetrics } from './utils/metrics';
import { prisma } from './lib/prisma';

// Add metrics middleware BEFORE routes
app.use(metricsMiddleware);

// Existing routes...

// Metrics endpoint (should already exist, just verify)
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

// Update business metrics every 30 seconds
setInterval(() => {
  updateBusinessMetrics(prisma);
}, 30000);

// Initial update
updateBusinessMetrics(prisma);
```

**Test:**

```bash
# Start services
npm run caddy:up

# Check Prometheus targets
open http://localhost:9090/targets

# Check Grafana
open http://localhost:3000
# Login: admin / admin

# Check metrics endpoint
curl http://localhost:8080/metrics
```

---

#### **Day 2: Grafana Dashboards**

**Morning: Infrastructure Dashboard (2-3 hours)**

**Tasks:**

- [ ] Create infrastructure monitoring dashboard
- [ ] Add panels for CPU, memory, network
- [ ] Add panels for container stats
- [ ] Configure refresh intervals

**monitoring/grafana/dashboards/infrastructure.json:**

```json
{
  "dashboard": {
    "title": "Infrastructure Overview",
    "tags": ["infrastructure"],
    "timezone": "browser",
    "panels": [
      {
        "title": "HTTP Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{instance}} - {{method}} {{route}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "HTTP Request Duration (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{instance}} - {{route}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])",
            "legendFormat": "{{instance}} - {{route}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "nodejs_memory_usage_bytes{type=\"heapUsed\"}",
            "legendFormat": "{{instance}}"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

**Afternoon: Application Dashboard (2-3 hours)**

**Tasks:**

- [ ] Create application monitoring dashboard
- [ ] Add panels for requests, errors, latency
- [ ] Add panels for database queries
- [ ] Add panels for WebSocket connections

**monitoring/grafana/dashboards/application.json:**

```json
{
  "dashboard": {
    "title": "Application Metrics",
    "tags": ["application"],
    "panels": [
      {
        "title": "Request Success Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status_code!~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100",
            "legendFormat": "Success Rate %"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Requests per Second",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[1m])) by (method, route)",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Response Time Percentiles",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "p99"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Database Query Duration",
        "targets": [
          {
            "expr": "rate(database_query_duration_seconds_sum[5m]) / rate(database_query_duration_seconds_count[5m])",
            "legendFormat": "{{operation}} - {{table}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Active WebSocket Connections",
        "targets": [
          {
            "expr": "websocket_connections_total",
            "legendFormat": "{{instance}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Redis Command Duration",
        "targets": [
          {
            "expr": "rate(redis_command_duration_seconds_sum[5m]) / rate(redis_command_duration_seconds_count[5m])",
            "legendFormat": "{{command}}"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

---

#### **Day 3: Business Metrics Dashboard**

**Morning: Business Dashboard (2-3 hours)**

**Tasks:**

- [ ] Create business metrics dashboard
- [ ] Add panels for users, sessions, todos
- [ ] Add panels for signups, logins
- [ ] Configure time ranges

**monitoring/grafana/dashboards/business.json:**

```json
{
  "dashboard": {
    "title": "Business Metrics",
    "tags": ["business"],
    "panels": [
      {
        "title": "Active Users",
        "targets": [
          {
            "expr": "active_users_total",
            "legendFormat": "Active Users"
          }
        ],
        "type": "stat",
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "thresholds": {
              "mode": "absolute",
              "steps": [
                { "value": 0, "color": "red" },
                { "value": 10, "color": "yellow" },
                { "value": 50, "color": "green" }
              ]
            }
          }
        }
      },
      {
        "title": "Active Sessions",
        "targets": [
          {
            "expr": "active_sessions_total",
            "legendFormat": "Active Sessions"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Todos by Status",
        "targets": [
          {
            "expr": "todos_total",
            "legendFormat": "{{status}}"
          }
        ],
        "type": "piechart"
      },
      {
        "title": "User Signups (Last 24h)",
        "targets": [
          {
            "expr": "increase(user_signups_total[24h])",
            "legendFormat": "{{role}}"
          }
        ],
        "type": "bargauge"
      },
      {
        "title": "Login Success Rate",
        "targets": [
          {
            "expr": "sum(rate(user_logins_total{status=\"success\"}[5m])) / sum(rate(user_logins_total[5m])) * 100",
            "legendFormat": "Success Rate %"
          }
        ],
        "type": "gauge"
      },
      {
        "title": "User Activity Over Time",
        "targets": [
          {
            "expr": "rate(http_requests_total{route=~\"/api/todos.*\"}[5m])",
            "legendFormat": "Todo API Calls"
          },
          {
            "expr": "rate(http_requests_total{route=~\"/api/auth.*\"}[5m])",
            "legendFormat": "Auth API Calls"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

**Afternoon: Dashboard Polish (2-3 hours)**

**Tasks:**

- [ ] Refine dashboard layouts
- [ ] Add helpful descriptions to panels
- [ ] Configure auto-refresh
- [ ] Create dashboard variables for filtering
- [ ] Export dashboards as JSON

---

#### **Day 4: Distributed Tracing (Jaeger)**

**Morning: Jaeger Setup (2-3 hours)**

**Tasks:**

- [ ] Add Jaeger to docker-compose
- [ ] Install OpenTelemetry packages
- [ ] Configure tracing in backend
- [ ] Test basic tracing

**docker-compose.caddy.yml additions:**

```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: jaeger
    ports:
      - '16686:16686' # Jaeger UI
      - '14268:14268' # Collector HTTP
      - '14250:14250' # Collector gRPC
      - '6831:6831/udp' # Agent UDP
    environment:
      - COLLECTOR_OTLP_ENABLED=true
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411
    networks:
      - caddy-network
    restart: unless-stopped
```

**Install OpenTelemetry:**

```bash
cd /Users/patea/2026/projects/node-express-api-2026
npm install @opentelemetry/api \
            @opentelemetry/sdk-node \
            @opentelemetry/auto-instrumentations-node \
            @opentelemetry/exporter-jaeger \
            @opentelemetry/instrumentation-express \
            @opentelemetry/instrumentation-http \
            @opentelemetry/instrumentation-prisma \
            @opentelemetry/instrumentation-redis-4
```

**src/tracing.ts (new file):**

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const INSTANCE_ID = process.env.INSTANCE_ID || 'backend-1';

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger:14268/api/traces',
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'todo-backend',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: INSTANCE_ID,
  }),
  traceExporter: jaegerExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable fs instrumentation (too noisy)
      },
    }),
  ],
});

export function initTracing() {
  sdk.start();
  console.log('✅ Tracing initialized');

  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.log('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });
}
```

**Update src/index.ts:**

```typescript
// MUST be imported FIRST, before any other imports
import { initTracing } from './tracing';

// Initialize tracing
if (process.env.ENABLE_TRACING === 'true') {
  initTracing();
}

// ... rest of imports and code
```

**Update docker-compose environment:**

```yaml
services:
  backend-1:
    environment:
      - ENABLE_TRACING=true
      - JAEGER_ENDPOINT=http://jaeger:14268/api/traces
      - INSTANCE_ID=backend-1

  backend-2:
    environment:
      - ENABLE_TRACING=true
      - JAEGER_ENDPOINT=http://jaeger:14268/api/traces
      - INSTANCE_ID=backend-2

  backend-3:
    environment:
      - ENABLE_TRACING=true
      - JAEGER_ENDPOINT=http://jaeger:14268/api/traces
      - INSTANCE_ID=backend-3
```

**Afternoon: Custom Spans (2-3 hours)**

**Tasks:**

- [ ] Add custom spans for critical operations
- [ ] Add span attributes for debugging
- [ ] Test trace visualization
- [ ] Document tracing patterns

**src/utils/tracing.ts (new file):**

```typescript
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('todo-backend');

export function createSpan(name: string, fn: (span: any) => Promise<any>) {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

// Usage example
export async function tracedDatabaseQuery<T>(
  operation: string,
  table: string,
  query: () => Promise<T>
): Promise<T> {
  return createSpan(`db.${operation}.${table}`, async (span) => {
    span.setAttribute('db.operation', operation);
    span.setAttribute('db.table', table);

    const result = await query();

    span.setAttribute('db.result.count', Array.isArray(result) ? result.length : 1);
    return result;
  });
}
```

**Example usage in services:**

```typescript
import { tracedDatabaseQuery } from '../utils/tracing';

export async function getTodos(userId: string) {
  return tracedDatabaseQuery('select', 'todos', async () => {
    return prisma.todo.findMany({
      where: { userId },
    });
  });
}
```

**Test:**

```bash
# Rebuild and restart
npm run caddy:rebuild

# Generate some traffic
curl http://localhost:8080/api/auth/me -H "Authorization: Bearer YOUR_TOKEN"

# Open Jaeger UI
open http://localhost:16686

# Search for traces from "todo-backend"
```

---

#### **Day 5: Centralized Logging (Loki)**

**Morning: Loki Setup (2-3 hours)**

**Tasks:**

- [ ] Add Loki to docker-compose
- [ ] Configure log shipping
- [ ] Setup Grafana Loki datasource
- [ ] Test log queries

**docker-compose.caddy.yml additions:**

```yaml
services:
  loki:
    image: grafana/loki:latest
    container_name: loki
    ports:
      - '3100:3100'
    volumes:
      - ./monitoring/loki/loki-config.yml:/etc/loki/loki-config.yml
      - loki-data:/loki
    command: -config.file=/etc/loki/loki-config.yml
    networks:
      - caddy-network
    restart: unless-stopped

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    volumes:
      - ./monitoring/promtail/promtail-config.yml:/etc/promtail/promtail-config.yml
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock
    command: -config.file=/etc/promtail/promtail-config.yml
    depends_on:
      - loki
    networks:
      - caddy-network
    restart: unless-stopped

volumes:
  loki-data:
```

**monitoring/loki/loki-config.yml:**

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
  chunk_idle_period: 5m
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: true
  retention_period: 168h
```

**monitoring/promtail/promtail-config.yml:**

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'stream'
      - source_labels: ['__meta_docker_container_label_com_docker_compose_service']
        target_label: 'service'
```

**Add Loki datasource to Grafana:**

```yaml
# monitoring/grafana/provisioning/datasources/loki.yml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: false
    editable: true
```

**Afternoon: Structured Logging (2-3 hours)**

**Tasks:**

- [ ] Enhance Winston logging configuration
- [ ] Add structured logging
- [ ] Create log dashboard in Grafana
- [ ] Test log queries

**Update src/utils/logger.ts:**

```typescript
import winston from 'winston';

const INSTANCE_ID = process.env.INSTANCE_ID || 'backend-1';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'todo-backend',
    instance: INSTANCE_ID,
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let metaStr = '';
          if (Object.keys(meta).length > 0) {
            metaStr = '\n' + JSON.stringify(meta, null, 2);
          }
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    }),

    // File output for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat,
    }),

    // File output for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: logFormat,
    }),
  ],
});

// Helper functions for structured logging
export const loggers = {
  http: (req: any, res: any, duration: number) => {
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
    });
  },

  auth: (action: string, userId: string, success: boolean, metadata?: any) => {
    logger.info('Auth Event', {
      action,
      userId,
      success,
      ...metadata,
    });
  },

  database: (operation: string, table: string, duration: number, error?: any) => {
    if (error) {
      logger.error('Database Error', {
        operation,
        table,
        duration: `${duration}ms`,
        error: error.message,
        stack: error.stack,
      });
    } else {
      logger.debug('Database Query', {
        operation,
        table,
        duration: `${duration}ms`,
      });
    }
  },

  websocket: (event: string, userId: string, metadata?: any) => {
    logger.info('WebSocket Event', {
      event,
      userId,
      ...metadata,
    });
  },

  error: (message: string, error: Error, context?: any) => {
    logger.error(message, {
      error: error.message,
      stack: error.stack,
      ...context,
    });
  },
};
```

**Create logs dashboard:**

```bash
# In Grafana, create new dashboard with Loki datasource
# Example queries:

# All logs from backend services
{service=~"backend-.*"}

# Error logs only
{service=~"backend-.*"} |= "error"

# Logs for specific user
{service=~"backend-.*"} | json | userId="USER_ID_HERE"

# Slow database queries
{service=~"backend-.*"} | json | duration > 1000

# Authentication failures
{service=~"backend-.*"} | json | action="login" | success="false"
```

---

### **Week 2: Advanced Features & Polish**

#### **Day 1: Alerting**

**Morning: Alert Rules (2-3 hours)**

**Tasks:**

- [ ] Create alert rules in Prometheus
- [ ] Configure alert manager
- [ ] Setup notification channels (email/Slack)
- [ ] Test alerts

**monitoring/prometheus/alerts.yml:**

```yaml
groups:
  - name: backend_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          (sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (instance) 
          / sum(rate(http_requests_total[5m])) by (instance)) > 0.05
        for: 2m
        labels:
          severity: warning
          component: backend
        annotations:
          summary: 'High error rate on {{ $labels.instance }}'
          description: 'Error rate is {{ $value | humanizePercentage }} on {{ $labels.instance }}'

      # High latency
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, 
            rate(http_request_duration_seconds_bucket[5m])
          ) > 1
        for: 5m
        labels:
          severity: warning
          component: backend
        annotations:
          summary: 'High latency on {{ $labels.instance }}'
          description: 'p95 latency is {{ $value }}s on {{ $labels.instance }}'

      # Service down
      - alert: ServiceDown
        expr: up{job="backend"} == 0
        for: 1m
        labels:
          severity: critical
          component: backend
        annotations:
          summary: 'Backend service is down'
          description: '{{ $labels.instance }} has been down for more than 1 minute'

      # Low success rate
      - alert: LowSuccessRate
        expr: |
          (sum(rate(http_requests_total{status_code!~"5.."}[5m])) 
          / sum(rate(http_requests_total[5m]))) < 0.95
        for: 5m
        labels:
          severity: warning
          component: backend
        annotations:
          summary: 'Low success rate'
          description: 'Success rate is {{ $value | humanizePercentage }}'

      # High memory usage
      - alert: HighMemoryUsage
        expr: |
          (nodejs_memory_usage_bytes{type="heapUsed"} 
          / nodejs_memory_usage_bytes{type="heapTotal"}) > 0.9
        for: 5m
        labels:
          severity: warning
          component: backend
        annotations:
          summary: 'High memory usage on {{ $labels.instance }}'
          description: 'Heap usage is {{ $value | humanizePercentage }}'

      # Database connection issues
      - alert: DatabaseConnectionPoolExhausted
        expr: database_connection_pool{state="waiting"} > 10
        for: 2m
        labels:
          severity: critical
          component: database
        annotations:
          summary: 'Database connection pool exhausted'
          description: '{{ $value }} connections waiting'

      # Redis connection issues
      - alert: RedisHighCommandLatency
        expr: |
          rate(redis_command_duration_seconds_sum[5m]) 
          / rate(redis_command_duration_seconds_count[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
          component: redis
        annotations:
          summary: 'High Redis command latency'
          description: 'Average command duration is {{ $value }}s'
```

**Update prometheus.yml:**

```yaml
# Add to prometheus.yml
rule_files:
  - '/etc/prometheus/alerts.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - 'alertmanager:9093'
```

**docker-compose.caddy.yml additions:**

```yaml
services:
  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - '9093:9093'
    volumes:
      - ./monitoring/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager-data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    networks:
      - caddy-network
    restart: unless-stopped

volumes:
  alertmanager-data:
```

**monitoring/alertmanager/alertmanager.yml:**

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: 'YOUR_SLACK_WEBHOOK_URL'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical'
      continue: true

    - match:
        severity: warning
      receiver: 'warning'

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#alerts'
        title: 'Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'critical'
    slack_configs:
      - channel: '#alerts-critical'
        title: '🔴 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    # email_configs:
    #   - to: 'team@example.com'
    #     from: 'alerts@example.com'
    #     smarthost: 'smtp.gmail.com:587'
    #     auth_username: 'alerts@example.com'
    #     auth_password: 'password'

  - name: 'warning'
    slack_configs:
      - channel: '#alerts'
        title: '⚠️ WARNING: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
```

**Afternoon: Configure Grafana Alerts (2-3 hours)**

**Tasks:**

- [ ] Configure Grafana alert rules
- [ ] Setup notification policies
- [ ] Test alert delivery
- [ ] Document alert response procedures

---

#### **Day 2: Load Testing & Baselines**

**Morning: Setup Load Testing (2-3 hours)**

**Tasks:**

- [ ] Install k6 or Artillery
- [ ] Create load test scenarios
- [ ] Run baseline tests
- [ ] Document current performance

**Install k6:**

```bash
# macOS
brew install k6

# Or use Docker
docker pull grafana/k6
```

**tests/load/baseline.js:**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 10 }, // Stay at 10 users
    { duration: '1m', target: 50 }, // Ramp up to 50 users
    { duration: '3m', target: 50 }, // Stay at 50 users
    { duration: '1m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'], // Error rate should be less than 1%
    errors: ['rate<0.05'],
  },
};

const BASE_URL = 'http://localhost:8080';
let accessToken = '';

export function setup() {
  // Login to get access token
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: 'test@example.com',
      password: 'password123',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  return { token: loginRes.json('data.accessToken') };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Test: Get user profile
  let res = http.get(`${BASE_URL}/api/auth/me`, { headers });
  check(res, {
    'get profile status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);

  // Test: Get todos
  res = http.get(`${BASE_URL}/api/todos`, { headers });
  check(res, {
    'get todos status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);

  // Test: Create todo
  res = http.post(
    `${BASE_URL}/api/todos`,
    JSON.stringify({
      title: 'Test Todo',
      description: 'Load test todo',
    }),
    { headers }
  );
  check(res, {
    'create todo status is 201': (r) => r.status === 201,
  }) || errorRate.add(1);

  sleep(2);
}
```

**Run load test:**

```bash
k6 run tests/load/baseline.js
```

**Afternoon: Establish Baselines (2-3 hours)**

**Tasks:**

- [ ] Run comprehensive load tests
- [ ] Document p50, p95, p99 latencies
- [ ] Document error rates
- [ ] Document resource usage
- [ ] Create baseline report

**Create baseline report:**

```markdown
# Performance Baseline Report

Date: 2025-11-13
Environment: Development (3 backend instances + Caddy)
Load: 50 concurrent users

## Response Times

- p50: 45ms
- p95: 120ms
- p99: 250ms

## Throughput

- Requests/sec: 850
- Success rate: 99.8%
- Error rate: 0.2%

## Resource Usage

- CPU (avg): 35%
- Memory (avg): 450MB
- Database connections: 15/50
- Redis commands/sec: 1200

## Bottlenecks

- Database queries > 100ms: 2%
- Slow routes: /api/todos/search (p95: 350ms)

## Recommendations

- Add database index on todos.userId
- Implement caching for /api/todos
- Consider pagination for large result sets
```

---

#### **Day 3: Database & Redis Exporters**

**Tasks:**

- [ ] Add PostgreSQL exporter
- [ ] Add Redis exporter
- [ ] Configure exporters in Prometheus
- [ ] Create database dashboard

**docker-compose.caddy.yml additions:**

```yaml
services:
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    container_name: postgres-exporter
    ports:
      - '9187:9187'
    environment:
      - DATA_SOURCE_NAME=postgresql://todouser:todopassword@postgres-caddy:5432/tododb?sslmode=disable
    networks:
      - caddy-network
    restart: unless-stopped

  redis-exporter:
    image: oliver006/redis_exporter:latest
    container_name: redis-exporter
    ports:
      - '9121:9121'
    environment:
      - REDIS_ADDR=redis-caddy:6379
    networks:
      - caddy-network
    restart: unless-stopped
```

---

#### **Day 4: Documentation**

**Tasks:**

- [ ] Write observability runbook
- [ ] Document dashboard usage
- [ ] Document alert response procedures
- [ ] Create troubleshooting guide

**Create OBSERVABILITY.md:**

```markdown
# Observability Guide

## Accessing Monitoring Tools

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **AlertManager**: http://localhost:9093

## Key Dashboards

1. **Infrastructure Overview** - System health, CPU, memory
2. **Application Metrics** - Requests, errors, latency
3. **Business Metrics** - Users, sessions, todos

## Common Queries

### Prometheus

- Request rate: `rate(http_requests_total[5m])`
- Error rate: `rate(http_requests_total{status_code=~"5.."}[5m])`
- p95 latency: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`

### Loki

- All errors: `{service=~"backend-.*"} |= "error"`
- User actions: `{service=~"backend-.*"} | json | userId="USER_ID"`

## Alert Response

### High Error Rate

1. Check Jaeger for failed traces
2. Review logs in Grafana
3. Check database connection pool
4. Verify external service health

### High Latency

1. Identify slow endpoints in Grafana
2. Check database query performance
3. Review Redis cache hit rate
4. Check network latency between services

### Service Down

1. Check container status: `docker ps`
2. Check logs: `docker logs backend-1`
3. Restart service: `docker restart backend-1`
4. Verify health endpoint
```

---

#### **Day 5: Final Polish & Testing**

**Tasks:**

- [ ] Review all dashboards
- [ ] Test all alerts
- [ ] Verify metrics accuracy
- [ ] Complete documentation
- [ ] Create demo/training session

---

## ✅ Success Criteria

- [ ] Prometheus collecting metrics from all services
- [ ] Grafana dashboards showing real-time data
- [ ] Jaeger showing distributed traces
- [ ] Loki aggregating logs from all containers
- [ ] Alerts configured and tested
- [ ] Load test baseline established
- [ ] Documentation complete
- [ ] Team trained on observability tools

---

## 📊 Metrics to Track

### Golden Signals (SRE)

1. **Latency** - How long requests take
2. **Traffic** - How many requests
3. **Errors** - How many requests fail
4. **Saturation** - How full the system is

### RED Method (for requests)

1. **Rate** - Requests per second
2. **Errors** - Error rate
3. **Duration** - Response time distribution

### USE Method (for resources)

1. **Utilization** - % time resource is busy
2. **Saturation** - Amount of queued work
3. **Errors** - Error count

---

## 🚀 Next Steps

After completing observability:

1. Review baseline metrics with team
2. Identify optimization opportunities
3. Proceed with microservices migration (with observability guiding every step!)

---

## 💰 Estimated Costs

### Infrastructure (Monthly)

```
Prometheus: $0 (self-hosted)
Grafana: $0 (self-hosted)
Jaeger: $0 (self-hosted)
Loki: $0 (self-hosted)
Storage: ~5GB (negligible)

Total: $0 (self-hosted) or $150-300/month (managed services)
```

### Time Investment

```
Week 1: Core infrastructure (40 hours)
Week 2: Polish & baselines (40 hours)

Total: 80 hours (~2 weeks for 1 person)
```

---

**Ready to start? Begin with Day 1: Prometheus + Grafana Setup!**
