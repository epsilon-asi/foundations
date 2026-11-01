# Git command mapping

Every argument vector is built by a pure function or constant in `src/git-manager/internal/gitArgs.ts` (`GIT_ARGS.*`
and `build*Args`), which `test/git-manager/unit/gitArgs.test.ts` pins. The workflows in `src/git-manager/workflows/`
decide the sequence, and `runGit()` hands each command to the injected `CommandExecutor` as
`executor.run(gitBinary, args, { cwd, env?, stdin? })`, where `env` is the manager's `env` with any per-command
overrides layered on top.

`<repoRoot>` below is `git rev-parse --show-toplevel` of the manager's `repoPath`, resolved to a real path.

## Repository

| Method                   | Commands                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `ensureRepository()`     | `rev-parse --show-toplevel`, then in parallel `rev-parse HEAD` and `rev-parse --abbrev-ref HEAD` |
| `getRepoRoot(path)`      | `rev-parse --show-toplevel` (result passed through `realpath`)                                   |
| `getHeadSha(path)`       | `rev-parse HEAD`                                                                                 |
| `getCurrentBranch(path)` | `rev-parse --abbrev-ref HEAD` (`HEAD` is reported as `null`)                                     |
| `resolveRef(ref, path)`  | `rev-parse --verify <ref>`                                                                       |
| `listWorktrees()`        | `worktree list --porcelain -z` in `<repoRoot>`                                                   |

## Worktrees

### `createWorktree()`

1. validate exactly one of `branchName` / `detached`
2. `FilesystemPort.mkdir(dirname(worktreePath))`
3. in `<repoRoot>`: `worktree add --quiet [--force] [--track] [--detach] [-b|-B <branchName>] <worktreePath> <startRef|HEAD>`
   (`-B` when `force` is set)
4. if `overlayWorkingChanges`: the overlay sequence below with `baseRef = startRef` and `sourcePath ?? <repoRoot>`
5. `rev-parse HEAD` and `rev-parse --abbrev-ref HEAD` in the new worktree

### `createBranch()`

`switch -c <branchName> [<startRef>]` (`-C` when `force`), then the two HEAD queries.

### `removeWorktree()` / `pruneWorktrees()`

`worktree remove [--force] <worktreePath>` in `<repoRoot>`, then `worktree prune` when `prune` is set.
`pruneWorktrees()` runs `worktree prune` alone.

## Changes

| Method                        | Commands                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getStatus(path)` / `isClean` | `status --porcelain=v1 -z`                                                                                                                                                               |
| `stageAll(worktreePath)`      | `add -A -- .`                                                                                                                                                                            |
| `stagePaths()`                | `add -- <path...>`                                                                                                                                                                       |
| `commit()`                    | `add -A -- .` unless `stageAll: false`; `commit --no-gpg-sign -m <message> [--allow-empty] [--amend]` with `GIT_AUTHOR_*`/`GIT_COMMITTER_*` set from `author`; then the two HEAD queries |
| `discardUncommittedChanges()` | `reset --hard HEAD`, then `clean -fd` when `removeUntracked` is set                                                                                                                      |

## Patches

| Method                | Commands                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exportTrackedDiff()` | `diff --binary --find-renames [<baseRef>]`                                                                                                                                         |
| `exportStagedDiff()`  | `diff --cached --binary --find-renames [<baseRef>]`                                                                                                                                |
| `diffNameStatus()`    | `diff --name-status -z [<baseRef>]`                                                                                                                                                |
| `applyPatch()`        | `apply --whitespace=nowarn [--index] --check -`, then (unless `checkOnly`) `apply --whitespace=nowarn [--index] -`; the patch is passed as `stdin` and an empty patch runs nothing |

## Overlay (`overlayWorkingChanges()`)

1. `rev-parse --show-toplevel` for the source (`sourcePath ?? repoPath`) and the target `worktreePath`
2. `rev-parse --path-format=absolute --git-common-dir` for both; different directories raise `GitUsageError`
3. `diff --binary --find-renames [<baseRef>]` in the source
4. `applyPatch()` of that diff into the target (check, then apply)
5. if `includeUntracked`: `ls-files --others --exclude-standard -z` in the source, then
   `FilesystemPort.copyFileOrSymlink()` for each file (symlinks are recreated, file modes preserved)
