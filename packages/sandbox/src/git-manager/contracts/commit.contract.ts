/** Identity used for both the author and the committer of a commit. */
export interface GitCommitAuthor {
  readonly name: string;
  readonly email: string;
}

export interface GitCommitOptions {
  readonly worktreePath: string;
  /** Commit message; must not be blank. */
  readonly message: string;
  /** Overrides the configured identity via `GIT_AUTHOR_*` / `GIT_COMMITTER_*`. */
  readonly author?: GitCommitAuthor;
  /** Passes `--allow-empty`. */
  readonly allowEmpty?: boolean;
  /** Passes `--amend`. */
  readonly amend?: boolean;
  /** Runs `git add -A -- .` before committing unless `false` (default `true`). */
  readonly stageAll?: boolean;
}

export interface GitCommitInfo {
  readonly worktreePath: string;
  readonly headSha: string;
  /** Current branch after the commit, or `null` when HEAD is detached. */
  readonly branchName: string | null;
  readonly message: string;
}

export interface GitStagePathsOptions {
  readonly worktreePath: string;
  /** Pathspecs relative to `worktreePath`; at least one is required. */
  readonly paths: readonly string[];
}

export interface GitDiscardChangesOptions {
  readonly worktreePath: string;
  /** Also deletes untracked files and directories (`git clean -fd`). */
  readonly removeUntracked?: boolean;
}
