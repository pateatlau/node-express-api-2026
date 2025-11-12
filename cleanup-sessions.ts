import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupSessions() {
  try {
    const result = await prisma.session.deleteMany();
    console.log(`✅ Deleted ${result.count} sessions`);
  } catch (error) {
    console.error('❌ Error deleting sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupSessions();
