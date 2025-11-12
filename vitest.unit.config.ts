import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // No setup file for unit tests - they should be isolated with mocks
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.{test,spec}.ts'],
    exclude: ['src/__tests__/**', 'src/tests/**', 'node_modules', 'dist'],
  },
});
