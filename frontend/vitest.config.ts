import { defineConfig } from 'vitest/config';

// Mapper tests are pure node-level logic (no React/DOM): the same backend payload fixtures
// that guard the reference page are mapped to view models and asserted.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
