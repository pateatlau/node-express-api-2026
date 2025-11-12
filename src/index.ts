import { createServer } from 'http';
import { env } from './config/env';
import app from './app';
import { DatabaseConnection } from './config/database';
import { isGraphQLEnabled } from './config/apiType';
import { setupGraphQLServer } from './graphql';
import { initializeWebSocket } from './websocket/index.js';
import { startSessionCleanup } from './cron/sessionCleanup.js';
import logger from './config/logger';

const PORT = env.PORT;

// Create HTTP server (needed for GraphQL WebSocket support and Socket.io)
const httpServer = createServer(app);

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
    const io = initializeWebSocket(httpServer);

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
