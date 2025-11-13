import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing Prisma connection...');
    const count = await prisma.session.count();
    console.log('Success! Session count:', count);

    const sessions = await prisma.session.findMany({
      take: 5,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });
    console.log('Sessions:', JSON.stringify(sessions, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
