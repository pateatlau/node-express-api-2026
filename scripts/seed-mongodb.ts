import { faker } from '@faker-js/faker';
import mongoose from 'mongoose';
import { TodoModel } from '../src/models/mongoose/Todo.model';

const MONGODB_URL =
  process.env.MONGODB_URL ||
  'mongodb://todouser:todopassword@localhost:27017/tododb?authSource=admin';

async function seed() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URL);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await TodoModel.deleteMany({});
    console.log('🗑️  Cleared existing todos');

    // Generate 20 sample todos
    const todos = Array.from({ length: 20 }, (_, i) => ({
      title: `${faker.hacker.verb()} ${faker.hacker.noun()}`,
      completed: i % 3 === 0, // Every 3rd todo is completed
    }));

    // Insert todos
    const inserted = await TodoModel.insertMany(todos);
    console.log(`✅ Seeded ${inserted.length} todos`);

    // Display some examples
    console.log('\n📝 Sample todos:');
    inserted.slice(0, 5).forEach((todo) => {
      console.log(`  - [${todo.completed ? '✓' : ' '}] ${todo.title}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
