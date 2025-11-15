/**
 * Auth Microservice - Main Application
 * Express server for authentication and session management
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import { register } from './lib/metrics.js';
import { cleanupExpiredSessions } from './services/session.service.js';
import { closePublisher } from './events/publisher.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { disconnectPrisma } from './lib/prisma.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;
const SERVICE_NAME = process.env.SERVICE_NAME || 'auth-service';

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging middleware (for debugging)
app.use((req: Request, _res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Metrics endpoint
app.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error);
  }
});

// Auth routes
app.use('/', authRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Cleanup expired sessions every hour (using recursive setTimeout to prevent overlap)
let cleanupInProgress = false;

async function scheduleCleanup() {
  if (cleanupInProgress) {
    console.warn('[CLEANUP] Previous cleanup still in progress, skipping...');
    setTimeout(scheduleCleanup, 60 * 60 * 1000);
    return;
  }

  try {
    cleanupInProgress = true;
    console.log('[CLEANUP] Starting expired session cleanup...');
    const deletedCount = await cleanupExpiredSessions();
    console.log(`[CLEANUP] Completed. Deleted ${deletedCount} sessions.`);
  } catch (error) {
    console.error('[CLEANUP] Error during cleanup:', error);
  } finally {
    cleanupInProgress = false;
    // Schedule next cleanup after current one completes
    setTimeout(scheduleCleanup, 60 * 60 * 1000);
  }
}

// Start cleanup loop
scheduleCleanup();

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
  console.error('❌ Unhandled Promise Rejection:', {
    reason,
    timestamp: new Date().toISOString(),
  });
  // Don't exit immediately - let current requests finish
});

// Uncaught exception handler
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  // Uncaught exceptions are serious - exit after cleanup
  Promise.all([closePublisher(), disconnectPrisma()]).finally(() => process.exit(1));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[SIGTERM] Shutting down gracefully...');
  await Promise.all([closePublisher(), disconnectPrisma()]);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[SIGINT] Shutting down gracefully...');
  await Promise.all([closePublisher(), disconnectPrisma()]);
  process.exit(0);
});

// Validate critical environment variables in production
if (process.env.NODE_ENV === 'production') {
  const secrets = [
    { name: 'JWT_ACCESS_SECRET', value: process.env.JWT_ACCESS_SECRET },
    { name: 'JWT_REFRESH_SECRET', value: process.env.JWT_REFRESH_SECRET },
  ];

  secrets.forEach(({ name, value }) => {
    if (!value || value.includes('change') || value.includes('your-') || value.includes('secret')) {
      console.error(`❌ SECURITY ERROR: ${name} not properly configured for production!`);
      process.exit(1);
    }
    if (value.length < 32) {
      console.error(`❌ SECURITY ERROR: ${name} too short (minimum 32 characters required)`);
      process.exit(1);
    }
  });
  console.log('✅ Security validation passed');
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ${SERVICE_NAME} listening on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
