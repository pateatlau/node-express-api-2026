import 'express-async-errors';
import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import todosRouter from './routes/todos';
import authRouter from './routes/auth.routes';
import { errorHandler } from './middleware/errorHandler';
import prisma from './lib/prisma';
import { swaggerSpec } from './config/swagger';
import { isRestEnabled, isGraphQLEnabled, getApiType } from './config/apiType';
import logger, { morganStream } from './config/logger';
import morgan from 'morgan';

// Import new middleware
import { securityMiddleware, corsConfig, additionalSecurityHeaders } from './middleware/security';
import { compressionMiddleware } from './middleware/compression';
import { apiLimiter, graphqlLimiter } from './middleware/rateLimiter';
import { initSentry } from './config/sentry';

const app = express();

// Initialize Sentry (must be first) - optional if packages not installed
try {
  initSentry();
  logger.info('Sentry initialized successfully');
} catch (error) {
  logger.warn('Sentry initialization failed - continuing without error tracking', { error });
}

// Security middleware
app.use(securityMiddleware);
app.use(additionalSecurityHeaders);
app.use(cors(corsConfig));

// Rate limiting - apply to API routes
app.use('/api/', apiLimiter);
if (isGraphQLEnabled()) {
  app.use('/graphql', graphqlLimiter);
}

// Logging - use winston stream for morgan
app.use(morgan('combined', { stream: morganStream }));

// Body parsing and compression
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Parse cookies for refresh tokens
app.use(compressionMiddleware);

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy
 */

// API Documentation
if (isRestEnabled()) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Routes
app.get('/', (req: Request, res: Response) => {
  const apiType = getApiType();
  const endpoints: string[] = [];

  if (isRestEnabled()) {
    endpoints.push('REST API: /api/todos');
    endpoints.push('API Docs: /api-docs');
  }

  if (isGraphQLEnabled()) {
    endpoints.push('GraphQL: /graphql');
    endpoints.push('GraphQL Playground: https://studio.apollographql.com/sandbox/explorer');
  }

  res.json({
    message: 'Todo API is running',
    apiType,
    endpoints,
  });
});

// Conditionally mount REST routes
if (isRestEnabled()) {
  app.use('/api/auth', authRouter); // Auth routes
  app.use('/api/todos', todosRouter);
  logger.info('REST API enabled', { endpoints: ['/api/auth', '/api/todos'] });
}

// Note: GraphQL routes are mounted in index.ts after HTTP server creation
// This is required for WebSocket support

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
