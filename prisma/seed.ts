import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// MongoDB data to keep consistent between databases
const mongoDbTodos = [
  { title: 'calculate driver', completed: false },
  { title: 'connect alarm', completed: false },
  { title: 'navigate alarm', completed: true },
  { title: 'calculate pixel', completed: false },
  { title: 'index matrix', completed: false },
  { title: 'generate application', completed: true },
  { title: 'navigate firewall', completed: false },
  { title: 'index panel', completed: false },
  { title: 'hack bus', completed: true },
  { title: 'connect panel', completed: false },
  { title: 'parse program', completed: false },
  { title: 'hack bandwidth', completed: true },
  { title: 'program application', completed: false },
  { title: 'synthesize firewall', completed: false },
  { title: 'navigate driver', completed: true },
  { title: 'transmit bandwidth', completed: false },
  { title: 'input hard drive', completed: false },
  { title: 'copy protocol', completed: true },
  { title: 'connect feed', completed: false },
  { title: 'index driver', completed: true },
];

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.todo.deleteMany();
  console.log('🗑️  Cleared existing todos');

  // Insert todos with same data as MongoDB
  const created = await prisma.todo.createMany({
    data: mongoDbTodos,
  });

  console.log(`✅ Created ${created.count} todos`);
  console.log('🌱 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
