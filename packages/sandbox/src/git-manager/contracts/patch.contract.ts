export interface GitDiffOptions {
  /** Worktree to diff (the main checkout or any linked worktree). */
  readonly worktreePath: string;
  /**
   * Commit to diff against. When omitted git's defaults apply: working tree vs index, or index vs `HEAD` for
   * staged diffs.
   */
  readonly baseRef?: string;
}

export interface ApplyGitPatchOptions {
  readonly worktreePath: string;
  /** Patch text as produced by `exportTrackedDiff()` / `exportStagedDiff()`. An empty patch is a no-op. */
  readonly patch: string;
  /** Only verify that the patch applies (`git apply --check`). */
  readonly checkOnly?: boolean;
  /** Apply to the index as well as the working tree (`--index`). */
  readonly index?: boolean;
}

export interface GitPatchApplyResult {
  readonly worktreePath: string;
  readonly checkOnly: boolean;
  readonly index: boolean;
  /** UTF-8 byte length of the patch; `0` means nothing was run. */
  readonly appliedBytes: number;
}

/** One entry of `git diff --name-status`. */
export interface GitDiffNameStatusEntry {
  /** Status letter, with a similarity score for renames/copies (e.g. `M`, `R100`). */
  readonly status: string;
  readonly path: string;
  /** Source path of a rename or copy. */
  readonly oldPath?: string;
}

export interface OverlayWorkingChangesOptions {
  /** Worktree that receives the changes. */
  readonly worktreePath: string;
  /** Base for the tracked diff; when omitted the working tree is compared with the index. */
  readonly baseRef?: string;
  /** Worktree whose changes are replayed (default: the manager's `repoPath`). */
  readonly sourcePath?: string;
  /** Also copy untracked, non-ignored files (symlinks are preserved). */
  readonly includeUntracked?: boolean;
}

export interface OverlayWorkingChangesResult {
  /** Root of the worktree that received the changes. */
  readonly worktreePath: string;
  readonly sourcePath: string;
  readonly trackedPatchBytes: number;
  /** Untracked files copied, relative to the worktree roots. */
  readonly untrackedFilesCopied: readonly string[];
}
