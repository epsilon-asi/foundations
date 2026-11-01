import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  GitWorktreeManager,
  type CreateWorktreeResult,
  type GitStatusEntry,
  type OverlayWorkingChangesResult,
} from '../../src/git-manager/index.js';

export interface OverlayWorkingCopyResult {
  readonly worktree: CreateWorktreeResult;
  readonly overlay: OverlayWorkingChangesResult;
  readonly worktreeStatus: readonly GitStatusEntry[];
}

/**
 * Changes a tracked file and adds an untracked one in the repository's own working copy, then replays both into a
 * detached worktree. Note that this edits `tracked.txt` and creates `example-untracked/note.txt` in `repoPath`.
 */
export async function runOverlayWorkingCopy(repoPath: string, worktreePath: string): Promise<OverlayWorkingCopyResult> {
  const manager = new GitWorktreeManager({ repoPath });
  const worktree = await manager.createWorktree({ worktreePath, detached: true });

  try {
    await writeFile(join(repoPath, 'tracked.txt'), 'Overlay example tracked change.\n', 'utf8');
    await mkdir(join(repoPath, 'example-untracked'), { recursive: true });
    await writeFile(join(repoPath, 'example-untracked', 'note.txt'), 'Overlay example untracked file.\n', 'utf8');

    const overlay = await manager.overlayWorkingChanges({
      worktreePath: worktree.worktreePath,
      baseRef: 'HEAD',
      includeUntracked: true,
    });
    const worktreeStatus = await manager.getStatus(worktree.worktreePath);

    return { worktree, overlay, worktreeStatus };
  } finally {
    await manager.removeWorktree({ worktreePath: worktree.worktreePath, force: true, prune: true });
  }
}
