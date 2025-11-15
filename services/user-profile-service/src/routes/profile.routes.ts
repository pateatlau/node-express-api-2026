/**
 * User Profile Routes
 * API endpoints for profile management
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js';
import { apiLimiter, uploadLimiter } from '../middleware/rateLimiter.js';
import {
  createProfile,
  getProfileByUserId,
  updateProfile,
  updateAvatar,
  updateBanner,
  deleteProfile,
  searchProfiles,
  getProfileActivity,
} from '../services/profile.service.js';
import {
  getPreferencesByUserId,
  updatePreferences,
  resetPreferences,
} from '../services/preferences.service.js';
import { upload, getFileUrl, deleteFile } from '../lib/upload.ts';
import sharp from 'sharp';
import path from 'path';

const router = Router();

/**
 * @route   GET /profile/me
 * @desc    Get current user's profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  apiLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const profile = await getProfileByUserId(req.user!.userId);

      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'Profile not found',
          message: 'Profile does not exist. Create one first.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { profile },
      });
    } catch (error) {
      console.error('[PROFILE ERROR]', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to get profile',
      });
    }
  }
);

/**
 * @route   POST /profile
 * @desc    Create a new profile
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  apiLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { displayName, bio, location, website } = req.body;

      const profile = await createProfile({
        userId: req.user!.userId,
        displayName,
        bio,
        location,
        website,
      });

      res.status(201).json({
        success: true,
        message: 'Profile created successfully',
        data: { profile },
      });
    } catch (error) {
      console.error('[PROFILE ERROR]', error);

      if (error instanceof Error && error.message.includes('Unique constraint')) {
        res.status(409).json({
          success: false,
          error: 'Profile already exists',
          message: 'A profile already exists for this user',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to create profile',
      });
    }
  }
);

/**
 * @route   PUT /profile
 * @desc    Update current user's profile
 * @access  Private
 */
router.put(
  '/',
  authenticate,
  apiLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        displayName,
        bio,
        location,
        website,
        company,
        jobTitle,
        twitterHandle,
        githubUsername,
        linkedinUrl,
        isPublic,
        showEmail,
        showLocation,
      } = req.body;

      const profile = await updateProfile(req.user!.userId, {
        displayName,
        bio,
        location,
        website,
        company,
        jobTitle,
        twitterHandle,
        githubUsername,
        linkedinUrl,
        isPublic,
        showEmail,
        showLocation,
      });

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: { profile },
      });
    } catch (error) {
      console.error('[PROFILE ERROR]', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to update profile',
      });
    }
  }
);

/**
 * @route   DELETE /profile
 * @desc    Delete current user's profile
 * @access  Private
 */
router.delete(
  '/',
  authenticate,
  apiLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await deleteProfile(req.user!.userId);

      res.status(200).json({
        success: true,
        message: 'Profile deleted successfully',
      });
    } catch (error) {
      console.error('[PROFILE ERROR]', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to delete profile',
      });
    }
  }
);

/**
 * @route   GET /profile/search
 * @desc    Search profiles
 * @access  Public
 */
router.get('/search', apiLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, limit } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Invalid query',
        message: 'Query parameter "q" is required',
      });
      return;
    }

    const profiles = await searchProfiles(q, limit ? parseInt(limit as string, 10) : 20);

    res.status(200).json({
      success: true,
      data: {
        profiles,
        count: profiles.length,
      },
    });
  } catch (error) {
    console.error('[PROFILE ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to search profiles',
    });
  }
});

/**
 * @route   GET /profile/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get(
  '/preferences',
  authenticate,
  apiLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const preferences = await getPreferencesByUserId(req.user!.userId);

      res.status(200).json({
        success: true,
        data: { preferences },
      });
    } catch (error) {
      console.error('[PREFERENCES ERROR]', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to get preferences',
      });
    }
  }
);

/**
 * @route   PUT /profile/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put(
  '/preferences',
  authenticate,
  apiLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const preferences = await updatePreferences(req.user!.userId, req.body);

      res.status(200).json({
        success: true,
        message: 'Preferences updated successfully',
        data: { preferences },
      });
    } catch (error) {
      console.error('[PREFERENCES ERROR]', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to update preferences',
      });
    }
  }
);

/**
 * @route   POST /profile/preferences/reset
 * @desc    Reset preferences to defaults
 * @access  Private
 */
router.post(
  '/preferences/reset',
  authenticate,
  apiLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const preferences = await resetPreferences(req.user!.userId);

      res.status(200).json({
        success: true,
        message: 'Preferences reset successfully',
        data: { preferences },
      });
    } catch (error) {
      console.error('[PREFERENCES ERROR]', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to reset preferences',
      });
    }
  }
);

/**
 * @route   POST /profile/avatar
 * @desc    Upload profile avatar
 * @access  Private
 */
router.post(
  '/avatar',
  authenticate,
  uploadLimiter,
  upload.single('avatar'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file provided',
          message: 'Please provide an avatar file',
        });
        return;
      }

      // Process image with sharp (resize to 256x256)
      const filename = `avatar-${req.user!.userId}-${Date.now()}.webp`;
      const outputPath = path.join(process.env.UPLOAD_DIR || './uploads', filename);

      await sharp(req.file.path)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 90 })
        .toFile(outputPath);

      // Delete original file
      deleteFile(req.file.filename);

      // Update profile with new avatar URL
      const avatarUrl = getFileUrl(filename);
      const profile = await updateAvatar(req.user!.userId, avatarUrl);

      res.status(200).json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: {
          profile,
          avatarUrl,
        },
      });
    } catch (error) {
      console.error('[AVATAR UPLOAD ERROR]', error);
      res.status(500).json({
        success: false,
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Failed to upload avatar',
      });
    }
  }
);

/**
 * @route   POST /profile/banner
 * @desc    Upload profile banner
 * @access  Private
 */
router.post(
  '/banner',
  authenticate,
  uploadLimiter,
  upload.single('banner'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file provided',
          message: 'Please provide a banner file',
        });
        return;
      }

      // Process image with sharp (resize to 1500x500)
      const filename = `banner-${req.user!.userId}-${Date.now()}.webp`;
      const outputPath = path.join(process.env.UPLOAD_DIR || './uploads', filename);

      await sharp(req.file.path)
        .resize(1500, 500, { fit: 'cover' })
        .webp({ quality: 90 })
        .toFile(outputPath);

      // Delete original file
      deleteFile(req.file.filename);

      // Update profile with new banner URL
      const bannerUrl = getFileUrl(filename);
      const profile = await updateBanner(req.user!.userId, bannerUrl);

      res.status(200).json({
        success: true,
        message: 'Banner uploaded successfully',
        data: {
          profile,
          bannerUrl,
        },
      });
    } catch (error) {
      console.error('[BANNER UPLOAD ERROR]', error);
      res.status(500).json({
        success: false,
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Failed to upload banner',
      });
    }
  }
);

/**
 * @route   GET /profile/activity
 * @desc    Get profile activity log
 * @access  Private
 */
router.get(
  '/activity',
  authenticate,
  apiLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { limit } = req.query;
      const activities = await getProfileActivity(
        req.user!.userId,
        limit ? parseInt(limit as string, 10) : 50
      );

      res.status(200).json({
        success: true,
        data: {
          activities,
          count: activities.length,
        },
      });
    } catch (error) {
      console.error('[ACTIVITY ERROR]', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Failed to get activity log',
      });
    }
  }
);

/**
 * @route   GET /profile/:userId
 * @desc    Get profile by user ID
 * @access  Public
 */
router.get('/:userId', apiLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const profile = await getProfileByUserId(userId, true); // Increment view count

    if (!profile) {
      res.status(404).json({
        success: false,
        error: 'Profile not found',
        message: 'Profile does not exist',
      });
      return;
    }

    // Filter out private information if profile is not public
    if (!profile.isPublic) {
      res.status(403).json({
        success: false,
        error: 'Profile is private',
        message: 'This profile is not publicly accessible',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { profile },
    });
  } catch (error) {
    console.error('[PROFILE ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to get profile',
    });
  }
});

export default router;
