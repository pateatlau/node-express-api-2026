/**
 * Redis Client for Caching User Profiles
 */

import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const ENABLE_CACHE = process.env.ENABLE_CACHE === 'true';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL = parseInt(process.env.REDIS_CACHE_TTL || '3600', 10);

let redis: Redis | null = null;

if (ENABLE_CACHE) {
  redis = new Redis(REDIS_URL, {
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  redis.on('connect', () => {
    console.log('[REDIS] Connected successfully');
  });

  redis.on('error', (err) => {
    console.error('[REDIS] Connection error:', err);
  });
}

/**
 * Get cached data
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis || !ENABLE_CACHE) return null;

  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`[REDIS] Error getting cache for key ${key}:`, error);
    return null;
  }
}

/**
 * Set cached data
 */
export async function setCache(
  key: string,
  value: unknown,
  ttl: number = CACHE_TTL
): Promise<void> {
  if (!redis || !ENABLE_CACHE) return;

  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error(`[REDIS] Error setting cache for key ${key}:`, error);
  }
}

/**
 * Delete cached data
 */
export async function deleteCache(key: string): Promise<void> {
  if (!redis || !ENABLE_CACHE) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.error(`[REDIS] Error deleting cache for key ${key}:`, error);
  }
}

/**
 * Delete multiple cache keys matching a pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  if (!redis || !ENABLE_CACHE) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error(`[REDIS] Error deleting cache pattern ${pattern}:`, error);
  }
}

/**
 * Disconnect Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    console.log('[REDIS] Disconnected successfully');
  }
}

export { redis, CACHE_TTL };
