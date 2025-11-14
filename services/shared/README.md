# Shared Utilities for Microservices

This package contains shared utilities, middleware, and types used across all microservices.

## Contents

### Middleware

#### `middleware/authenticate.ts`

JWT authentication middleware for protecting routes.

```typescript
import { authenticate } from '../shared/middleware/authenticate.js';

router.get('/protected', authenticate, async (req, res) => {
  const userId = req.user?.userId;
  // ...
});
```

#### `middleware/serviceAuth.ts`

Service-to-service authentication using API keys.

```typescript
import { authenticateService } from '../shared/middleware/serviceAuth.js';

// Internal endpoint
router.get('/internal/data', authenticateService, async (req, res) => {
  // Only accessible with valid service API key
});
```

### Utilities

#### `utils/logger.ts`

Winston-based structured logger with service metadata.

```typescript
import { logger } from '../shared/utils/logger.js';

logger.info('User logged in', { userId: '123' });
logger.error('Database error', { error: err.message });
```

#### `utils/metrics.ts`

Prometheus metrics collection and middleware.

```typescript
import { metricsMiddleware, metricsHandler } from '../shared/utils/metrics.js';

app.use(metricsMiddleware('my-service'));
app.get('/metrics', metricsHandler);
```

### Types

#### `types/index.ts`

Shared TypeScript interfaces and types.

```typescript
import type { User, Session, ServiceResponse } from '../shared/types/index.js';
```

## Usage in Services

All microservices should import from the shared package:

```typescript
// In your service
import { authenticate } from '../../shared/middleware/authenticate.js';
import { logger } from '../../shared/utils/logger.js';
import type { User } from '../../shared/types/index.js';
```

## Environment Variables

Required environment variables for shared utilities:

```bash
# JWT Configuration
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-key

# Service Authentication
SERVICE_API_KEY=your-service-key

# Logging
SERVICE_NAME=my-service
LOG_LEVEL=debug|info|warn|error
NODE_ENV=development|production
```

## Best Practices

1. **Always use shared middleware** instead of duplicating auth logic
2. **Use the shared logger** for consistent log formatting
3. **Add metrics** to all critical endpoints
4. **Import types** for better type safety
5. **Keep shared code generic** - service-specific logic belongs in services
