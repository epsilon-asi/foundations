# Edge cases

Expected behaviour for the cases that matter to worktree users, and where each is tested (paths relative to
`test/git-manager/`).

## Repository inspection

| Case                        | Behaviour                        | Test                                    |
| --------------------------- | -------------------------------- | --------------------------------------- |
| path inside a subdirectory  | `getRepoRoot()` returns the root | `integration/repository-basics.test.ts` |
| detached HEAD               | branch reported as `null`        | `integration/repository-basics.test.ts` |
| unknown ref                 | `CommandFailedError` (`result`)  | `integration/repository-basics.test.ts` |
| path outside any repository | `CommandFailedError`             | `integration/repository-basics.test.ts` |

## Worktree creation and branching

| Case                                    | Behaviour                                   | Test                                       |
| --------------------------------------- | ------------------------------------------- | ------------------------------------------ |
| both / neither `branchName`, `detached` | `GitUsageError`, git not run                | `unit/gitWorktreeManager.test.ts`          |
| blank branch name                       | `GitUsageError`, git not run                | `unit/gitWorktreeManager.test.ts`          |
| worktree parent directories missing     | created before `worktree add`               | `integration/worktree-lifecycle.test.ts`   |
| branch already exists                   | `CommandFailedError`; `force: true` resets  | `integration/worktree-lifecycle.test.ts`   |
| detached worktree, branch later         | `createBranch()` switches to the new branch | `integration/detached-branch.test.ts`      |
| overlay while creating                  | `overlayApplied` and copied files reported  | `integration/overlay-working-copy.test.ts` |

## Status parsing

Empty output, untracked, renamed, copied, unmerged (`UU`, `AA`, `DD`, ...), ignored codes, and truncated `-z` output
(`GitOutputParseError`) are covered in `unit/statusPorcelain.parser.test.ts` and `unit/inferStatusKind.test.ts`.

## Commits

| Case                         | Behaviour                           | Test                                   |
| ---------------------------- | ----------------------------------- | -------------------------------------- |
| nothing to commit            | `CommandFailedError` (`git commit`) | `integration/commit-and-stage.test.ts` |
| `allowEmpty`                 | new commit without changes          | `integration/commit-and-stage.test.ts` |
| `amend`                      | HEAD rewritten on the same branch   | `integration/commit-and-stage.test.ts` |
| `author` present / absent    | env override / configured identity  | `integration/commit-and-stage.test.ts` |
| blank message, empty `paths` | `GitUsageError`, git not run        | `unit/gitWorktreeManager.test.ts`      |

## Patches and overlay

| Case                                    | Behaviour                                     | Test                                       |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| empty patch                             | no git command, `appliedBytes: 0`             | `unit/gitWorktreeManager.test.ts`          |
| patch that does not apply               | `CommandFailedError` from `--check` preflight | `integration/patch-round-trip.test.ts`     |
| staged diff applied with `index: true`  | change lands in the target index              | `integration/patch-round-trip.test.ts`     |
| tracked diff only / untracked only      | apply skipped when the diff is empty          | `unit/gitWorktreeManager.test.ts`          |
| untracked symlink                       | recreated as a symlink                        | `integration/overlay-working-copy.test.ts` |
| untracked directory entry (nested repo) | `GitError` from the filesystem adapter        | `integration/filesystem.test.ts`           |
| source and target in different repos    | `GitUsageError`                               | `integration/overlay-working-copy.test.ts` |

## Discard and cleanup

| Case                              | Behaviour                                       | Test                                      |
| --------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| discard without `removeUntracked` | untracked files kept                            | `integration/discard-and-cleanup.test.ts` |
| clean worktree, no `force`        | removed                                         | `integration/worktree-lifecycle.test.ts`  |
| dirty worktree, no `force`        | `CommandFailedError`, worktree kept             | `integration/discard-and-cleanup.test.ts` |
| dirty worktree with `force`       | removed                                         | `integration/discard-and-cleanup.test.ts` |
| worktree directory deleted        | listed as prunable; `pruneWorktrees()` drops it | `integration/worktree-lifecycle.test.ts`  |

## Untrusted input

| Case                                                                         | Behaviour                                             | Covered by             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------- |
| ref, `baseRef`, `startRef`, `branchName` or `worktreePath` starting with `-` | `GitUsageError` before git runs (no option injection) | `unit/gitArgs.test.ts` |
| paths passed to `stagePaths()`                                               | placed after `--`, never parsed as options            | `unit/gitArgs.test.ts` |

## Command execution

| Case                               | Behaviour                                        | Test                                    |
| ---------------------------------- | ------------------------------------------------ | --------------------------------------- |
| git binary missing                 | shared `CommandExecutionError`, propagated as is | `integration/repository-basics.test.ts` |
| `env: { VAR: undefined }`          | inherited `VAR` is unset for every git command   | `integration/repository-basics.test.ts` |
| manager `env` plus commit `author` | author variables layered over the manager `env`  | `unit/runGit.test.ts`                   |
| non-zero exit, signal or timeout   | `CommandFailedError` with the full `result`      | `unit/runGit.test.ts`                   |
