import { createServer } from 'http';
import { env } from './config/env';
import app from './app';
import { DatabaseConnection } from './config/database';
import { isGraphQLEnabled } from './config/apiType';
import { setupGraphQLServer } from './graphql';
import { initializeWebSocket } from './websocket/index.js';
import { startSessionCleanup } from './cron/sessionCleanup.js';
import logger from './config/logger';
import { recordSystemError, uncaughtExceptions, unhandledRejections } from './lib/metrics';

const PORT = env.PORT;

// Create HTTP server (needed for GraphQL WebSocket support and Socket.io)
const httpServer = createServer(app);

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  recordSystemError('uncaught_exception', 'critical');
  uncaughtExceptions.inc();
  // Give time for metrics to be scraped before exit
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled rejection', { reason, promise });
  recordSystemError('unhandled_rejection', 'error');
  unhandledRejections.inc();
});

// Handle graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  await DatabaseConnection.disconnect();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server and connect to database
const startServer = async () => {
  try {
    // Connect to database first
    await DatabaseConnection.connect();

    // Setup GraphQL if enabled
    if (isGraphQLEnabled()) {
      await setupGraphQLServer(app, httpServer);
      logger.info('GraphQL API enabled', { endpoint: '/graphql' });
    }

    // Initialize WebSocket server
    const io = await initializeWebSocket(httpServer);

    // Make io instance available to routes
    app.set('io', io);

    logger.info('WebSocket server initialized');

    // Start session cleanup cron job
    startSessionCleanup(io);

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        databaseType: DatabaseConnection.getType(),
        apiType: env.API_TYPE,
        nodeEnv: env.NODE_ENV,
        websocket: 'enabled',
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();
