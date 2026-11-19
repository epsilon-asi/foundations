import { standardDecorators } from '@epsilon-asi/command-line/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [standardDecorators()],
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/browser/**'],
    env: { IS_TEST: 'true' },
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.type-test.ts',
        '**/*.test-d.ts',
        'src/type-tests/**',
        '**/examples/**',
      ],
      reporter: ['text', 'lcov'],
    },
  },
});
