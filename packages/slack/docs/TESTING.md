# Testing and verification

The package uses Vitest with V8 coverage.

## Commands

```bash
npm run typecheck
npm run build
npm run test
npm run coverage
npm run verify
```

`npm run verify` is the main CI command. It runs:

1. `tsc --noEmit` against source, tests, and examples.
2. `tsup` production build for ESM, CommonJS, and `.d.ts` files.
3. Vitest coverage with thresholds.

## Coverage thresholds

The project enforces minimum coverage:

- Statements: 80%
- Branches: 80%
- Lines: 80%
- Functions: 80%

The generated project currently exceeds those thresholds:

- Statements: 95.04%
- Branches: 89.67%
- Lines: 95.02%
- Functions: 92.48%

## What to test for new components

Each component should include tests for:

- Minimum valid options.
- All optional fields that change output structure.
- Empty or truncated states.
- Actions and URLs.
- Fallback text.
- Validation behavior when relevant.

## Importability checks

After `npm run build`, verify both module systems:

```bash
node -e "import('./dist/index.js').then(m => console.log(Boolean(m.message)))"
node -e "const m = require('./dist/index.cjs'); console.log(Boolean(m.message))"
```
