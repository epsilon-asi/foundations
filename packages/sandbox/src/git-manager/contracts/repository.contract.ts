export interface GitRepositoryInfo {
  /** Real path of the worktree root. */
  readonly repoRoot: string;
  readonly headSha: string;
  /** Checked-out branch, or `null` when HEAD is detached. */
  readonly currentBranch: string | null;
}

/** One record of `git worktree list --porcelain`. */
export interface WorktreeInfo {
  readonly worktreePath: string;
  readonly headSha: string | null;
  /** Full ref such as `refs/heads/main`. */
  readonly branchRef: string | null;
  /** Short branch name derived from `branchRef`. */
  readonly branchName: string | null;
  readonly detached: boolean;
  readonly bare: boolean;
  readonly locked: boolean;
  readonly lockedReason: string | null;
  readonly prunable: boolean;
  readonly prunableReason: string | null;
}
