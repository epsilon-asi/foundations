/** Classification of a porcelain status code, from most to least significant. */
export type GitStatusKind =
  | 'untracked'
  | 'ignored'
  | 'unmerged'
  | 'renamed'
  | 'copied'
  | 'added'
  | 'deleted'
  | 'modified'
  | 'type-changed'
  | 'unknown';

/** One entry of `git status --porcelain=v1 -z`. */
export interface GitStatusEntry {
  /** The two-character `XY` code. */
  readonly rawStatus: string;
  readonly indexStatus: string;
  readonly worktreeStatus: string;
  readonly path: string;
  /** Source path of a rename or copy. */
  readonly originalPath: string | null;
  readonly kind: GitStatusKind;
}
