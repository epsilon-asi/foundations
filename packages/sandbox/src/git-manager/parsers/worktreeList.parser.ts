import type { WorktreeInfo } from '../contracts/index.js';
import { GitOutputParseError } from '../errors.js';
import { splitNulFields } from './nulFields.js';

type WorktreeDraft = { -readonly [Key in keyof WorktreeInfo]: WorktreeInfo[Key] };

const BRANCH_REF_PREFIX = 'refs/heads/';

function emptyWorktree(worktreePath: string): WorktreeDraft {
  return {
    worktreePath,
    headSha: null,
    branchRef: null,
    branchName: null,
    detached: false,
    bare: false,
    locked: false,
    lockedReason: null,
    prunable: false,
    prunableReason: null,
  };
}

/** Applies one `<label>[ <value>]` attribute line to the current record; returns `false` for unknown labels. */
function applyAttribute(record: WorktreeDraft, label: string, value: string | null): boolean {
  switch (label) {
    case 'HEAD':
      record.headSha = value;
      return value !== null;
    case 'branch':
      record.branchRef = value;
      record.branchName = value?.startsWith(BRANCH_REF_PREFIX) === true ? value.slice(BRANCH_REF_PREFIX.length) : null;
      return value !== null;
    case 'detached':
      record.detached = true;
      return true;
    case 'bare':
      record.bare = true;
      return true;
    case 'locked':
      record.locked = true;
      record.lockedReason = value;
      return true;
    case 'prunable':
      record.prunable = true;
      record.prunableReason = value;
      return true;
    default:
      return false;
  }
}

/** Parses `git worktree list --porcelain -z` output. */
export function parseWorktreeList(output: string): WorktreeInfo[] {
  const worktrees: WorktreeDraft[] = [];

  for (const field of splitNulFields(output)) {
    const separator = field.indexOf(' ');
    const label = separator === -1 ? field : field.slice(0, separator);
    const value = separator === -1 ? null : field.slice(separator + 1);

    if (label === 'worktree' && value !== null) {
      worktrees.push(emptyWorktree(value));
      continue;
    }

    const current = worktrees.at(-1);

    if (current === undefined) {
      throw new GitOutputParseError(
        `Malformed worktree list: ${JSON.stringify(field)} appears before the first worktree header.`,
        output,
      );
    }

    if (!applyAttribute(current, label, value)) {
      throw new GitOutputParseError(`Malformed worktree list: unsupported attribute ${JSON.stringify(field)}.`, output);
    }
  }

  return worktrees;
}
