import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        restoreMocks: true,
        unstubEnvs: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts', 'src/types.ts'],
            reporter: ['text', 'lcov'],
            thresholds: {statements: 90, branches: 90, functions: 90, lines: 90},
        },
    },
});
