# AGENT.md

Rules for agents changing `@epsilon-asi/sandbox`. Area-specific rules live in `docs/<area>/` (container-runtime and
git-manager have their own `AGENT.md`; repo-runner and repo-search document theirs in `architecture.md` /
`ARCHITECTURE.md`).

## Layout

```text
src/index.ts            flat public root: `export *` of every area index (the only place `export *` is allowed)
src/sandbox/            Sandbox facade: worktree + optional container + tasks + search
src/shared/             command layer (CommandExecutor, ChildProcessCommandExecutor), SandboxError root, helpers
src/container-runtime/  containers (Docker CLI implementation, ContainerCommandExecutor)
src/git-manager/        git worktrees
src/repo-runner/        toolchain detection and repository tasks
src/repo-search/        local code search (+ lsp/, cli.ts for the `repo-search` bin)
test/<area>/  examples/<area>/  docs/<area>/  scripts/
```

Dependency direction: `sandbox` → areas → `shared`. Areas never import each other; anything two areas need belongs in
`shared`.

## Hard rules

1. **Vocabulary.** "Sandbox" names only the facade (`Sandbox`, `CreateSandboxOptions`, ...) and the error root
   (`SandboxError`). A git checkout is a **worktree**, a container is a **container** whose host directory is its
   **workspace**, a toolchain runner is a **repo runner**.
2. **One flat namespace.** Every area's `index.ts` is an explicit public API (named exports; it also re-exports the
   shared symbols its API uses). Names must be unique across the package — qualify generic names (`GitDiffOptions`,
   `RepoFileEntry`, ...). The compiler rejects collisions in `src/index.ts`.
3. **One command layer.** Never spawn processes outside `src/shared/childProcessExecutor.ts` (exception: the
   long-lived LSP client). Accept an `executor?: CommandExecutor` wherever a component runs commands. Commands that
   must succeed go through `ensureSuccess` (→ `CommandFailedError`); spawn failures propagate as
   `CommandExecutionError` unwrapped. Stack env layers with object spread (keeps `undefined` = unset);
   `mergeEnvironment` is only for the final process environment.
4. **Errors** extend `SandboxError` (directly or via the area's base error) and never set `name` manually.
5. **Shared helpers** (`omitUndefined`, `isRecord`, `fileExists`, `canonicalPath`, `commandExists`, ...) live in
   `src/shared/`; do not copy them into an area.
6. **Strict TypeScript** as configured in `tsconfig.json` (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
   `erasableSyntaxOnly`): no `any`, no non-null `!`, no enums/namespaces/parameter properties; relative imports end in
   `.js`.
7. **Tests** import test APIs explicitly from `vitest` and use no globals or setup files — the parent project also
   runs them with its own Vitest 2. Integration tests that need Docker or real toolchains are opt-in via environment
   variables (see README).
8. **Public API changes** update tests, examples, the area guide in `docs/<area>/`, the README when the facade or
   entry points change, and `CHANGELOG.md`.

## Verification

```bash
npm run verify
```
