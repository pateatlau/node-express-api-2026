/**
 * User Preferences Service
 * Business logic for managing user preferences and settings
 */

import { prisma } from '../lib/prisma.js';
import { deleteCache } from '../lib/redis.js';
import { logActivity } from './profile.service.js';

const CACHE_PREFIX = 'profile:';

export interface UpdatePreferencesInput {
  theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
  language?: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: 'HOURS_12' | 'HOURS_24';
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  desktopNotifications?: boolean;
  weeklyDigest?: boolean;
  showTutorials?: boolean;
  enableAnimations?: boolean;
  compactView?: boolean;
  allowAnalytics?: boolean;
  allowMarketing?: boolean;
}

/**
 * Get user preferences by user ID
 */
export async function getPreferencesByUserId(userId: string) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    include: { preferences: true },
  });

  if (!profile) {
    throw new Error('Profile not found');
  }

  return profile.preferences;
}

/**
 * Update user preferences
 */
export async function updatePreferences(userId: string, input: UpdatePreferencesInput) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new Error('Profile not found');
  }

  const preferences = await prisma.userPreferences.upsert({
    where: { profileId: profile.id },
    create: {
      profileId: profile.id,
      ...input,
    },
    update: {
      ...input,
      updatedAt: new Date(),
    },
  });

  // Invalidate profile cache
  await deleteCache(`${CACHE_PREFIX}${userId}`);

  // Log activity
  await logActivity(profile.id, 'PREFERENCES_UPDATED' as any, 'Preferences updated', input);

  return preferences;
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences(userId: string) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new Error('Profile not found');
  }

  const preferences = await prisma.userPreferences.update({
    where: { profileId: profile.id },
    data: {
      theme: 'SYSTEM',
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: 'HOURS_12',
      emailNotifications: true,
      pushNotifications: true,
      desktopNotifications: false,
      weeklyDigest: true,
      showTutorials: true,
      enableAnimations: true,
      compactView: false,
      allowAnalytics: true,
      allowMarketing: false,
      updatedAt: new Date(),
    },
  });

  // Invalidate cache
  await deleteCache(`${CACHE_PREFIX}${userId}`);

  return preferences;
}
