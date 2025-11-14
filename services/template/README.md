# Service Template README

## Overview

This is a template for creating new microservices in the architecture. Copy this directory and customize for your specific service needs.

## Structure

```
template/
├── src/
│   ├── index.ts          # Main entry point
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── middleware/       # Custom middleware
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

## Getting Started

1. **Copy this template:**

   ```bash
   cp -r services/template services/your-service-name
   cd services/your-service-name
   ```

2. **Update configuration:**
   - Edit `package.json` (name, description)
   - Copy `.env.example` to `.env` and configure
   - Update `SERVICE_NAME` in `.env`
   - Update `PORT` in `.env`

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Start development:**
   ```bash
   npm run dev
   ```

## Shared Utilities

The template uses shared utilities from `services/shared/`:

- **authenticate.ts**: JWT authentication middleware
- **serviceAuth.ts**: Service-to-service authentication
- **logger.ts**: Structured logging with Winston
- **metrics.ts**: Prometheus metrics collection
- **types/index.ts**: Shared TypeScript types

## Endpoints

### Health Check

```
GET /health
```

Returns service health status.

### Metrics

```
GET /metrics
```

Returns Prometheus metrics.

## Development

### Run in development mode

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Run in production

```bash
npm start
```

### Run tests

```bash
npm test
```

### Type checking

```bash
npm run type-check
```

## Docker

### Build image

```bash
docker build -t your-service-name:latest -f services/template/Dockerfile .
```

### Run container

```bash
docker run -p 4001:4001 --env-file services/template/.env your-service-name:latest
```

## Environment Variables

See `.env.example` for all available configuration options.

## Adding Routes

1. Create route file in `src/routes/`:

   ```typescript
   import express from 'express';
   import { authenticate } from '../../shared/middleware/authenticate.js';

   const router = express.Router();

   router.get('/example', authenticate, async (req, res) => {
     res.json({ success: true, data: 'example' });
   });

   export default router;
   ```

2. Import and use in `src/index.ts`:
   ```typescript
   import exampleRoutes from './routes/example.routes.js';
   app.use('/api/example', exampleRoutes);
   ```

## Service Communication

To call other services, use the service API key:

```typescript
import axios from 'axios';
import { getServiceApiKey } from '../../shared/middleware/serviceAuth.js';

const response = await axios.get('http://auth-service:4001/internal/user/123', {
  headers: {
    'X-Service-Key': getServiceApiKey(),
  },
});
```

## Monitoring

- **Logs**: Structured JSON logs via Winston
- **Metrics**: Prometheus metrics at `/metrics`
- **Health**: Health check at `/health`

## Best Practices

1. Always use the shared authentication middleware
2. Log important events with appropriate levels
3. Use TypeScript types from shared package
4. Implement proper error handling
5. Add metrics for critical operations
6. Keep services stateless when possible
7. Use environment variables for configuration
