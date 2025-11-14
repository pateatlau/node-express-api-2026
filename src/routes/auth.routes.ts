/**
 * Authentication Routes
 * REST API endpoints for user authentication
 */

import { Router, Request, Response } from 'express';
import { signup, login, getUserById, refreshAccessToken } from '../services/auth.service.js';
import {
  getSessionInfo,
  createSession,
  getActiveSessions,
  terminateSession,
  terminateAllSessions,
  getSessionById,
  getSessionByToken,
} from '../services/session.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authLimiter, sessionLogoutLimiter } from '../middleware/rateLimiter.js';
import { signupSchema, loginSchema } from '../schemas/auth.schema.js';
import { verifyRefreshToken, generateTokens } from '../lib/jwt.utils.js';
import { getDeviceInfoFromRequest } from '../lib/deviceInfo.utils.js';
import {
  broadcastForceLogout,
  broadcastSessionUpdate,
  type ForceLogoutData,
} from '../websocket/index.js';
import type { Server } from 'socket.io';
import type { AuthRequest } from '../types/auth.types.js';

const router = Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const validatedData = signupSchema.parse(req.body);

    // Create user
    const result = await signup(validatedData);

    // Generate tokens (need refresh token for cookie)
    const tokens = generateTokens(result.user.id, result.user.email, result.user.role);

    // Get device info from request
    const deviceInfo = getDeviceInfoFromRequest(req);

    // Get Socket.io instance
    const io = req.app.get('io');

    // Create session record
    await createSession(result.user.id, deviceInfo, req.ip, tokens.accessToken, io);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS in production
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
      // Validation or business logic error
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
 * @route   POST /api/auth/login
 * @desc    Login user with email and password
 * @access  Public
 */
router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const validatedData = loginSchema.parse(req.body);

    // Login user
    const result = await login(validatedData);

    // Generate tokens (need refresh token for cookie)
    const tokens = generateTokens(result.user.id, result.user.email, result.user.role);

    // Get device info from request
    const deviceInfo = getDeviceInfoFromRequest(req);

    // Get Socket.io instance
    const io = req.app.get('io');

    // Create session record
    const newSession = await createSession(
      result.user.id,
      deviceInfo,
      req.ip,
      tokens.accessToken,
      io
    );
    console.log('[LOGIN] New session created:', newSession.id, 'for user:', result.user.id);

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
 * @route   POST /api/auth/logout
 * @desc    Logout user (clear refresh token cookie and delete session)
 * @access  Private (requires authentication)
 */
router.post(
  '/logout',
  authenticate,
  sessionLogoutLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Get the session token from Authorization header
      const authHeader = req.headers.authorization;
      console.log('[LOGOUT] Request received');

      // Get Socket.io instance
      const io = req.app.get('io');

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const sessionToken = authHeader.substring(7); // Remove 'Bearer ' prefix
        console.log('[LOGOUT] Session token:', sessionToken.substring(0, 20) + '...');

        // Find and delete the session from database
        const session = await getSessionByToken(sessionToken);
        console.log('[LOGOUT] Session found:', session ? session.id : 'NOT FOUND');

        if (session) {
          await terminateSession(session.id, io);
          console.log(`[LOGOUT] Session deleted successfully: ${session.id}`);
        } else {
          console.log('[LOGOUT] No session found to delete');
        }
      } else {
        console.log('[LOGOUT] No auth header found');
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      console.error('[LOGOUT] Error:', error);
      // Even if session deletion fails, clear cookie and respond successfully
      res.clearCookie('refreshToken');
      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    }
  }
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token from cookie
 * @access  Public (requires refresh token cookie)
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get refresh token from cookie
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
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user info
 * @access  Private (requires authentication)
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

    // Get full user details
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
 * @route   GET /api/auth/session
 * @desc    Get current session status and time remaining
 * @access  Private (requires authentication)
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

    // Get session information
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
 * @route   GET /api/auth/sessions
 * @desc    Get all active sessions for the current user
 * @access  Private (requires authentication)
 * @note    No rate limiting on this endpoint as it's frequently polled by frontend
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

    // Get authorization header to extract current session token
    const authHeader = req.headers.authorization;
    const currentToken = authHeader?.replace('Bearer ', '');

    const sessions = await getActiveSessions(authReq.user.userId, currentToken);

    res.status(200).json({
      success: true,
      data: {
        sessions,
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
 * @route   DELETE /api/auth/sessions/all
 * @desc    Terminate all other sessions (keep current session)
 * @access  Private (requires authentication)
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

      // Get current session token
      const authHeader = req.headers.authorization;
      const currentToken = authHeader?.replace('Bearer ', '');
      console.log('[LOGOUT-ALL] Current token:', currentToken?.substring(0, 30) + '...');

      // Get Socket.io instance
      const io = req.app.get('io');

      // Terminate all sessions except current
      const count = await terminateAllSessions(authReq.user.userId, currentToken, io);
      console.log('[LOGOUT-ALL] Terminated', count, 'sessions');

      // Broadcast force-logout via WebSocket to all user's devices (except current)
      if (io) {
        console.log(
          '[LOGOUT-ALL] Broadcasting with excludeToken:',
          currentToken?.substring(0, 30) + '...'
        );
        broadcastForceLogout(
          io,
          authReq.user.userId,
          'user-initiated',
          'You logged out from all other devices',
          currentToken // Exclude current session from logout
        );

        // Also broadcast session list update to refresh the list
        broadcastSessionUpdate(io, authReq.user.userId);
      }

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
 * @route   DELETE /api/auth/sessions/:id
 * @desc    Terminate a specific session
 * @access  Private (requires authentication)
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

      // Get session BEFORE terminating it (for WebSocket broadcast)
      const session = await getSessionById(id);

      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found',
        });
        return;
      }

      // Terminate the session
      await terminateSession(id);

      // Broadcast force-logout via WebSocket
      const io = req.app.get('io') as Server;
      console.log('[DEBUG] IO object exists:', !!io, 'Session ID:', id);
      if (io) {
        console.log('[DEBUG] Calling broadcastForceLogoutToSession...');
        // Use the session data we got before deletion
        const data: ForceLogoutData = {
          reason: 'remote-logout',
          message: 'This device was logged out remotely',
          timestamp: Date.now(),
          targetSessionId: session.sessionToken,
        };
        io.to(`user:${session.userId}`).emit('force-logout', data);
        console.log('[DEBUG] Broadcast completed to user:', session.userId);

        // Also broadcast session list update to refresh the list on other devices
        broadcastSessionUpdate(io, session.userId);
      } else {
        console.error('[ERROR] IO object not found on app');
      }

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

export default router;
