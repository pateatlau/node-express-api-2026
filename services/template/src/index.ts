import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { logger, morganStream } from '../../shared/utils/logger.js';
import {
  metricsMiddleware,
  metricsHandler,
  initializeMetrics,
} from '../../shared/utils/metrics.js';

/**
 * Service Template
 *
 * This is a template for creating new microservices.
 * Copy this directory and customize for your service.
 */

const SERVICE_NAME = process.env.SERVICE_NAME || 'template-service';
const PORT = process.env.PORT || 4001;

// Initialize metrics for this service
initializeMetrics(SERVICE_NAME);

const app: Express = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request ID for tracing
app.use((req, _res, next) => {
  req.headers['x-request-id'] =
    req.headers['x-request-id'] ||
    `${SERVICE_NAME}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  next();
});

app.use(morgan('combined', { stream: morganStream }));
app.use(metricsMiddleware(SERVICE_NAME));

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  const health = {
    success: true,
    service: SERVICE_NAME,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    dependencies: {
      // Add checks for databases, Redis, etc.
      // database: await checkDatabase(),
      // redis: await checkRedis(),
    },
  };

  // Return 503 if any critical dependency is down
  const allHealthy = Object.values(health.dependencies).every(
    (status) => status === true || status === 'healthy'
  );

  res.status(allHealthy ? 200 : 503).json(health);
});

// Readiness probe - checks if service is ready to accept traffic
app.get('/ready', (_req: Request, res: Response) => {
  // Check if service dependencies are ready
  // Return 200 only when fully initialized
  res.json({
    success: true,
    service: SERVICE_NAME,
    status: 'ready',
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Routes
// Import and use your service routes here
// Example:
// import authRoutes from './routes/auth.routes.js';
// app.use('/api/auth', authRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler (must have 4 parameters for Express to recognize it)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`${SERVICE_NAME} started`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
  });
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown`);

  server.close(() => {
    logger.info('HTTP server closed');

    // Close database connections, clean up resources here
    // Example: await prisma.$disconnect();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
