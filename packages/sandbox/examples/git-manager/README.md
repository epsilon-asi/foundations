# git-manager examples

Each example is a typed, exported async function that imports only the public API (`src/git-manager/index.ts`,
published as `@epsilon-asi/sandbox/git-manager`), so it is type-checked with the package and by the parent project.
`test/git-manager/examples.test.ts` runs every example against a fresh temporary repository and asserts on the
returned data; `npm test` is the way to run them.

To try one against your own repository, import the function from TypeScript code and pass real paths. The examples
perform real git operations and remove the worktrees they create.

## `basic-workflow.example.ts`: `runBasicWorkflow(repoPath, worktreePath)`

1. creates a worktree on the new branch `agent/basic-demo`
2. writes `example-basic.txt` inside it
3. reads status (one untracked file), commits with `stageAll` defaulting to `true`, reads status again (clean)
4. removes the worktree with `force` and `prune`

## `detached-workflow.example.ts`: `runDetachedWorkflow(repoPath, worktreePath)`

1. creates a detached worktree; `getCurrentBranch()` returns `null`
2. calls `createBranch()` to start `agent/from-detached` inside it
3. removes the worktree

## `patch-round-trip.example.ts`: `runPatchRoundTrip(repoPath, sourceWorktreePath, targetWorktreePath)`

1. creates source and target worktrees on their own branches
2. edits `tracked.txt` in the source and exports the tracked diff against `HEAD`
3. preflights the patch in the target with `checkOnly`, then applies it
4. returns the patch, both apply results and the target status, then removes both worktrees

## `overlay-working-copy.example.ts`: `runOverlayWorkingCopy(repoPath, worktreePath)`

1. creates a detached worktree
2. edits `tracked.txt` and creates `example-untracked/note.txt` **in `repoPath`'s own working copy**
3. replays tracked and untracked changes into the worktree with `overlayWorkingChanges()`
4. returns the overlay result and worktree status, then removes the worktree
