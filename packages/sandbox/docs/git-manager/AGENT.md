# AGENT.md

Rules for agents changing the git-manager library (`src/git-manager/`) of `@epsilon-asi/sandbox`: a narrow,
worktree-first git library.

## Hard constraints

1. Keep strict typing: no `any`, no non-null `!`, no ambient shims, no loosening of the root `tsconfig.json`.
2. Every public method maps to a documented git command sequence in [git-command-mapping.md](git-command-mapping.md).
3. Only `src/git-manager/index.ts` defines the public API of the `@epsilon-asi/sandbox/git-manager` subpath (explicit
   named exports, no `export *`). Exported names must be unique across the whole package (the root entry flattens
   every library), so git-specific types carry a `Git` prefix or a `Worktree` noun.
4. Never spawn processes directly: every git command goes through `runGit()` in `workflows/gitContext.ts`, which calls
   the injected shared `CommandExecutor` and `ensureSuccess()`. Do not wrap `CommandFailedError` or
   `CommandExecutionError`. Do not edit `src/shared/`.
5. Tests must run under both this package's Vitest and the parent project's Vitest 2: import test APIs explicitly from
   `vitest`, no globals or setup files. Relative imports keep `.js` extensions.
6. Integration tests use real git in temporary directories. Fakes are only for the `CommandExecutor`
   (`test/git-manager/fixtures/fakeExecutor.ts`) and `FilesystemPort`.

## Architecture

```text
gitWorktreeManager.ts     thin class: builds the GitContext, resolves path defaults, delegates to workflows
workflows/*.workflow.ts   one plain function per operation: (context: GitContext, ...public method args)
workflows/gitContext.ts   GitContext and runGit()/readGitValue(): the only place commands are executed
internal/gitArgs.ts       pure argv builders: the only place git arguments are spelled out
internal/filesystem.ts    default FilesystemPort (node:fs)
parsers/*.ts              pure parsers for -z output; malformed input throws GitOutputParseError
errors.ts / ports.ts / contracts/   error classes, FilesystemPort, option/result types
```

Dependency direction: `gitWorktreeManager` → `workflows` → (`internal`, `parsers`, `contracts`, `errors`, `ports`,
`../shared`). Parsers and `gitArgs` never execute anything; workflows never build argv inline.

Conventions:

- Read HEAD state with `readHead()`; query helpers live in `workflows/repository.workflow.ts` (no wrappers).
- Canonicalise paths with the shared `canonicalPath()` (`src/shared/fs.ts`).
- Validate options with `assertUsage()` before running git.
- Split `-z` output with `splitNulFields()` / `takeField()` from `parsers/nulFields.ts`.

## Files that must move together

| Change                  | Also update                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| public method or option | `GitWorktreeManagerApi` JSDoc, `index.ts` exports, `api-surface.md`, `README.md`, tests  |
| git command line        | `internal/gitArgs.ts`, `test/git-manager/unit/gitArgs.test.ts`, `git-command-mapping.md` |
| parser                  | its unit test, `edge-cases.md` if behaviour changes                                      |
| error class or payload  | `errors.ts`, `error-model.md`, `test/git-manager/unit/errors.test.ts`                    |
| example                 | `examples/git-manager/README.md`, `test/git-manager/examples.test.ts`                    |

## Verification

From the package root (Node 24):

```bash
npx tsc -p tsconfig.json 2>&1 | grep -E "^(src|test|examples)/git-manager/"   # prints nothing
npx eslint src/git-manager test/git-manager examples/git-manager
npx vitest run test/git-manager --coverage --coverage.include='src/git-manager/**' && rm -rf coverage
npx prettier --write src/git-manager test/git-manager examples/git-manager docs/git-manager
```
