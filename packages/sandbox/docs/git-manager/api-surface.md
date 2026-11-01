# API surface

Everything public is exported from `src/git-manager/index.ts` (`@epsilon-asi/sandbox/git-manager`, also flattened into
`@epsilon-asi/sandbox`); nothing else is part of the API. Field-level documentation lives in the JSDoc of the exported
types.

## Values

| Export                        | Kind     | Purpose                                                            |
| ----------------------------- | -------- | ------------------------------------------------------------------ |
| `GitWorktreeManager`          | class    | The single entry point                                             |
| `GitError`                    | class    | Base of the git-specific errors (extends `SandboxError`)           |
| `GitUsageError`               | class    | Invalid options, detected before git runs                          |
| `GitOutputParseError`         | class    | Unexpected git output format (`output`)                            |
| `ChildProcessCommandExecutor` | class    | Shared: the default executor                                       |
| `SandboxError`                | class    | Shared: root of every package error                                |
| `CommandFailedError`          | class    | Shared: git exited non-zero, was signalled or timed out (`result`) |
| `CommandExecutionError`       | class    | Shared: git could not be started or was aborted                    |
| `ensureSuccess`               | function | Shared: returns a successful result or throws `CommandFailedError` |

## Constructor

```ts
new GitWorktreeManager({
  repoPath: string,              // default for every optional `path`
  executor?: CommandExecutor,    // default: new ChildProcessCommandExecutor()
  gitBinary?: string,            // default 'git'
  env?: EnvironmentOverrides,    // every git command; undefined unsets a variable; commit() layers author vars on top
  filesystem?: FilesystemPort,   // default: node:fs adapter
});
```

The options are independent of each other.

## Methods

| Method                                                | Returns                                      |
| ----------------------------------------------------- | -------------------------------------------- |
| `ensureRepository()`                                  | `Promise<GitRepositoryInfo>`                 |
| `getRepoRoot(path?)`                                  | `Promise<string>` (real path)                |
| `getHeadSha(path?)`                                   | `Promise<string>`                            |
| `getCurrentBranch(path?)`                             | `Promise<string \| null>` (null = detached)  |
| `resolveRef(ref, path?)`                              | `Promise<string>`                            |
| `listWorktrees()`                                     | `Promise<readonly WorktreeInfo[]>`           |
| `createWorktree(CreateWorktreeOptions)`               | `Promise<CreateWorktreeResult>`              |
| `createBranch(CreateGitBranchOptions)`                | `Promise<GitBranchInfo>`                     |
| `removeWorktree(RemoveWorktreeOptions)`               | `Promise<void>`                              |
| `pruneWorktrees()`                                    | `Promise<void>`                              |
| `getStatus(path?)`                                    | `Promise<readonly GitStatusEntry[]>`         |
| `isClean(path?)`                                      | `Promise<boolean>`                           |
| `stageAll(worktreePath)`                              | `Promise<void>`                              |
| `stagePaths(GitStagePathsOptions)`                    | `Promise<void>`                              |
| `commit(GitCommitOptions)`                            | `Promise<GitCommitInfo>`                     |
| `discardUncommittedChanges(GitDiscardChangesOptions)` | `Promise<void>`                              |
| `exportTrackedDiff(GitDiffOptions)`                   | `Promise<string>`                            |
| `exportStagedDiff(GitDiffOptions)`                    | `Promise<string>`                            |
| `diffNameStatus(GitDiffOptions)`                      | `Promise<readonly GitDiffNameStatusEntry[]>` |
| `applyPatch(ApplyGitPatchOptions)`                    | `Promise<GitPatchApplyResult>`               |
| `overlayWorkingChanges(OverlayWorkingChangesOptions)` | `Promise<OverlayWorkingChangesResult>`       |

`GitWorktreeManagerApi` is the interface the class implements, for consumers that want to substitute the manager.

## Types

- Manager: `GitWorktreeManagerOptions`, `GitWorktreeManagerApi`, `FilesystemPort`
- Repository: `GitRepositoryInfo`, `WorktreeInfo`
- Worktrees: `CreateWorktreeOptions`, `CreateWorktreeResult`, `CreateGitBranchOptions`, `GitBranchInfo`,
  `RemoveWorktreeOptions`
- Changes: `GitStatusEntry`, `GitStatusKind`, `GitStagePathsOptions`, `GitCommitOptions`, `GitCommitAuthor`,
  `GitCommitInfo`, `GitDiscardChangesOptions`
- Patches: `GitDiffOptions`, `GitDiffNameStatusEntry`, `ApplyGitPatchOptions`, `GitPatchApplyResult`,
  `OverlayWorkingChangesOptions`, `OverlayWorkingChangesResult`
- Shared: `CommandExecutor`, `CommandExecutionOptions`, `CommandExecutionResult`, `EnvironmentOverrides`

Every worktree-scoped option and result uses the field `worktreePath`.

## Scope rule

New methods must fit one of the four groups above (repository, worktrees, changes, patch & overlay) and map to a
documented git command sequence in [git-command-mapping.md](git-command-mapping.md).
