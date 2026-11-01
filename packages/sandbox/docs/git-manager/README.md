# git-manager

Strictly typed, isolated git worktrees for coding agents and other automation. Part of `@epsilon-asi/sandbox`.

`GitWorktreeManager` gives a predictable, fully typed way to:

- verify a repository and resolve refs
- create linked worktrees on a new branch or a detached commit
- read machine-friendly status entries
- stage and commit inside a worktree
- export, preflight and apply patches
- replay a working tree (tracked and untracked changes) into another worktree
- discard uncommitted changes
- remove and prune worktrees without silently discarding data

Every operation is a real `git` command run through the package's shared `CommandExecutor`;
[git-command-mapping.md](git-command-mapping.md) lists the exact command lines.

## Requirements and imports

Node `>=24` with `git` on the `PATH` (`git worktree` and `git switch` need git 2.23 or later). ESM only.

```ts
import { GitWorktreeManager } from '@epsilon-asi/sandbox/git-manager'; // this library
// or, from the package root: import { GitWorktreeManager } from '@epsilon-asi/sandbox';
```

The subpath also re-exports the shared symbols its API uses: `CommandExecutor`, `CommandExecutionOptions`,
`CommandExecutionResult`, `EnvironmentOverrides`, `ChildProcessCommandExecutor`, `SandboxError`, `CommandFailedError`,
`CommandExecutionError` and `ensureSuccess`.

## Usage

```ts
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { GitWorktreeManager } from '@epsilon-asi/sandbox/git-manager';

const manager = new GitWorktreeManager({ repoPath: '/path/to/repo' });

const worktree = await manager.createWorktree({ worktreePath: '/tmp/repo-agent', branchName: 'agent/demo' });
await writeFile(join(worktree.worktreePath, 'demo.txt'), 'hello from the worktree\n', 'utf8');

const commit = await manager.commit({ worktreePath: worktree.worktreePath, message: 'demo change' });
console.log(commit.headSha, commit.branchName);

await manager.removeWorktree({ worktreePath: worktree.worktreePath, force: true, prune: true });
```

Move a change between worktrees as a patch. `applyPatch()` always runs `git apply --check` first:

```ts
const patch = await manager.exportTrackedDiff({ worktreePath: '/path/to/source', baseRef: 'HEAD' });
await manager.applyPatch({ worktreePath: '/path/to/target', patch, checkOnly: true }); // preflight only
await manager.applyPatch({ worktreePath: '/path/to/target', patch });
```

Replay the repository's uncommitted work, including untracked files, into a worktree:

```ts
const overlay = await manager.overlayWorkingChanges({
  worktreePath: '/tmp/repo-agent',
  baseRef: 'HEAD',
  includeUntracked: true,
});
```

## Public API

| Group           | Methods                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository      | `ensureRepository()`, `getRepoRoot(path?)`, `getHeadSha(path?)`, `getCurrentBranch(path?)`, `resolveRef(ref, path?)`, `listWorktrees()`        |
| Worktrees       | `createWorktree(options)`, `createBranch(options)`, `removeWorktree(options)`, `pruneWorktrees()`                                              |
| Changes         | `getStatus(path?)`, `isClean(path?)`, `stageAll(worktreePath)`, `stagePaths(options)`, `commit(options)`, `discardUncommittedChanges(options)` |
| Patch & overlay | `exportTrackedDiff(options)`, `exportStagedDiff(options)`, `diffNameStatus(options)`, `applyPatch(options)`, `overlayWorkingChanges(options)`  |

Optional `path` arguments default to the constructor's `repoPath`. Option and result types (`CreateWorktreeOptions`,
`CreateWorktreeResult`, `GitStatusEntry`, ...) are exported by name; [api-surface.md](api-surface.md) is the full
reference.

### Constructor options

```ts
new GitWorktreeManager({
  repoPath: '/path/to/repo', // default for every optional `path`
  executor, // CommandExecutor; default: new ChildProcessCommandExecutor()
  gitBinary: 'git', // binary handed to the executor
  env: { GIT_DIR: undefined }, // overrides for every git command; undefined unsets a variable
  filesystem, // FilesystemPort; default: node:fs
});
```

All options are independent. Pass an `executor` to log, fake or redirect every git command, for example:

```ts
import {
  ChildProcessCommandExecutor,
  GitWorktreeManager,
  type CommandExecutor,
} from '@epsilon-asi/sandbox/git-manager';

const inner = new ChildProcessCommandExecutor();
const logging: CommandExecutor = {
  run: async (binary, args, options) => {
    console.log(binary, args.join(' '));
    return await inner.run(binary, args, options);
  },
};

const manager = new GitWorktreeManager({ repoPath: '/repo', executor: logging });
```

`filesystem` replaces the `node:fs` implementation of `FilesystemPort` used to create worktree parent directories and
copy untracked files.

## Errors

- `GitUsageError` (extends `GitError` → `SandboxError`): contradictory or missing options, detected before git runs.
- `CommandFailedError` (shared): git exited non-zero; `result` holds command, cwd, exit code, signal, stdout and stderr.
- `CommandExecutionError` (shared): git could not be started (e.g. missing binary); `cause` is the spawn error.
- `GitOutputParseError` (extends `GitError`): git output did not match the expected porcelain format; `output` holds
  the raw text.

```ts
import { CommandFailedError } from '@epsilon-asi/sandbox/git-manager';

try {
  await manager.removeWorktree({ worktreePath: '/tmp/repo-agent' });
} catch (error) {
  if (error instanceof CommandFailedError) {
    console.error(error.result.stderr); // e.g. the worktree contains modified or untracked files
  }
}
```

See [error-model.md](error-model.md) for details and [edge-cases.md](edge-cases.md) for covered edge cases.

## Layout

```text
src/git-manager/
  index.ts               public exports (plus the shared symbols the API uses)
  gitWorktreeManager.ts  GitWorktreeManager, its options and GitWorktreeManagerApi
  errors.ts              GitError, GitUsageError, GitOutputParseError
  ports.ts               FilesystemPort
  contracts/             option and result types
  internal/              argv builders (gitArgs.ts), node:fs adapter
  parsers/               pure parsers for -z porcelain output
  workflows/             git orchestration, one function per public method; gitContext.ts holds runGit()
```

Examples: [`examples/git-manager/`](../../examples/git-manager/README.md), executed by
`test/git-manager/examples.test.ts`. Contribution rules: [AGENT.md](AGENT.md).
