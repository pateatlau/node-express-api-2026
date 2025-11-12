# Redis PubSub for GraphQL Subscriptions

## Overview

This document outlines the implementation of Redis-based PubSub for GraphQL subscriptions, enabling horizontal scaling and multi-instance deployment.

## Why Redis PubSub?

### Current Limitation (In-Memory PubSub)

````typescript
**Current Implementation:**

```typescript
const pubsub = new PubSub(); // In-memory only, single instance
````

**Problems:**

- Subscriptions only work within a single server instance
- Cannot scale horizontally
- Lost subscriptions on server restart
- No persistence

### Solution: Redis PubSub

```typescript
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

const pubsub = new RedisPubSub({
  publisher: new Redis(process.env.REDIS_URL),
  subscriber: new Redis(process.env.REDIS_URL),
}); // Works across multiple instances
```

**Benefits:**

- Subscriptions work across all server instances
- Horizontal scaling support
- Persistent message queue
- Production-ready

---

## Implementation Plan

### Phase 1: Setup Redis (30 minutes)

#### 1.1 Install Dependencies

```bash
npm install ioredis graphql-redis-subscriptions
npm install --save-dev @types/ioredis
```

#### 1.2 Update Docker Compose

**File: `docker-compose.dev.yml`**

```yaml
services:
  # ... existing services ...

  redis:
    image: redis:7-alpine
    container_name: todo-redis-dev
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  todo-api-dev:
    # ... existing config ...
    environment:
      # ... existing env vars ...
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      mongo-dev:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  mongo_data:
  redis_data: # Add Redis volume
```

#### 1.3 Update Environment Variables

**File: `.env.example`**

```bash
# Redis Configuration
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""  # Leave empty for development
REDIS_DB=0
```

**File: `src/config/env.ts`**

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // ... existing fields ...

  // Redis
  REDIS_URL: z.string().url().optional().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).max(15).optional().default(0),
});

export const env = envSchema.parse(process.env);
```

### Phase 2: Create Redis Client (1 hour)

#### 2.1 Create Redis Configuration

**File: `src/config/redis.ts`**

```typescript
import Redis from 'ioredis';
import logger from './logger';
import { env } from './env';

interface RedisConfig {
  url: string;
  password?: string;
  db: number;
}

class RedisConnection {
  private static publisher: Redis | null = null;
  private static subscriber: Redis | null = null;

  private static createClient(name: string): Redis {
    const config: RedisConfig = {
      url: env.REDIS_URL,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB,
    };

    const client = new Redis(config.url, {
      password: config.password,
      db: config.db,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis ${name} reconnecting`, { attempt: times, delay });
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    client.on('connect', () => {
      logger.info(`Redis ${name} connected`, {
        url: config.url.replace(/:[^:]*@/, ':****@'), // Hide password
      });
    });

    client.on('error', (error: Error) => {
      logger.error(`Redis ${name} error`, {
        error: error.message,
        stack: error.stack,
      });
    });

    client.on('close', () => {
      logger.warn(`Redis ${name} connection closed`);
    });

    return client;
  }

  static getPublisher(): Redis {
    if (!this.publisher) {
      this.publisher = this.createClient('publisher');
    }
    return this.publisher;
  }

  static getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = this.createClient('subscriber');
    }
    return this.subscriber;
  }

  static async disconnect(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    if (this.publisher) {
      disconnectPromises.push(
        this.publisher.quit().then(() => {
          logger.info('Redis publisher disconnected');
        })
      );
      this.publisher = null;
    }

    if (this.subscriber) {
      disconnectPromises.push(
        this.subscriber.quit().then(() => {
          logger.info('Redis subscriber disconnected');
        })
      );
      this.subscriber = null;
    }

    await Promise.all(disconnectPromises);
  }

  static async healthCheck(): Promise<boolean> {
    try {
      const publisher = this.getPublisher();
      const pong = await publisher.ping();
      return pong === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', { error });
      return false;
    }
  }
}

export default RedisConnection;
```

### Phase 3: Update PubSub Implementation (1 hour)

#### 3.1 Create PubSub Factory

**File: `src/graphql/pubsub.ts`**

```typescript
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { PubSub } from 'graphql-subscriptions';
import RedisConnection from '../config/redis';
import logger from '../config/logger';
import { env } from '../config/env';

let pubsubInstance: RedisPubSub | PubSub | null = null;

/**
 * Get or create PubSub instance
 * Uses Redis in production, in-memory for development/testing
 */
export function getPubSub(): RedisPubSub | PubSub {
  if (pubsubInstance) {
    return pubsubInstance;
  }

  // Use Redis PubSub in production or when Redis URL is configured
  if (env.NODE_ENV === 'production' || env.REDIS_URL) {
    logger.info('Initializing Redis PubSub');

    pubsubInstance = new RedisPubSub({
      publisher: RedisConnection.getPublisher(),
      subscriber: RedisConnection.getSubscriber(),
      // Optional: Add message serialization
      serializer: (value: unknown) => JSON.stringify(value),
      deserializer: (value: string) => JSON.parse(value),
    });

    logger.info('Redis PubSub initialized');
  } else {
    // Fallback to in-memory PubSub for local development
    logger.warn('Using in-memory PubSub (not suitable for production)');
    pubsubInstance = new PubSub();
  }

  return pubsubInstance;
}

/**
 * Subscription event names
 */
export const SUBSCRIPTION_EVENTS = {
  TODO_CHANGED: 'TODO_CHANGED',
  TODO_CREATED: 'TODO_CREATED',
  TODO_UPDATED: 'TODO_UPDATED',
  TODO_DELETED: 'TODO_DELETED',
} as const;

/**
 * Type-safe publish function
 */
export async function publishTodoChange(
  event: keyof typeof SUBSCRIPTION_EVENTS,
  payload: unknown
): Promise<void> {
  const pubsub = getPubSub();
  await pubsub.publish(SUBSCRIPTION_EVENTS[event], payload);

  logger.debug('Published subscription event', {
    event: SUBSCRIPTION_EVENTS[event],
    payload,
  });
}
```

#### 3.2 Update Resolvers

**File: `src/graphql/resolvers/subscriptions.ts`**

**Before:**

```typescript
import { PubSub } from 'graphql-subscriptions';

const pubsub = new PubSub();

export const subscriptionResolvers = {
  Subscription: {
    todoChanged: {
      subscribe: () => pubsub.asyncIterator(['TODO_CHANGED']),
    },
  },
};
```

**After:**

```typescript
import { getPubSub, SUBSCRIPTION_EVENTS } from '../pubsub';

export const subscriptionResolvers = {
  Subscription: {
    todoChanged: {
      subscribe: () => {
        const pubsub = getPubSub();
        return pubsub.asyncIterator([SUBSCRIPTION_EVENTS.TODO_CHANGED]);
      },
    },
  },
};
```

#### 3.3 Update Mutation Resolvers

**File: `src/graphql/resolvers/mutations.ts`**

**Before:**

```typescript
import { pubsub } from './subscriptions';

export const mutationResolvers = {
  Mutation: {
    createTodo: async (_parent, args, context) => {
      const todo = await repository.create(args.input);

      await pubsub.publish('TODO_CHANGED', {
        todoChanged: { ...todo, changeType: 'CREATED' },
      });

      return todo;
    },
  },
};
```

**After:**

```typescript
import { publishTodoChange } from '../pubsub';

export const mutationResolvers = {
  Mutation: {
    createTodo: async (_parent, args, context) => {
      const todo = await repository.create(args.input);

      await publishTodoChange('TODO_CHANGED', {
        todoChanged: { ...todo, changeType: 'CREATED' },
      });

      return todo;
    },
  },
};
```

### Phase 4: Update Health Check (30 minutes)

**File: `src/routes/health.routes.ts`**

```typescript
import RedisConnection from '../config/redis';

router.get('/health', async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      type: getDatabaseType(),
      connected: false,
    },
    redis: {
      connected: false,
    },
  };

  try {
    // Check database
    if (getDatabaseType() === 'postgres') {
      await prisma.$queryRaw`SELECT 1`;
      health.database.connected = true;
    }

    // Check Redis
    health.redis.connected = await RedisConnection.healthCheck();

    // Overall health
    health.status = health.database.connected && health.redis.connected ? 'healthy' : 'degraded';

    res.json(health);
  } catch (error) {
    health.status = 'unhealthy';
    res.status(503).json(health);
  }
});
```

### Phase 5: Testing (2 hours)

#### 5.1 Unit Tests

**File: `src/graphql/__tests__/pubsub.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getPubSub, publishTodoChange, SUBSCRIPTION_EVENTS } from '../pubsub';

describe('PubSub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return singleton instance', () => {
    const pubsub1 = getPubSub();
    const pubsub2 = getPubSub();

    expect(pubsub1).toBe(pubsub2);
  });

  it('should publish events', async () => {
    const pubsub = getPubSub();
    const publishSpy = vi.spyOn(pubsub, 'publish');

    await publishTodoChange('TODO_CREATED', { id: '1', title: 'Test' });

    expect(publishSpy).toHaveBeenCalledWith(SUBSCRIPTION_EVENTS.TODO_CREATED, {
      id: '1',
      title: 'Test',
    });
  });
});
```

#### 5.2 Integration Tests

**File: `src/__tests__/subscriptions-redis.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient } from './helpers';
import RedisConnection from '../config/redis';

describe('GraphQL Subscriptions with Redis', () => {
  beforeAll(async () => {
    // Ensure Redis is connected
    const isHealthy = await RedisConnection.healthCheck();
    if (!isHealthy) {
      throw new Error('Redis not available for testing');
    }
  });

  afterAll(async () => {
    await RedisConnection.disconnect();
  });

  it('should receive todo changes across multiple clients', async () => {
    // Simulate multiple server instances
    const client1 = createTestClient();
    const client2 = createTestClient();

    const subscription = client1.subscribe({
      query: 'subscription { todoChanged { id title } }',
    });

    // Wait for subscription to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create todo from different client
    await client2.mutate({
      mutation: 'mutation { createTodo(input: { title: "Test" }) { id } }',
    });

    // Client 1 should receive the event
    const result = await subscription.next();
    expect(result.value).toBeDefined();
  });
});
```

#### 5.3 Manual Testing

```bash
# Terminal 1: Start Redis
docker-compose up redis

# Terminal 2: Start server instance 1
PORT=4000 npm run dev

# Terminal 3: Start server instance 2
PORT=4001 npm run dev

# Terminal 4: Subscribe on instance 1
wscat -c ws://localhost:4000/graphql
> {"type":"connection_init"}
> {"id":"1","type":"subscribe","payload":{"query":"subscription { todoChanged { id title } }"}}

# Terminal 5: Create todo on instance 2
curl -X POST http://localhost:4001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { createTodo(input: { title: \"Test\" }) { id } }"}'

# Terminal 4 should receive the event!
```

---

## Configuration

### Development

```env
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Production

```env
REDIS_URL=redis://redis.example.com:6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0
```

### Redis Cluster (Advanced)

```typescript
const pubsub = new RedisPubSub({
  publisher: new Redis.Cluster([
    { host: 'redis-1', port: 6379 },
    { host: 'redis-2', port: 6379 },
    { host: 'redis-3', port: 6379 },
  ]),
  subscriber: new Redis.Cluster([
    { host: 'redis-1', port: 6379 },
    { host: 'redis-2', port: 6379 },
    { host: 'redis-3', port: 6379 },
  ]),
});
```

---

## Monitoring

### Redis Commands for Debugging

```bash
# Monitor all Redis activity
redis-cli MONITOR

# Check active subscriptions
redis-cli PUBSUB CHANNELS

# Check subscriber count for a channel
redis-cli PUBSUB NUMSUB TODO_CHANGED

# Check memory usage
redis-cli INFO memory
```

### Logging

Add debug logging for subscription events:

```typescript
logger.debug('Subscription created', {
  channel: SUBSCRIPTION_EVENTS.TODO_CHANGED,
  clientId: context.connectionParams?.clientId,
});
```

---

## Performance Considerations

### Connection Pooling

- Use separate Redis clients for publisher and subscriber
- Reuse connections across requests
- Configure connection pool size based on load

### Message Size

- Keep subscription payloads small
- Avoid sending large objects
- Consider compression for large messages

### Memory Management

- Monitor Redis memory usage
- Set maxmemory policy (e.g., `allkeys-lru`)
- Clean up old subscriptions

---

## Security

### Authentication

```typescript
const pubsub = new RedisPubSub({
  connection: {
    host: 'redis.example.com',
    port: 6379,
    password: env.REDIS_PASSWORD,
    tls: env.NODE_ENV === 'production' ? {} : undefined,
  },
});
```

### Network Security

- Use TLS in production
- Restrict Redis access to internal network
- Use strong passwords
- Enable Redis AUTH

---

## Rollback Plan

If issues arise:

1. **Revert to In-Memory PubSub:**

   ```typescript
   // Temporarily disable Redis
   export function getPubSub() {
     return new PubSub(); // Fallback to in-memory
   }
   ```

2. **Keep Redis for Caching Only:**
   - Use Redis for other features
   - Revert subscriptions to single-instance

3. **No Data Loss:**
   - Subscriptions are transient
   - No persistent data affected

---

## Files to Create/Update

| File                                     | Action | Priority |
| ---------------------------------------- | ------ | -------- |
| `src/config/redis.ts`                    | Create | High     |
| `src/graphql/pubsub.ts`                  | Create | High     |
| `src/config/env.ts`                      | Update | High     |
| `src/graphql/resolvers/subscriptions.ts` | Update | High     |
| `src/graphql/resolvers/mutations.ts`     | Update | High     |
| `src/routes/health.routes.ts`            | Update | Medium   |
| `docker-compose.dev.yml`                 | Update | High     |
| `.env.example`                           | Update | Medium   |
| `package.json`                           | Update | High     |

---

## Success Criteria

- [ ] Redis connection established
- [ ] PubSub works across multiple instances
- [ ] Subscriptions receive events from any instance
- [ ] Health check includes Redis status
- [ ] Tests passing
- [ ] No memory leaks
- [ ] Performance metrics acceptable
- [ ] Documentation updated

---

## Resources

- [graphql-redis-subscriptions](https://github.com/davidyaha/graphql-redis-subscriptions)
- [ioredis Documentation](https://github.com/redis/ioredis)
- [Redis Best Practices](https://redis.io/docs/management/optimization/)

**Status:** 📋 Ready for Implementation  
**Estimated Time:** 4-6 hours  
**Last Updated:** November 12, 2025
