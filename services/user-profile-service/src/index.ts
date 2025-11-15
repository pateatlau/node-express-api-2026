/**
 * User Profile Microservice - Main Application
 * Express server for managing user profiles, preferences, and avatars
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import profileRoutes from './routes/profile.routes.js';
import { disconnectPrisma } from './lib/prisma.js';
import { disconnectRedis } from './lib/redis.js';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4002;
const SERVICE_NAME = process.env.SERVICE_NAME || 'user-profile-service';

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

// Serve static files from uploads directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.join(__dirname, '..', UPLOAD_DIR)));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Profile routes
app.use('/profile', profileRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: 'The requested resource was not found',
  });
});

// Global error handler
app.use((error: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('❌ Unhandled error:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
  });
});

// Graceful shutdown handlers
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n[${signal}] Shutting down gracefully...`);

  try {
    // Disconnect from databases
    await disconnectPrisma();
    await disconnectRedis();

    console.log(`[${signal}] All connections closed. Exiting...`);
    process.exit(0);
  } catch (error) {
    console.error(`[${signal}] Error during shutdown:`, error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('❌ Unhandled Promise Rejection:', {
    reason,
    timestamp: new Date().toISOString(),
  });
  gracefulShutdown('unhandledRejection');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ${SERVICE_NAME} listening on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
