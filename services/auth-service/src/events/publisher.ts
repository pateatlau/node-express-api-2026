/**
 * Redis Event Publisher
 * Publishes authentication events to Redis pub/sub for cross-service communication
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis publisher client
const publisher = new Redis(REDIS_URL, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 200, 2000);
  },
});

publisher.on('error', (error) => {
  console.error('[REDIS PUBLISHER ERROR]', error);
});

publisher.on('connect', () => {
  console.log('[REDIS PUBLISHER] Connected successfully');
});

/**
 * Publish authentication event to Redis
 */
export async function publishAuthEvent(event: string, data: any): Promise<void> {
  try {
    const channel = `auth:${event}`;
    const payload = JSON.stringify({
      ...data,
      timestamp: Date.now(),
      service: 'auth-service',
    });

    await publisher.publish(channel, payload);
    console.log(`[EVENT PUBLISHED] ${channel}`, data);
  } catch (error) {
    console.error('[EVENT PUBLISH FAILED]', { event, error });
    // Don't throw - event publishing is best-effort
  }
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closePublisher(): Promise<void> {
  await publisher.quit();
}

// Event types for type safety
export const AuthEvents = {
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  SESSION_CREATED: 'session.created',
  SESSION_TERMINATED: 'session.terminated',
  SESSION_DELETED: 'session.deleted',
  SESSIONS_BULK_TERMINATED: 'sessions.bulk_terminated',
  SESSION_ACTIVITY_UPDATED: 'session.activity_updated',
  TOKEN_REFRESHED: 'token.refreshed',
} as const;
