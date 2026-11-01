import { transform } from 'esbuild';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      // Vite 8 transforms TypeScript with oxc, which only implements legacy
      // (experimentalDecorators) decorators. This package uses standard
      // decorators, so TypeScript is transformed with esbuild instead, which
      // emits them together with Symbol.metadata.
      name: 'standard-decorators',
      enforce: 'pre',
      async transform(code, id) {
        if (!id.endsWith('.ts') || id.includes('/node_modules/')) return null;

        const result = await transform(code, {
          loader: 'ts',
          format: 'esm',
          target: 'es2024',
          sourcemap: true,
          sourcefile: id,
          tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true, useDefineForClassFields: true } },
        });

        return { code: result.code, map: result.map };
      },
    },
  ],
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
