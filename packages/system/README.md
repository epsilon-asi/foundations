# @epsilon-asi/system

## Verification

After the workspace install and build, run `corepack pnpm --filter @epsilon-asi/system run verify` from the repository root. It typechecks the source and tests, runs Jest, rebuilds `build/` from scratch, and loads the packed package by name with both ESM `import` and CommonJS `require`. Both use the CommonJS entry at `build/index.js`.

For a quicker edit cycle, `corepack pnpm --filter @epsilon-asi/system run typecheck` checks source and tests without writing build output. After a build, `corepack pnpm --filter @epsilon-asi/system run test:package` repeats just the consumer check. It extracts the tarball into a temporary project and reuses the package's installed dependencies.

The regular typecheck uses the root's TypeScript 5.9.3. CI repeats it on TypeScript 7.0.2 using the compiler pinned in the consumer fixture. Run both from the repository root.

```sh
corepack pnpm --filter @epsilon-asi/system run typecheck
npm --prefix testing/foundation-consumer ci --install-links
node testing/foundation-consumer/node_modules/typescript7/bin/tsc -p packages/system/tsconfig.type-tests.json --noEmit
```
