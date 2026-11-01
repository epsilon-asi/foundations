/**
 * `@epsilon-asi/sandbox`: one-stop sandbox toolkit for local coding agents.
 *
 * Start with {@link Sandbox} (a git worktree, optionally mounted into a container, with repository tasks, code
 * search and git operations scoped to it). Every building block is also exported here, and per area from
 * `@epsilon-asi/sandbox/container-runtime`, `/git-manager`, `/repo-runner`, `/repo-search` and `/repo-search/lsp`.
 *
 * This is the only module that aggregates with `export *`: each area's `index.ts` is an explicit public API,
 * and the compiler rejects any name exported by two areas.
 */
export * from './sandbox/index.js';
export * from './shared/index.js';
export * from './container-runtime/index.js';
export * from './git-manager/index.js';
export * from './repo-runner/index.js';
export * from './repo-search/index.js';
export * from './repo-search/lsp/index.js';
