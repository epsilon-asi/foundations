import { defineConfig } from 'vitest/config';
import { standardDecorators } from './src/vitest.js';

export default defineConfig({
  // Vite 8 transforms TypeScript with oxc, which only implements legacy
  // decorators. The plugin this package publishes at
  // `@epsilon-asi/command-line/vitest` swaps in esbuild; it is used from
  // source here.
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
      exclude: ['src/**/index.ts'],
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
