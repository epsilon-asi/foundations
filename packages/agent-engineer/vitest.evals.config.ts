import {standardDecorators} from '@epsilon-asi/command-line/vitest';
import {defineConfig} from 'vitest/config';

// Evals call real models and cost money, so they have a config of their own: `npm run eval`, never `npm test`.
export default defineConfig({
    plugins: [standardDecorators()],
    test: {
        environment: 'node',
        include: ['evals/**/*.eval.ts'],
        // One suite at a time, so their progress and summaries do not interleave.
        fileParallelism: false,
    },
});
