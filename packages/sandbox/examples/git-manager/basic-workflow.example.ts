import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  GitWorktreeManager,
  type CreateWorktreeResult,
  type GitCommitInfo,
  type GitStatusEntry,
} from '../../src/git-manager/index.js';

export interface BasicWorkflowResult {
  readonly worktree: CreateWorktreeResult;
  readonly statusBeforeCommit: readonly GitStatusEntry[];
  readonly commit: GitCommitInfo;
  readonly statusAfterCommit: readonly GitStatusEntry[];
}

/** Creates a branch-backed worktree, commits a new file inside it, and removes the worktree again. */
export async function runBasicWorkflow(repoPath: string, worktreePath: string): Promise<BasicWorkflowResult> {
  const manager = new GitWorktreeManager({ repoPath });
  const worktree = await manager.createWorktree({ worktreePath, branchName: 'agent/basic-demo' });

  try {
    await writeFile(join(worktree.worktreePath, 'example-basic.txt'), 'Created from the basic example.\n', 'utf8');

    const statusBeforeCommit = await manager.getStatus(worktree.worktreePath);
    const commit = await manager.commit({
      worktreePath: worktree.worktreePath,
      message: 'example: create basic worktree change',
    });
    const statusAfterCommit = await manager.getStatus(worktree.worktreePath);

    return { worktree, statusBeforeCommit, commit, statusAfterCommit };
  } finally {
    await manager.removeWorktree({ worktreePath: worktree.worktreePath, force: true, prune: true });
  }
}
