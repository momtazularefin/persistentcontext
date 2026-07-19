import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 600_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
    },
  },
});
