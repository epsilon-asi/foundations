import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { GitWorktreeManager, type GitPatchApplyResult, type GitStatusEntry } from '../../src/git-manager/index.js';

export interface PatchRoundTripResult {
  readonly patch: string;
  readonly preflight: GitPatchApplyResult;
  readonly applied: GitPatchApplyResult;
  readonly targetStatus: readonly GitStatusEntry[];
}

/**
 * Edits a file in one worktree, exports the change as a patch, preflights it against a second worktree, and applies
 * it there. Both worktrees are removed afterwards.
 */
export async function runPatchRoundTrip(
  repoPath: string,
  sourceWorktreePath: string,
  targetWorktreePath: string,
): Promise<PatchRoundTripResult> {
  const manager = new GitWorktreeManager({ repoPath });
  const source = await manager.createWorktree({ worktreePath: sourceWorktreePath, branchName: 'agent/patch-source' });

  try {
    const target = await manager.createWorktree({ worktreePath: targetWorktreePath, branchName: 'agent/patch-target' });

    try {
      await writeFile(join(source.worktreePath, 'tracked.txt'), 'Patch created from the source worktree.\n', 'utf8');

      const patch = await manager.exportTrackedDiff({ worktreePath: source.worktreePath, baseRef: 'HEAD' });
      const preflight = await manager.applyPatch({ worktreePath: target.worktreePath, patch, checkOnly: true });
      const applied = await manager.applyPatch({ worktreePath: target.worktreePath, patch });
      const targetStatus = await manager.getStatus(target.worktreePath);

      return { patch, preflight, applied, targetStatus };
    } finally {
      await manager.removeWorktree({ worktreePath: target.worktreePath, force: true, prune: true });
    }
  } finally {
    await manager.removeWorktree({ worktreePath: source.worktreePath, force: true, prune: true });
  }
}
