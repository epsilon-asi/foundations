# Error model

Every error raised by the library extends the package root `SandboxError`, accepts standard `ErrorOptions` (`cause`)
and has `name` set to its class name. Git-specific classes live in `src/git-manager/errors.ts`; command errors come
from the shared layer (`src/shared/errors.ts`).

```text
SandboxError (shared)
├── GitError                 base of git-specific errors; also thrown for unsupported overlay entries
│   ├── GitUsageError        invalid API usage, before git runs
│   └── GitOutputParseError  git output did not match the expected format
├── CommandFailedError       (shared) git ran and exited non-zero / was signalled / timed out
└── CommandExecutionError    (shared) git could not be started (or was aborted / exceeded its output limit)
```

## `GitUsageError`

Raised before any git command that changes state; apart from the overlay check below, before git runs at all.

- `createWorktree()` with both `branchName` and `detached: true`, or with neither
- `createWorktree()` / `createBranch()` with a blank `branchName`
- `stagePaths()` with an empty `paths` array
- `commit()` with a blank `message`
- a ref, `baseRef`, `startRef`, `branchName` or `worktreePath` that starts with `-` (option-injection guard)
- `overlayWorkingChanges()` when source and target belong to different repositories (checked with
  `rev-parse --git-common-dir`, so this one runs read-only queries first)

## `CommandFailedError`

Every git command must succeed; `runGit()` passes the executor's result through `ensureSuccess()`. `result` is the
full `CommandExecutionResult` (`command`, `args`, `cwd`, `exitCode`, `signal`, `stdout`, `stderr`, `durationMs`,
`timedOut`) exactly as observed. The message is `<command> failed (<exit code N | signal S | timed out>)` followed by
git's trimmed stderr.

## `CommandExecutionError`

Raised by the executor, not by this library, and propagated unchanged: the git binary is missing or `cwd` does not
exist (spawn failure; `cause` is the original error), the command was aborted, or it exceeded `maxOutputBytes`.
`binary`, `args` and `cwd` say what was being run. A custom `CommandExecutor` may reject with its own errors; they
propagate unchanged too.

## `GitOutputParseError`

Raised by the pure parsers when `-z` porcelain output is truncated or contains unknown records (for example a
rename entry without its second path, or an unknown `worktree list` attribute). `output` holds the full raw text.

## `GitError`

Thrown directly by the default `FilesystemPort` when an untracked entry selected for overlay is neither a regular file
nor a symlink (for example an untracked nested repository, which git lists as a directory).

Errors from Node's filesystem APIs (permissions, missing files) propagate unchanged.

## Rules

- never throw strings or plain `Error`s for library conditions
- never rewrite git's stderr into vague summaries; it stays in `CommandFailedError.result.stderr`
- keep failure kinds distinct: usage, command failed, command could not run, parse
