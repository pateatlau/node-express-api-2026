/**
 * Authentication Routes for Auth Microservice
 * REST API endpoints for user authentication and session management
 */

import { Router, Request, Response } from 'express';
import { signup, login, getUserById, refreshAccessToken } from '../services/auth.service.js';
import { SESSION_TIMEOUT_MS } from '../services/session.service.js';
import {
  getSessionInfo,
  createSession,
  getActiveSessions,
  terminateSession,
  terminateAllSessions,
  getSessionById,
  updateLastActivity,
} from '../services/session.service.js';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';
import { authLimiter, sessionLogoutLimiter } from '../middleware/rateLimiter.js';
import { signupSchema, loginSchema } from '../schemas/auth.schema.js';
import { verifyRefreshToken, generateTokens, verifyAccessToken } from '../lib/jwt.utils.js';
import { getDeviceInfoFromRequest } from '../lib/deviceInfo.utils.js';
import { publishAuthEvent, AuthEvents } from '../events/publisher.js';

const router = Router();

/**
 * @route   GET /config
 * @desc    Get public auth configuration (session timeout, etc.)
 * @access  Public
 */
router.get('/config', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      data: {
        sessionTimeoutMs: SESSION_TIMEOUT_MS,
        sessionTimeoutMinutes: Math.floor(SESSION_TIMEOUT_MS / 60000),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get config',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const validatedData = signupSchema.parse(req.body);

    // Create user
    const result = await signup(validatedData);

    // Get device info from request
    const deviceInfo = getDeviceInfoFromRequest(req);

    // Create session record (session token is auto-generated, not using JWT)
    const session = await createSession(result.user.id, deviceInfo, req.ip);

    // Generate tokens with sessionId
    const tokens = generateTokens(result.user.id, result.user.email, result.user.role, session.id);

    // Publish user registered event
    await publishAuthEvent(AuthEvents.USER_REGISTERED, {
      userId: result.user.id,
      email: result.user.email,
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: result.user,
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('already exists') ||
        error.message.includes('Invalid') ||
        error.message.includes('must be')
      ) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to register user',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /login
 * @desc    Login user with email and password
 * @access  Public
 */
router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const validatedData = loginSchema.parse(req.body);

    // Login user
    const result = await login(validatedData);

    // Get device info from request
    const deviceInfo = getDeviceInfoFromRequest(req);

    // Create session record (session token is auto-generated, not using JWT)
    const newSession = await createSession(result.user.id, deviceInfo, req.ip);

    // Generate tokens with sessionId
    const tokens = generateTokens(
      result.user.id,
      result.user.email,
      result.user.role,
      newSession.id
    );

    console.log('[LOGIN] New session created:', newSession.id, 'for user:', result.user.id);

    // Publish user login event
    await publishAuthEvent(AuthEvents.USER_LOGIN, {
      userId: result.user.id,
      sessionId: newSession.id,
    });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid')) {
      res.status(401).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   POST /logout
 * @desc    Logout user (clear refresh token cookie and delete session)
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  sessionLogoutLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      console.log('[LOGOUT] Request received');

      if (authHeader && authHeader.startsWith('Bearer ')) {
        // Extract JWT and get sessionId from payload
        const token = authHeader.substring(7);
        const decoded = verifyAccessToken(token);

        console.log('[LOGOUT] Session ID from JWT:', decoded.sessionId);

        // Use sessionId from JWT to find and delete session
        if (decoded.sessionId) {
          const session = await getSessionById(decoded.sessionId);
          console.log('[LOGOUT] Session found:', session ? session.id : 'NOT FOUND');

          if (session) {
            await terminateSession(session.id);
            console.log(`[LOGOUT] Session deleted successfully: ${session.id}`);

            // Publish logout event
            await publishAuthEvent(AuthEvents.USER_LOGOUT, {
              userId: session.userId,
              sessionId: session.id,
            });
          }
        }
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      console.error('[LOGOUT] Error:', error);
      res.clearCookie('refreshToken');
      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    }
  }
);

/**
 * @route   POST /refresh
 * @desc    Refresh access token using refresh token from cookie
 * @access  Public
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        message: 'No refresh token provided',
      });
      return;
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Generate new access token
    const accessToken = await refreshAccessToken(decoded.userId);

    // Publish token refreshed event
    await publishAuthEvent(AuthEvents.TOKEN_REFRESHED, {
      userId: decoded.userId,
    });

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : 'Invalid refresh token',
    });
  }
});

/**
 * @route   GET /me
 * @desc    Get current authenticated user info
 * @access  Private
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const user = await getUserById(authReq.user.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user info',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /session
 * @desc    Get current session status and time remaining
 * @access  Private
 */
router.get('/session', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const sessionInfo = await getSessionInfo(authReq.user.userId);

    res.status(200).json({
      success: true,
      data: {
        session: {
          lastActivityAt: sessionInfo.lastActivityAt,
          isExpired: sessionInfo.isExpired,
          timeRemainingMs: sessionInfo.timeRemainingMs,
          timeoutMs: sessionInfo.timeoutMs,
          timeRemainingMinutes: Math.floor(sessionInfo.timeRemainingMs / 60000),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get session info',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   GET /sessions
 * @desc    Get all active sessions for the current user
 * @access  Private
 */
router.get('/sessions', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const authHeader = req.headers.authorization;

    // Get sessionId from JWT to identify current session
    let currentSessionId: string | undefined;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const decoded = verifyAccessToken(token);
        currentSessionId = decoded.sessionId;
      } catch {
        // If JWT verification fails, continue without current session marker
      }
    }

    // Get all active sessions for user
    const sessions = await getActiveSessions(authReq.user.userId);

    // Mark current session
    const sessionsWithCurrent = sessions.map((session) => ({
      ...session,
      isCurrent: currentSessionId ? session.id === currentSessionId : false,
    }));

    res.status(200).json({
      success: true,
      data: {
        sessions: sessionsWithCurrent,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get sessions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route   DELETE /sessions/all
 * @desc    Terminate all other sessions (keep current session)
 * @access  Private
 */
router.delete(
  '/sessions/all',
  authenticate,
  sessionLogoutLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;

      if (!authReq.user) {
        res.status(401).json({
          success: false,
          message: 'Not authenticated',
        });
        return;
      }

      const authHeader = req.headers.authorization;
      const currentToken = authHeader?.replace('Bearer ', '');

      const count = await terminateAllSessions(authReq.user.userId, currentToken);

      res.status(200).json({
        success: true,
        message: `${count} session(s) terminated successfully`,
        data: {
          count,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to terminate sessions',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   DELETE /sessions/:id
 * @desc    Terminate a specific session
 * @access  Private
 */
router.delete(
  '/sessions/:id',
  authenticate,
  sessionLogoutLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;

      if (!authReq.user) {
        res.status(401).json({
          success: false,
          message: 'Not authenticated',
        });
        return;
      }

      const { id } = req.params;

      const session = await getSessionById(id);

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found',
        });
        return;
      }

      // Verify session belongs to authenticated user
      if (session.userId !== authReq.user.userId) {
        res.status(403).json({
          success: false,
          message: "Access denied: Cannot delete another user's session",
        });
        return;
      }

      await terminateSession(id);

      res.status(200).json({
        success: true,
        message: 'Session terminated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to terminate session',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   POST /activity
 * @desc    Update last activity timestamp
 * @access  Private
 */
router.post('/activity', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'Authorization header missing',
      });
      return;
    }

    // Extract JWT and get sessionId from payload
    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    // Update session activity using sessionId from JWT
    if (decoded.sessionId) {
      const session = await getSessionById(decoded.sessionId);
      if (session) {
        await updateLastActivity(session.sessionToken);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Activity updated',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update activity',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
