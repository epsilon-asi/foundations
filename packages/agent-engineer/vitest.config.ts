import { standardDecorators } from '@epsilon-asi/command-line/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite 8 only implements legacy decorators; this plugin transforms
  // TypeScript with esbuild so the standard decorators on the command
  // classes work under vitest.
  plugins: [standardDecorators()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    unstubEnvs: true,
    typecheck: {
      enabled: true,
      include: ['tests/**/*.test-d.ts'],
      tsconfig: './tsconfig.json',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // The bin entrypoint only hands the root command to runMain.
      exclude: ['src/main.ts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
