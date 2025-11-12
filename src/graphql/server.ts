import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import type { Express } from 'express';
import type { Server as HttpServer } from 'http';
import { json } from 'express';

import { typeDefs } from './schema.js';
import { resolvers } from './resolvers/todo.resolvers.js';
import { createGraphQLContext, createSubscriptionContext } from './context.js';
import type { GraphQLContext } from './context.js';
import { applyAuthDirectives } from './directives.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireProRole } from '../middleware/rbac.middleware.js';
import logger from '../config/logger';

/**
 * Setup GraphQL server with Apollo Server v4
 */
export async function setupGraphQLServer(
  app: Express,
  httpServer: HttpServer
): Promise<ApolloServer<GraphQLContext>> {
  // Create executable schema
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  // Apply authorization directives
  const schemaWithDirectives = applyAuthDirectives(schema);

  // Setup WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Setup subscription handlers
  const serverCleanup = useServer(
    {
      schema: schemaWithDirectives,
      context: async () => {
        return createSubscriptionContext();
      },
      onConnect: () => {
        logger.debug('GraphQL WebSocket client connected');
      },
      onDisconnect: () => {
        logger.debug('GraphQL WebSocket client disconnected');
      },
    },
    wsServer
  );

  // Create Apollo Server
  const apolloServer = new ApolloServer<GraphQLContext>({
    schema: schemaWithDirectives,
    plugins: [
      // Proper shutdown for HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer }),
      // Proper shutdown for WebSocket server
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
    // Enable introspection in development
    introspection: process.env.NODE_ENV !== 'production',
    // Include stack traces in errors during development
    includeStacktraceInErrorResponses: process.env.NODE_ENV !== 'production',
  });

  // Start Apollo Server
  await apolloServer.start();

  // Mount GraphQL middleware
  app.use(
    '/graphql',
    json(),
    authenticate, // Require authentication
    requireProRole, // Require PRO role for GraphQL access
    expressMiddleware(apolloServer, {
      context: async ({ req, res }) => {
        return createGraphQLContext({ req, res });
      },
    })
  );

  logger.info('GraphQL server configured', {
    httpEndpoint: '/graphql',
    wsEndpoint: 'ws://localhost:4000/graphql',
    apolloStudio: 'https://studio.apollographql.com/sandbox/explorer',
  });

  return apolloServer;
}

/**
 * Utility function to format GraphQL endpoint information
 */
export function getGraphQLInfo(port: number = 4000): {
  httpEndpoint: string;
  wsEndpoint: string;
  playgroundUrl: string;
} {
  return {
    httpEndpoint: `http://localhost:${port}/graphql`,
    wsEndpoint: `ws://localhost:${port}/graphql`,
    playgroundUrl: 'https://studio.apollographql.com/sandbox/explorer',
  };
}
