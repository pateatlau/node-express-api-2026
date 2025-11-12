/**
 * Session Cleanup Cron Job
 * Periodically clean up expired sessions and notify users
 */

import cron from 'node-cron';
import { Server } from 'socket.io';
import { cleanupExpiredSessions } from '../services/session.service.js';
import { broadcastForceLogout } from '../websocket/index.js';
import logger from '../config/logger.js';

/**
 * Start session cleanup cron job
 * Runs every 15 minutes
 */
export function startSessionCleanup(io: Server): void {
  // Run every 15 minutes: */15 * * * *
  // For testing, use every minute: * * * * *
  const schedule = process.env.SESSION_CLEANUP_SCHEDULE || '*/15 * * * *';

  cron.schedule(schedule, async () => {
    try {
      logger.info('Running session cleanup job');

      // Clean up expired sessions
      const expiredSessions = await cleanupExpiredSessions();

      if (expiredSessions.length > 0) {
        logger.info('Expired sessions cleaned up', {
          count: expiredSessions.length,
        });

        // Notify users of expired sessions via WebSocket
        const notifiedUsers = new Set<string>();

        expiredSessions.forEach((session) => {
          // Only notify each user once (they may have multiple expired sessions)
          if (!notifiedUsers.has(session.userId)) {
            broadcastForceLogout(io, session.userId, 'session-expired');
            notifiedUsers.add(session.userId);
          }
        });

        logger.info('Force logout notifications sent', {
          usersNotified: notifiedUsers.size,
        });
      } else {
        logger.debug('No expired sessions to clean up');
      }
    } catch (error) {
      logger.error('Session cleanup job failed', { error });
    }
  });

  logger.info('Session cleanup cron job started', {
    schedule,
    description: 'Runs every 15 minutes',
  });
}
