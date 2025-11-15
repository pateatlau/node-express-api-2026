/**
 * Prisma Client Singleton for User Profile Service
 * Ensures single database connection across the application
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnect Prisma on shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('[PRISMA] Disconnected successfully');
  } catch (error) {
    console.error('[PRISMA] Error during disconnect:', error);
    throw error;
  }
}
