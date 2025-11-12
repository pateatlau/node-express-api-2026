import { beforeAll, afterAll } from 'vitest';
import { DatabaseConnection } from '../config/database';

/**
 * Global test setup
 * Runs before all tests in the suite
 */
beforeAll(async () => {
  // Connect to test database
  await DatabaseConnection.connect();
});

/**
 * Global test teardown
 * Runs after all tests in the suite
 */
afterAll(async () => {
  // Disconnect from database
  await DatabaseConnection.disconnect();
});
