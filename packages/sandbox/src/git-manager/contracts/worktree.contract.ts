/** Exactly one of `branchName` or `detached: true` is required. */
export interface CreateWorktreeOptions {
  /** Where the linked worktree is created; missing parent directories are created. */
  readonly worktreePath: string;
  /** Commit-ish the worktree starts from (default `HEAD`). */
  readonly startRef?: string;
  /** Creates this branch for the worktree (`-b`, or `-B` together with `force`). */
  readonly branchName?: string;
  /** Creates the worktree on a detached HEAD. */
  readonly detached?: boolean;
  /** Passes `--force` and resets an existing `branchName` (`-B`). */
  readonly force?: boolean;
  /** Passes `--track`. */
  readonly track?: boolean;
  /** Replays the source worktree's uncommitted changes into the new worktree. */
  readonly overlayWorkingChanges?: boolean;
  /** With `overlayWorkingChanges`, also copies untracked files. */
  readonly includeUntracked?: boolean;
  /** With `overlayWorkingChanges`, the worktree to replay (default: the repository root). */
  readonly sourcePath?: string;
}

export interface CreateWorktreeResult {
  /** Real path of the created worktree. */
  readonly worktreePath: string;
  readonly repoRoot: string;
  readonly startRef: string;
  readonly headSha: string;
  readonly branchName: string | null;
  /** Whether the overlay changed anything (tracked patch or untracked files). */
  readonly overlayApplied: boolean;
  readonly untrackedFilesCopied: readonly string[];
}

export interface CreateGitBranchOptions {
  readonly worktreePath: string;
  /** Branch to create and switch to; must not be blank. */
  readonly branchName: string;
  /** Start point (default: the worktree's current HEAD). */
  readonly startRef?: string;
  /** Resets the branch if it already exists (`switch -C`). */
  readonly force?: boolean;
}

export interface GitBranchInfo {
  readonly worktreePath: string;
  readonly headSha: string;
  readonly branchName: string | null;
}

export interface RemoveWorktreeOptions {
  readonly worktreePath: string;
  /** Removes the worktree even when it has uncommitted changes. */
  readonly force?: boolean;
  /** Runs `git worktree prune` afterwards. */
  readonly prune?: boolean;
}
