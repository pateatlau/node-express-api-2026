/**
 * User Profile Service
 * Business logic for managing user profiles
 */

import { prisma } from '../lib/prisma.js';
import { getCache, setCache, deleteCache } from '../lib/redis.js';
import { UserProfile, Prisma, ActivityType } from '@prisma/client';

const CACHE_PREFIX = 'profile:';

export interface CreateProfileInput {
  userId: string;
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
  company?: string;
  jobTitle?: string;
  twitterHandle?: string;
  githubUsername?: string;
  linkedinUrl?: string;
  isPublic?: boolean;
  showEmail?: boolean;
  showLocation?: boolean;
}

/**
 * Create a new user profile
 */
export async function createProfile(input: CreateProfileInput): Promise<UserProfile> {
  const profile = await prisma.userProfile.create({
    data: {
      userId: input.userId,
      displayName: input.displayName,
      bio: input.bio,
      location: input.location,
      website: input.website,
    },
    include: {
      preferences: true,
    },
  });

  // Create default preferences
  await prisma.userPreferences.create({
    data: {
      profileId: profile.id,
    },
  });

  // Log activity
  await logActivity(profile.id, ActivityType.PROFILE_CREATED, 'Profile created');

  // Cache the new profile
  await setCache(`${CACHE_PREFIX}${profile.userId}`, profile);

  return profile;
}

/**
 * Get profile by user ID
 */
export async function getProfileByUserId(
  userId: string,
  incrementView = false
): Promise<UserProfile | null> {
  // Check cache first
  const cached = await getCache<UserProfile>(`${CACHE_PREFIX}${userId}`);
  if (cached) {
    if (incrementView) {
      // Async increment view count without blocking
      incrementProfileViews(userId).catch(console.error);
    }
    return cached;
  }

  // Fetch from database
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    include: {
      preferences: true,
    },
  });

  if (profile) {
    // Cache the profile
    await setCache(`${CACHE_PREFIX}${userId}`, profile);

    if (incrementView) {
      await incrementProfileViews(userId);
    }
  }

  return profile;
}

/**
 * Get profile by profile ID
 */
export async function getProfileById(profileId: string): Promise<UserProfile | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { id: profileId },
    include: {
      preferences: true,
    },
  });

  return profile;
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<UserProfile> {
  const profile = await prisma.userProfile.update({
    where: { userId },
    data: {
      ...input,
      updatedAt: new Date(),
    },
    include: {
      preferences: true,
    },
  });

  // Invalidate cache
  await deleteCache(`${CACHE_PREFIX}${userId}`);

  // Log activity
  await logActivity(profile.id, ActivityType.PROFILE_UPDATED, 'Profile updated');

  return profile;
}

/**
 * Update avatar URL
 */
export async function updateAvatar(userId: string, avatarUrl: string): Promise<UserProfile> {
  const profile = await prisma.userProfile.update({
    where: { userId },
    data: {
      avatarUrl,
      updatedAt: new Date(),
    },
    include: {
      preferences: true,
    },
  });

  // Invalidate cache
  await deleteCache(`${CACHE_PREFIX}${userId}`);

  // Log activity
  await logActivity(profile.id, ActivityType.AVATAR_CHANGED, 'Avatar updated');

  return profile;
}

/**
 * Update banner URL
 */
export async function updateBanner(userId: string, bannerUrl: string): Promise<UserProfile> {
  const profile = await prisma.userProfile.update({
    where: { userId },
    data: {
      bannerUrl,
      updatedAt: new Date(),
    },
    include: {
      preferences: true,
    },
  });

  // Invalidate cache
  await deleteCache(`${CACHE_PREFIX}${userId}`);

  // Log activity
  await logActivity(profile.id, ActivityType.BANNER_CHANGED, 'Banner updated');

  return profile;
}

/**
 * Delete user profile
 */
export async function deleteProfile(userId: string): Promise<void> {
  await prisma.userProfile.delete({
    where: { userId },
  });

  // Invalidate cache
  await deleteCache(`${CACHE_PREFIX}${userId}`);
}

/**
 * Increment profile view count
 */
async function incrementProfileViews(userId: string): Promise<void> {
  await prisma.userProfile.update({
    where: { userId },
    data: {
      profileViews: { increment: 1 },
      lastViewedAt: new Date(),
    },
  });

  // Invalidate cache after incrementing views
  await deleteCache(`${CACHE_PREFIX}${userId}`);
}

/**
 * Search profiles by display name or bio
 */
export async function searchProfiles(query: string, limit = 20): Promise<UserProfile[]> {
  const profiles = await prisma.userProfile.findMany({
    where: {
      AND: [
        { isPublic: true },
        {
          OR: [
            { displayName: { contains: query, mode: 'insensitive' } },
            { bio: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    },
    take: limit,
    include: {
      preferences: true,
    },
    orderBy: {
      profileViews: 'desc',
    },
  });

  return profiles;
}

/**
 * Get profile activity log
 */
export async function getProfileActivity(userId: string, limit = 50) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new Error('Profile not found');
  }

  const activities = await prisma.profileActivity.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return activities;
}

/**
 * Log profile activity
 */
export async function logActivity(
  profileId: string,
  activityType: ActivityType,
  description: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await prisma.profileActivity.create({
    data: {
      profileId,
      activityType,
      description,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      ipAddress,
      userAgent,
    },
  });
}
