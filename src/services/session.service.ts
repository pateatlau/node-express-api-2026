/**
 * Session Management Service
 * Handles session timeout, inactivity tracking, and cross-device session management
 */

import { PrismaClient, Session } from '@prisma/client';
import crypto from 'crypto';
import { Server } from 'socket.io';
import logger from '../config/logger.js';
import { broadcastSessionUpdate } from '../websocket/index.js';

const prisma = new PrismaClient();

// Session timeout in milliseconds (default 5 minutes, configurable via env)
const SESSION_TIMEOUT_MINUTES = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '5', 10);
export const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000;

// Session lifetime (default 7 days)
const SESSION_LIFETIME_HOURS = parseFloat(process.env.SESSION_LIFETIME_HOURS || '168');
const SESSION_LIFETIME_MS = SESSION_LIFETIME_HOURS * 60 * 60 * 1000;

// Max sessions per user (default 5)
const MAX_SESSIONS_PER_USER = parseInt(process.env.MAX_SESSIONS_PER_USER || '5', 10);

/**
 * Device info interface
 */
export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  location?: string;
}

/**
 * Session with additional info
 */
export interface SessionWithInfo extends Session {
  isCurrent?: boolean;
}

/**
 * Generate a unique session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  deviceInfo: DeviceInfo,
  ipAddress?: string,
  accessToken?: string,
  io?: Server
): Promise<Session> {
  const sessionToken = accessToken || generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  // Check session limit
  const existingSessions = await prisma.session.count({
    where: { userId },
  });

  // If limit exceeded, delete oldest session
  if (existingSessions >= MAX_SESSIONS_PER_USER) {
    const oldestSession = await prisma.session.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (oldestSession) {
      await prisma.session.delete({
        where: { id: oldestSession.id },
      });

      // Broadcast session update for auto-deleted session
      if (io) {
        try {
          broadcastSessionUpdate(io, userId);
          logger.info('[SESSION AUTO-DELETED - MAX LIMIT]', {
            deletedSessionId: oldestSession.id,
            userId,
          });
        } catch (error) {
          logger.error('[SESSION AUTO-DELETE - BROADCAST FAILED]', {
            error,
            deletedSessionId: oldestSession.id,
            userId,
          });
        }
      }
    }
  }

  // Create new session
  const session = await prisma.session.create({
    data: {
      userId,
      sessionToken,
      deviceInfo: JSON.parse(JSON.stringify(deviceInfo)),
      ipAddress,
      expiresAt,
      lastActivity: new Date(),
    },
  });

  logger.info('[SESSION CREATED]', {
    sessionId: session.id,
    userId,
    willBroadcast: !!io,
  });

  // Broadcast session update to all user's devices
  if (io) {
    try {
      broadcastSessionUpdate(io, userId);
      logger.info('[SESSION CREATED - BROADCAST SENT]', { userId, sessionId: session.id });
    } catch (error) {
      logger.error('[SESSION CREATED - BROADCAST FAILED]', {
        error,
        userId,
        sessionId: session.id,
      });
      // Don't throw - session creation succeeded, broadcast is best-effort
    }
  } else {
    logger.warn('[SESSION CREATED - NO IO, SKIPPING BROADCAST]', { userId, sessionId: session.id });
  }

  return session;
}

/**
 * Get all active sessions for a user
 */
export async function getActiveSessions(
  userId: string,
  currentSessionToken?: string
): Promise<SessionWithInfo[]> {
  const now = new Date();

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      expiresAt: {
        gt: now, // Only non-expired sessions
      },
    },
    orderBy: {
      lastActivity: 'desc',
    },
  });

  // Mark current session
  return sessions.map((session) => ({
    ...session,
    isCurrent: session.sessionToken === currentSessionToken,
  }));
}

/**
 * Terminate a specific session by ID
 */
export async function terminateSession(sessionId: string, io?: Server): Promise<Session | null> {
  try {
    const session = await prisma.session.delete({
      where: { id: sessionId },
    });

    logger.info('[SESSION TERMINATED]', {
      sessionId: session.id,
      userId: session.userId,
      willBroadcast: !!io,
    });

    // Broadcast session update to all user's devices
    if (io && session) {
      try {
        broadcastSessionUpdate(io, session.userId);
        logger.info('[SESSION TERMINATED - BROADCAST SENT]', {
          userId: session.userId,
          sessionId: session.id,
        });
      } catch (error) {
        logger.error('[SESSION TERMINATED - BROADCAST FAILED]', {
          error,
          userId: session.userId,
          sessionId: session.id,
        });
        // Don't throw - session termination succeeded, broadcast is best-effort
      }
    } else {
      logger.warn('[SESSION TERMINATED - NO IO, SKIPPING BROADCAST]', {
        userId: session.userId,
        sessionId: session.id,
      });
    }

    return session;
  } catch (error) {
    logger.error('Failed to terminate session', { error, sessionId });
    return null;
  }
}

/**
 * Terminate all sessions for a user (except optionally one)
 */
export async function terminateAllSessions(
  userId: string,
  exceptSessionToken?: string,
  io?: Server
): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      userId,
      ...(exceptSessionToken && {
        sessionToken: {
          not: exceptSessionToken,
        },
      }),
    },
  });

  // Broadcast session update to all user's devices
  if (io && result.count > 0) {
    try {
      broadcastSessionUpdate(io, userId);
    } catch (error) {
      logger.error('[BULK TERMINATE - BROADCAST FAILED]', {
        error,
        userId,
        count: result.count,
      });
      // Don't throw - sessions terminated, broadcast is best-effort
    }
  }

  return result.count;
}

/**
 * Update session last activity timestamp
 */
export async function updateLastActivity(sessionToken: string): Promise<Session | null> {
  try {
    const session = await prisma.session.update({
      where: { sessionToken },
      data: {
        lastActivity: new Date(),
      },
    });
    return session;
  } catch (error) {
    // Don't log P2025 errors (session not found) - this is expected when session is deleted
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      return null;
    }
    logger.error('Failed to update session activity', { error, sessionToken });
    return null;
  }
}

/**
 * Get session by token
 */
export async function getSessionByToken(sessionToken: string): Promise<Session | null> {
  const session = await prisma.session.findUnique({
    where: { sessionToken },
  });

  // Check if expired
  if (session && session.expiresAt < new Date()) {
    await prisma.session.delete({
      where: { id: session.id },
    });
    return null;
  }

  return session;
}

/**
 * Get session by ID
 */
export async function getSessionById(sessionId: string): Promise<Session | null> {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    // Check if expired
    if (session && session.expiresAt < new Date()) {
      await prisma.session.delete({
        where: { id: session.id },
      });
      return null;
    }

    return session;
  } catch (error) {
    logger.error('Failed to get session by ID', { error, sessionId });
    return null;
  }
}

/**
 * Clean up expired sessions
 * Returns array of expired sessions (for notifying users)
 */
export async function cleanupExpiredSessions(io?: Server): Promise<Session[]> {
  const now = new Date();

  // Find expired sessions
  const expiredSessions = await prisma.session.findMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });

  // Delete expired sessions
  if (expiredSessions.length > 0) {
    await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    // Broadcast session update to all affected users
    if (io) {
      const affectedUsers = new Set(expiredSessions.map((s) => s.userId));
      affectedUsers.forEach((userId) => {
        try {
          broadcastSessionUpdate(io, userId);
        } catch (error) {
          logger.error('[CLEANUP EXPIRED - BROADCAST FAILED]', {
            error,
            userId,
          });
          // Continue with other users
        }
      });
    }
  }

  return expiredSessions;
}

// ===== LEGACY FUNCTIONS (for backward compatibility) =====

/**
 * Check if a user's session has timed out due to inactivity
 * Returns true if session is expired (inactive for more than SESSION_TIMEOUT_MS)
 */
export async function isSessionExpired(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastActivityAt: true },
  });

  if (!user || !user.lastActivityAt) {
    logger.warn('[SESSION CHECK - NO ACTIVITY RECORD]', {
      userId,
      hasUser: !!user,
    });
    return true; // No activity record means session expired
  }

  const now = new Date();
  const timeSinceLastActivity = now.getTime() - user.lastActivityAt.getTime();
  const timeoutMs = SESSION_TIMEOUT_MS;
  const isExpired = timeSinceLastActivity > SESSION_TIMEOUT_MS;

  logger.info('[SESSION CHECK]', {
    userId,
    lastActivityAt: user.lastActivityAt.toISOString(),
    timeSinceLastActivityMs: timeSinceLastActivity,
    timeSinceLastActivitySeconds: Math.floor(timeSinceLastActivity / 1000),
    timeoutMs,
    timeoutMinutes: SESSION_TIMEOUT_MINUTES,
    isExpired,
  });

  return isExpired;
}

/**
 * Get time remaining until session expires (in milliseconds)
 * Returns 0 if session is already expired
 */
export async function getSessionTimeRemaining(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastActivityAt: true },
  });

  if (!user || !user.lastActivityAt) {
    return 0;
  }

  const now = new Date();
  const timeSinceLastActivity = now.getTime() - user.lastActivityAt.getTime();
  const timeRemaining = SESSION_TIMEOUT_MS - timeSinceLastActivity;

  return Math.max(0, timeRemaining);
}

/**
 * Get session timeout information for a user
 */
export async function getSessionInfo(userId: string): Promise<{
  lastActivityAt: Date | null;
  isExpired: boolean;
  timeRemainingMs: number;
  timeoutMs: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastActivityAt: true },
  });

  const lastActivityAt = user?.lastActivityAt || null;
  const isExpired = await isSessionExpired(userId);
  const timeRemainingMs = await getSessionTimeRemaining(userId);

  return {
    lastActivityAt,
    isExpired,
    timeRemainingMs,
    timeoutMs: SESSION_TIMEOUT_MS,
  };
}

/**
 * Convert milliseconds to human-readable format
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}
