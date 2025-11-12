# MongoDB Health Check

## Overview

Add MongoDB connection health check to complement the existing Prisma (PostgreSQL) health check, providing complete database monitoring for the hybrid database architecture.

## Current State

**File: `src/routes/health.routes.ts`**

Currently only checks Prisma (PostgreSQL):

```typescript
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check Prisma connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
    });
  }
});
```

---

## Implementation Plan

### Phase 1: Create MongoDB Health Service (30 minutes)

#### 1.1 Health Check Utilities

**File: `src/services/health.service.ts`**

```typescript
import mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

export interface DatabaseHealth {
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  responseTime: number;
  details?: {
    host?: string;
    database?: string;
    error?: string;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  databases: {
    postgres: DatabaseHealth;
    mongodb: DatabaseHealth;
  };
  services: {
    redis?: DatabaseHealth;
  };
}

/**
 * Check PostgreSQL (Prisma) health
 */
export async function checkPrismaHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;

    return {
      name: 'PostgreSQL',
      status: 'connected',
      responseTime,
      details: {
        host: process.env.POSTGRES_HOST || 'localhost',
        database: process.env.POSTGRES_DB || 'tododb',
      },
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('PostgreSQL health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      name: 'PostgreSQL',
      status: 'error',
      responseTime,
      details: {
        error: error instanceof Error ? error.message : 'Connection failed',
      },
    };
  }
}

/**
 * Check MongoDB health
 */
export async function checkMongoHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now();

  try {
    // Check connection state
    const connectionState = mongoose.connection.readyState;

    if (connectionState === 0) {
      return {
        name: 'MongoDB',
        status: 'disconnected',
        responseTime: Date.now() - startTime,
      };
    }

    if (connectionState === 2) {
      return {
        name: 'MongoDB',
        status: 'connecting',
        responseTime: Date.now() - startTime,
      };
    }

    // Ping database
    await mongoose.connection.db?.admin().ping();
    const responseTime = Date.now() - startTime;

    return {
      name: 'MongoDB',
      status: 'connected',
      responseTime,
      details: {
        host: mongoose.connection.host || 'unknown',
        database: mongoose.connection.name || 'unknown',
      },
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('MongoDB health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      name: 'MongoDB',
      status: 'error',
      responseTime,
      details: {
        error: error instanceof Error ? error.message : 'Connection failed',
      },
    };
  }
}

/**
 * Check Redis health (optional - if Redis is configured)
 */
export async function checkRedisHealth(): Promise<DatabaseHealth | null> {
  // Only check if Redis is configured
  if (!process.env.REDIS_HOST) {
    return null;
  }

  const startTime = Date.now();

  try {
    const { getRedisClient } = await import('../config/redis');
    const redis = getRedisClient();

    await redis.ping();
    const responseTime = Date.now() - startTime;

    return {
      name: 'Redis',
      status: 'connected',
      responseTime,
      details: {
        host: process.env.REDIS_HOST,
      },
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Redis health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      name: 'Redis',
      status: 'error',
      responseTime,
      details: {
        error: error instanceof Error ? error.message : 'Connection failed',
      },
    };
  }
}

/**
 * Comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const [postgresHealth, mongoHealth, redisHealth] = await Promise.all([
    checkPrismaHealth(),
    checkMongoHealth(),
    checkRedisHealth(),
  ]);

  // Determine overall status
  const databases = [postgresHealth, mongoHealth];
  const hasError = databases.some((db) => db.status === 'error');
  const hasDisconnected = databases.some((db) => db.status === 'disconnected');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

  if (hasError) {
    overallStatus = 'unhealthy';
  } else if (hasDisconnected) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    databases: {
      postgres: postgresHealth,
      mongodb: mongoHealth,
    },
    services: {},
  };

  if (redisHealth) {
    result.services.redis = redisHealth;
  }

  return result;
}

/**
 * Cleanup resources
 */
export async function cleanup(): Promise<void> {
  await prisma.$disconnect();
}
```

### Phase 2: Update Health Routes (20 minutes)

#### 2.1 Enhanced Health Endpoint

**File: `src/routes/health.routes.ts`**

```typescript
import { Router, Request, Response } from 'express';
import {
  performHealthCheck,
  checkPrismaHealth,
  checkMongoHealth,
} from '../services/health.service';
import logger from '../config/logger';

const router = Router();

/**
 * @route GET /api/health
 * @desc Comprehensive health check
 * @access Public
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const healthResult = await performHealthCheck();

    const statusCode =
      healthResult.status === 'healthy'
        ? 200
        : healthResult.status === 'degraded'
          ? 207 // Multi-Status
          : 503; // Service Unavailable

    res.status(statusCode).json(healthResult);
  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * @route GET /api/health/postgres
 * @desc PostgreSQL health check only
 * @access Public
 */
router.get('/postgres', async (req: Request, res: Response) => {
  try {
    const health = await checkPrismaHealth();

    const statusCode = health.status === 'connected' ? 200 : 503;

    res.status(statusCode).json({
      database: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('PostgreSQL health check failed', { error });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route GET /api/health/mongodb
 * @desc MongoDB health check only
 * @access Public
 */
router.get('/mongodb', async (req: Request, res: Response) => {
  try {
    const health = await checkMongoHealth();

    const statusCode = health.status === 'connected' ? 200 : 503;

    res.status(statusCode).json({
      database: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('MongoDB health check failed', { error });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route GET /api/health/liveness
 * @desc Kubernetes liveness probe
 * @access Public
 */
router.get('/liveness', (req: Request, res: Response) => {
  // Simple check - is the process running?
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @route GET /api/health/readiness
 * @desc Kubernetes readiness probe
 * @access Public
 */
router.get('/readiness', async (req: Request, res: Response) => {
  try {
    const healthResult = await performHealthCheck();

    // Ready only if all critical databases are connected
    const isReady =
      healthResult.databases.postgres.status === 'connected' &&
      healthResult.databases.mongodb.status === 'connected';

    const statusCode = isReady ? 200 : 503;

    res.status(statusCode).json({
      status: isReady ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      databases: healthResult.databases,
    });
  } catch (error) {
    logger.error('Readiness check failed', { error });
    res.status(503).json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
```

### Phase 3: Kubernetes Integration (15 minutes)

#### 3.1 Update Kubernetes Deployment

**File: `k8s/deployment.yaml`** (example)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: todo-api
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: api
          image: todo-api:latest
          ports:
            - containerPort: 3000

          # Liveness probe - restart if unhealthy
          livenessProbe:
            httpGet:
              path: /api/health/liveness
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          # Readiness probe - remove from service if not ready
          readinessProbe:
            httpGet:
              path: /api/health/readiness
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 5
            timeoutSeconds: 3
            successThreshold: 1
            failureThreshold: 3

          # Startup probe - give time for initial connection
          startupProbe:
            httpGet:
              path: /api/health/liveness
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 30

          env:
            - name: NODE_ENV
              value: 'production'
            - name: POSTGRES_HOST
              value: 'postgres-service'
            - name: MONGO_URI
              valueFrom:
                secretKeyRef:
                  name: mongo-secret
                  key: uri
```

### Phase 4: Monitoring Integration (30 minutes)

#### 4.1 Prometheus Metrics

**File: `src/routes/health.routes.ts`** (add to existing)

```typescript
import { register, Counter, Histogram } from 'prom-client';

// Health check metrics
const healthCheckCounter = new Counter({
  name: 'health_checks_total',
  help: 'Total number of health checks',
  labelNames: ['status', 'database'],
});

const healthCheckDuration = new Histogram({
  name: 'health_check_duration_seconds',
  help: 'Health check duration in seconds',
  labelNames: ['database'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

/**
 * @route GET /api/metrics
 * @desc Prometheus metrics endpoint
 * @access Public (should be restricted in production)
 */
router.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

#### 4.2 Update Health Service with Metrics

**File: `src/services/health.service.ts`** (update existing functions)

```typescript
import { healthCheckCounter, healthCheckDuration } from '../metrics';

export async function checkMongoHealth(): Promise<DatabaseHealth> {
  const timer = healthCheckDuration.startTimer({ database: 'mongodb' });
  const startTime = Date.now();

  try {
    // ... existing health check logic

    const result = {
      name: 'MongoDB',
      status: 'connected' as const,
      responseTime: Date.now() - startTime,
      // ... other fields
    };

    healthCheckCounter.inc({ status: 'success', database: 'mongodb' });
    timer();

    return result;
  } catch (error) {
    healthCheckCounter.inc({ status: 'error', database: 'mongodb' });
    timer();

    // ... existing error handling
  }
}
```

### Phase 5: Testing (1 hour)

#### 5.1 Unit Tests

**File: `src/services/__tests__/health.service.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { checkPrismaHealth, checkMongoHealth, performHealthCheck } from '../health.service';

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $queryRaw: vi.fn().mockResolvedValue([]),
  })),
}));

describe('Health Service', () => {
  describe('checkMongoHealth', () => {
    it('should return connected when MongoDB is available', async () => {
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
      vi.spyOn(mongoose.connection.db?.admin() as any, 'ping').mockResolvedValue({});
      vi.spyOn(mongoose.connection, 'host', 'get').mockReturnValue('localhost');
      vi.spyOn(mongoose.connection, 'name', 'get').mockReturnValue('testdb');

      const result = await checkMongoHealth();

      expect(result.status).toBe('connected');
      expect(result.name).toBe('MongoDB');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.details?.host).toBe('localhost');
      expect(result.details?.database).toBe('testdb');
    });

    it('should return disconnected when MongoDB is not connected', async () => {
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0);

      const result = await checkMongoHealth();

      expect(result.status).toBe('disconnected');
      expect(result.name).toBe('MongoDB');
    });

    it('should return connecting when MongoDB is connecting', async () => {
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(2);

      const result = await checkMongoHealth();

      expect(result.status).toBe('connecting');
    });

    it('should return error when ping fails', async () => {
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
      vi.spyOn(mongoose.connection.db?.admin() as any, 'ping').mockRejectedValue(
        new Error('Connection timeout')
      );

      const result = await checkMongoHealth();

      expect(result.status).toBe('error');
      expect(result.details?.error).toContain('Connection timeout');
    });
  });

  describe('checkPrismaHealth', () => {
    it('should return connected when Prisma query succeeds', async () => {
      const result = await checkPrismaHealth();

      expect(result.status).toBe('connected');
      expect(result.name).toBe('PostgreSQL');
      expect(result.responseTime).toBeGreaterThan(0);
    });
  });

  describe('performHealthCheck', () => {
    it('should return healthy when all databases connected', async () => {
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
      vi.spyOn(mongoose.connection.db?.admin() as any, 'ping').mockResolvedValue({});

      const result = await performHealthCheck();

      expect(result.status).toBe('healthy');
      expect(result.databases.postgres.status).toBe('connected');
      expect(result.databases.mongodb.status).toBe('connected');
    });

    it('should return degraded when one database disconnected', async () => {
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0);

      const result = await performHealthCheck();

      expect(result.status).toBe('degraded');
      expect(result.databases.mongodb.status).toBe('disconnected');
    });

    it('should return unhealthy when database has error', async () => {
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
      vi.spyOn(mongoose.connection.db?.admin() as any, 'ping').mockRejectedValue(
        new Error('Connection error')
      );

      const result = await performHealthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.databases.mongodb.status).toBe('error');
    });
  });
});
```

#### 5.2 Integration Tests

**File: `src/__tests__/health.integration.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import mongoose from 'mongoose';

describe('Health Endpoints Integration', () => {
  describe('GET /api/health', () => {
    it('should return comprehensive health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('databases');
      expect(response.body.databases).toHaveProperty('postgres');
      expect(response.body.databases).toHaveProperty('mongodb');
    });

    it('should include response times for each database', async () => {
      const response = await request(app).get('/api/health');

      expect(response.body.databases.postgres).toHaveProperty('responseTime');
      expect(response.body.databases.mongodb).toHaveProperty('responseTime');
      expect(response.body.databases.postgres.responseTime).toBeGreaterThan(0);
    });
  });

  describe('GET /api/health/postgres', () => {
    it('should return PostgreSQL-specific health', async () => {
      const response = await request(app).get('/api/health/postgres');

      expect(response.body).toHaveProperty('database');
      expect(response.body.database.name).toBe('PostgreSQL');
    });
  });

  describe('GET /api/health/mongodb', () => {
    it('should return MongoDB-specific health', async () => {
      const response = await request(app).get('/api/health/mongodb');

      expect(response.body).toHaveProperty('database');
      expect(response.body.database.name).toBe('MongoDB');
    });
  });

  describe('GET /api/health/liveness', () => {
    it('should always return 200 when process is running', async () => {
      const response = await request(app).get('/api/health/liveness');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('alive');
    });
  });

  describe('GET /api/health/readiness', () => {
    it('should return 200 when all critical services ready', async () => {
      const response = await request(app).get('/api/health/readiness');

      // May be 200 or 503 depending on database availability
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('databases');
    });
  });
});
```

---

## Response Examples

### Healthy System

```json
{
  "status": "healthy",
  "timestamp": "2025-11-12T10:30:00.000Z",
  "uptime": 3600.5,
  "databases": {
    "postgres": {
      "name": "PostgreSQL",
      "status": "connected",
      "responseTime": 15,
      "details": {
        "host": "localhost",
        "database": "tododb"
      }
    },
    "mongodb": {
      "name": "MongoDB",
      "status": "connected",
      "responseTime": 12,
      "details": {
        "host": "localhost",
        "database": "todos"
      }
    }
  },
  "services": {
    "redis": {
      "name": "Redis",
      "status": "connected",
      "responseTime": 8,
      "details": {
        "host": "localhost"
      }
    }
  }
}
```

### Degraded System (MongoDB Disconnected)

```json
{
  "status": "degraded",
  "timestamp": "2025-11-12T10:31:00.000Z",
  "uptime": 3660.5,
  "databases": {
    "postgres": {
      "name": "PostgreSQL",
      "status": "connected",
      "responseTime": 14
    },
    "mongodb": {
      "name": "MongoDB",
      "status": "disconnected",
      "responseTime": 2
    }
  }
}
```

### Unhealthy System (Database Error)

```json
{
  "status": "unhealthy",
  "timestamp": "2025-11-12T10:32:00.000Z",
  "uptime": 3720.5,
  "databases": {
    "postgres": {
      "name": "PostgreSQL",
      "status": "connected",
      "responseTime": 16
    },
    "mongodb": {
      "name": "MongoDB",
      "status": "error",
      "responseTime": 5000,
      "details": {
        "error": "Connection timeout"
      }
    }
  }
}
```

---

## Monitoring Dashboards

### Grafana Dashboard (Example)

```json
{
  "dashboard": {
    "title": "API Health Monitoring",
    "panels": [
      {
        "title": "Overall Health Status",
        "targets": [
          {
            "expr": "health_checks_total{status='success'}"
          }
        ]
      },
      {
        "title": "Database Response Times",
        "targets": [
          {
            "expr": "health_check_duration_seconds{database='mongodb'}"
          },
          {
            "expr": "health_check_duration_seconds{database='postgres'}"
          }
        ]
      }
    ]
  }
}
```

---

## Files to Create/Update

| File                             | Action | Priority |
| -------------------------------- | ------ | -------- |
| `src/services/health.service.ts` | Create | High     |
| `src/routes/health.routes.ts`    | Update | High     |
| `k8s/deployment.yaml`            | Create | Medium   |
| `src/metrics/index.ts`           | Create | Medium   |

---

## Best Practices

**DO:**

- Check all critical dependencies
- Return appropriate HTTP status codes
- Include response times
- Separate liveness and readiness probes
- Log health check failures
- Use timeout values

**DON'T:**

- Perform expensive operations in health checks
- Return sensitive information
- Cache health check results
- Run health checks too frequently

---

## Resources

- [Kubernetes Liveness and Readiness Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Health Check Response Format RFC](https://tools.ietf.org/id/draft-inadarei-api-health-check-06.html)

**Status:** Ready for Implementation  
**Estimated Time:** 2-3 hours  
**Last Updated:** November 12, 2025
