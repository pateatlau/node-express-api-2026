/**
 * WebSocket Server
 * Handles real-time cross-device authentication synchronization
 */

import { Server, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { verifyAccessToken } from '../lib/jwt.utils.js';
import { updateLastActivity, getSessionById } from '../services/session.service.js';
import logger from '../config/logger.js';
import {
  updateWebsocketConnections,
  recordWebsocketMessage,
  websocketErrors,
  recordRedisCommand,
} from '../lib/metrics';

// Extend Socket type with custom properties
interface AuthSocket extends Socket {
  userId?: string;
  sessionToken?: string;
  sessionId?: string;
}

// Force logout event data
export interface ForceLogoutData {
  reason: 'user-initiated' | 'remote-logout' | 'session-expired' | 'security';
  message: string;
  timestamp: number;
  targetSessionId?: string; // Optional: specific session to target
  excludeSessionToken?: string; // Optional: session to exclude from logout
}

/**
 * Initialize WebSocket server
 */
export async function initializeWebSocket(httpServer: HTTPServer): Promise<Server> {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    transports: ['websocket', 'polling'],
  });

  // Setup Redis adapter for cross-instance communication
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const start = Date.now();
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);
      recordRedisCommand('connect', (Date.now() - start) / 1000, true);

      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter initialized', { redisUrl });
    } catch (error) {
      recordRedisCommand('connect', 0, false);
      logger.error('Failed to initialize Redis adapter', { error, redisUrl });
      logger.warn(
        'Socket.IO running without Redis adapter - WebSocket broadcasts limited to single instance'
      );
    }
  } else {
    logger.warn('REDIS_URL not configured - WebSocket broadcasts limited to single instance');
  }

  // Authentication middleware
  io.use(async (socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        logger.warn('WebSocket connection attempt without token');
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = verifyAccessToken(token);

      if (!decoded || !decoded.userId) {
        logger.warn('WebSocket connection with invalid token');
        return next(new Error('Invalid authentication token'));
      }

      // Attach user info to socket
      socket.userId = decoded.userId;
      socket.sessionToken = token;

      logger.info('WebSocket authentication successful', {
        userId: decoded.userId,
        socketId: socket.id,
      });

      next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('WebSocket authentication failed', {
        error: errorMessage,
        hasToken: !!socket.handshake.auth.token,
      });
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.userId!;
    const sessionToken = socket.sessionToken!;

    // Track connection
    updateWebsocketConnections(1);

    logger.info('WebSocket client connected', {
      userId,
      socketId: socket.id,
    });

    // Join user-specific room (for broadcasting to all user's devices)
    socket.join(`user:${userId}`);

    // Update session activity on connection
    updateLastActivity(sessionToken).catch((error) => {
      logger.error('Failed to update session activity on connection', { error });
    });

    // Handle heartbeat (ping)
    socket.on('ping', () => {
      recordWebsocketMessage('ping', 'received');
      socket.emit('pong');
      recordWebsocketMessage('pong', 'sent');

      // Update session activity
      updateLastActivity(sessionToken).catch((error) => {
        logger.error('Failed to update session activity on ping', { error });
      });
    });

    // Handle manual logout all devices
    socket.on('logout-all-devices', () => {
      recordWebsocketMessage('logout-all-devices', 'received');
      logger.info('Logout all devices requested', { userId });

      // Broadcast to all user's connected devices
      io.to(`user:${userId}`).emit('force-logout', {
        reason: 'user-initiated',
        message: 'You logged out from all devices',
        timestamp: Date.now(),
      } as ForceLogoutData);
      recordWebsocketMessage('force-logout', 'sent');
    });

    // Handle manual logout specific device
    socket.on('logout-device', async (sessionId: string) => {
      recordWebsocketMessage('logout-device', 'received');
      logger.info('Logout specific device requested', { userId, sessionId });

      // Get session to find which user it belongs to
      const session = await getSessionById(sessionId);

      if (session) {
        // Broadcast to all user's devices with target session ID
        // Clients will check if targetSessionId matches their session
        io.to(`user:${session.userId}`).emit('force-logout', {
          reason: 'remote-logout',
          message: 'This device was logged out remotely',
          timestamp: Date.now(),
          targetSessionId: sessionId,
        } as ForceLogoutData);
        recordWebsocketMessage('force-logout', 'sent');

        logger.info('Force logout broadcast sent for specific session', {
          userId: session.userId,
          sessionId,
        });
      } else {
        logger.warn('Session not found for logout-device', { sessionId });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      updateWebsocketConnections(-1);
      logger.info('WebSocket client disconnected', {
        userId,
        socketId: socket.id,
        reason,
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      websocketErrors.labels({ error_type: 'socket_error' }).inc();
      logger.error('WebSocket error', {
        userId,
        socketId: socket.id,
        error,
      });
    });
  });

  logger.info('WebSocket server initialized');

  return io;
}

/**
 * Broadcast force logout to all user's devices
 */
export function broadcastForceLogout(
  io: Server,
  userId: string,
  reason: ForceLogoutData['reason'],
  message?: string,
  excludeSessionToken?: string
): void {
  const data: ForceLogoutData = {
    reason,
    message: message || getDefaultLogoutMessage(reason),
    timestamp: Date.now(),
    excludeSessionToken, // Frontend will ignore logout if this matches their token
  };

  io.to(`user:${userId}`).emit('force-logout', data);

  logger.info('Force logout broadcast sent', {
    userId,
    reason,
    excludeSessionToken: excludeSessionToken ? 'present' : 'none',
  });
}

/**
 * Broadcast force logout to specific session
 */
export async function broadcastForceLogoutToSession(
  io: Server,
  sessionId: string,
  reason: ForceLogoutData['reason'],
  message?: string
): Promise<void> {
  // Get session to find which user it belongs to
  const session = await getSessionById(sessionId);

  if (!session) {
    logger.warn('Session not found for broadcast', { sessionId });
    return;
  }

  const data: ForceLogoutData = {
    reason,
    message: message || getDefaultLogoutMessage(reason),
    timestamp: Date.now(),
    targetSessionId: session.sessionToken, // Use sessionToken (which is the access token)
  };

  // Broadcast to all user's devices with target session ID
  io.to(`user:${session.userId}`).emit('force-logout', data);

  logger.info('Force logout broadcast sent to session', {
    userId: session.userId,
    sessionId,
    reason,
  });
}

/**
 * Get default logout message for reason
 */
function getDefaultLogoutMessage(reason: ForceLogoutData['reason']): string {
  const messages = {
    'user-initiated': 'You logged out from another device',
    'remote-logout': 'This device was logged out remotely',
    'session-expired': 'Your session expired',
    security: 'Logged out for security reasons',
  };

  return messages[reason];
}

/**
 * Broadcast session list update to all user's devices
 * Use this when a new session is created or a session is deleted
 */
export async function broadcastSessionUpdate(io: Server, userId: string): Promise<void> {
  const room = `user:${userId}`;
  const socketsInRoom = await io.in(room).fetchSockets();

  logger.info('Broadcasting session update', {
    userId,
    room,
    connectedClients: socketsInRoom.length,
    timestamp: Date.now(),
  });

  io.to(room).emit('session-update', {
    timestamp: Date.now(),
  });

  logger.info('Session update broadcast sent', { userId, connectedClients: socketsInRoom.length });
}
