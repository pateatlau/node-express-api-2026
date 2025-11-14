import { prisma } from './src/lib/prisma';

async function main() {
  await prisma.todo.deleteMany({});
  console.log('All todos deleted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
