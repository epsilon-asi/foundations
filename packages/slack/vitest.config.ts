import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts', 'src/types/**/*.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        lines: 80,
        functions: 80
      }
    }
  }
});
