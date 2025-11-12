import { MongoClient } from 'mongodb';
import { faker } from '@faker-js/faker';

const MONGODB_URL =
  process.env.MONGODB_URL ||
  'mongodb://todouser:todopassword@localhost:27017/tododb?authSource=admin';
const DB_NAME = 'tododb';
const COLLECTION_NAME = 'todos';

interface Todo {
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

async function initMongoDB() {
  const client = new MongoClient(MONGODB_URL);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Check if collection exists and has data
    const count = await collection.countDocuments();

    if (count > 0) {
      console.log(`ℹ️  Database already has ${count} todo(s), skipping seed`);
      return;
    }

    console.log('🌱 Database is empty, seeding data...');

    // Generate 20 sample todos
    const todos: Todo[] = Array.from({ length: 20 }, () => ({
      title: faker.hacker.phrase(),
      completed: faker.datatype.boolean(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await collection.insertMany(todos);
    console.log(`✅ Seeded ${todos.length} todos`);

    // Show sample todos
    const sampleTodos = todos.slice(0, 5);
    console.log('\n📝 Sample todos:');
    sampleTodos.forEach((todo) => {
      const status = todo.completed ? '✓' : ' ';
      console.log(`  - [${status}] ${todo.title}`);
    });
  } catch (error) {
    console.error('❌ Error initializing MongoDB:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

initMongoDB();
