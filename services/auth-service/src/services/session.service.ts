/**
 * Session Management Service for Auth Microservice
 * Handles session timeout, inactivity tracking, and cross-device session management
 */

import { Session } from '@prisma/client';
import crypto from 'crypto';
import { publishAuthEvent } from '../events/publisher.js';
import { prisma } from '../lib/prisma.js';

// Session timeout in milliseconds (default 5 minutes, configurable via env)
const SESSION_TIMEOUT_MINUTES = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '5', 10);
export const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000;

// Session lifetime (default 7 days)
const SESSION_LIFETIME_HOURS = parseFloat(process.env.SESSION_LIFETIME_HOURS || '168');
const SESSION_LIFETIME_MS = SESSION_LIFETIME_HOURS * 60 * 60 * 1000;

// Max sessions per user (default 5)
const MAX_SESSIONS_PER_USER = parseInt(process.env.MAX_SESSIONS_PER_USER || '5', 10);

export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  deviceType?: string;
  userAgent?: string;
}

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
 * SECURITY: Always generates unique session token (never reuse JWT access tokens)
 */
export async function createSession(
  userId: string,
  deviceInfo: DeviceInfo,
  ipAddress?: string
): Promise<Session> {
  // Always generate unique session token
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  // Use transaction to prevent race condition on session limit
  const session = await prisma.$transaction(async (tx) => {
    // Check session limit
    const existingSessions = await tx.session.count({
      where: { userId },
    });

    // If limit exceeded, delete oldest session
    if (existingSessions >= MAX_SESSIONS_PER_USER) {
      const oldestSession = await tx.session.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      if (oldestSession) {
        await tx.session.delete({
          where: { id: oldestSession.id },
        });

        // Publish session update event (outside transaction is fine)
        await publishAuthEvent('session.deleted', {
          userId,
          sessionId: oldestSession.id,
          reason: 'max_limit_exceeded',
        });
      }
    }

    // Create new session
    return await tx.session.create({
      data: {
        userId,
        sessionToken,
        deviceInfo: JSON.parse(JSON.stringify(deviceInfo)),
        ipAddress,
        expiresAt,
        lastActivity: new Date(),
      },
    });
  });

  // Publish session created event
  await publishAuthEvent('session.created', {
    userId,
    sessionId: session.id,
    deviceInfo,
  });

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
        gt: now,
      },
    },
    orderBy: {
      lastActivity: 'desc',
    },
  });

  return sessions.map((session) => ({
    ...session,
    isCurrent: session.sessionToken === currentSessionToken,
  }));
}

/**
 * Terminate a specific session by ID
 */
export async function terminateSession(sessionId: string): Promise<Session | null> {
  try {
    const session = await prisma.session.delete({
      where: { id: sessionId },
    });

    // Publish session terminated event
    await publishAuthEvent('session.terminated', {
      userId: session.userId,
      sessionId: session.id,
      targetSessionToken: session.sessionToken,
    });

    return session;
  } catch (error) {
    console.error('Failed to terminate session:', error);
    return null;
  }
}

/**
 * Terminate all sessions for a user (except optionally one)
 */
export async function terminateAllSessions(
  userId: string,
  exceptSessionToken?: string
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

  // Publish bulk termination event
  await publishAuthEvent('sessions.bulk_terminated', {
    userId,
    count: result.count,
    exceptSessionToken,
  });

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

    // Publish activity update event
    await publishAuthEvent('session.activity_updated', {
      userId: session.userId,
      sessionId: session.id,
    });

    return session;
  } catch (error) {
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
    return null;
  }
}

/**
 * Get session info (for timeout tracking)
 */
export async function getSessionInfo(userId: string) {
  const session = await prisma.session.findFirst({
    where: { userId },
    orderBy: { lastActivity: 'desc' },
  });

  if (!session) {
    throw new Error('No active session found');
  }

  const now = new Date().getTime();
  const lastActivityMs = session.lastActivity.getTime();
  const timeElapsed = now - lastActivityMs;
  const timeRemaining = Math.max(0, SESSION_TIMEOUT_MS - timeElapsed);
  const isExpired = timeRemaining === 0;

  // ENFORCE timeout by deleting expired session
  if (isExpired) {
    await prisma.session.delete({ where: { id: session.id } });
    await publishAuthEvent('session.terminated', {
      userId: session.userId,
      sessionId: session.id,
      reason: 'inactivity_timeout',
    });
    throw new Error('Session expired due to inactivity');
  }

  return {
    lastActivityAt: session.lastActivity,
    isExpired: false,
    timeRemainingMs: timeRemaining,
    timeoutMs: SESSION_TIMEOUT_MS,
  };
}

/**
 * Clean up expired sessions (can be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date();

  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });

  if (result.count > 0) {
    console.log(`[SESSION CLEANUP] Deleted ${result.count} expired sessions`);
  }

  return result.count;
}
