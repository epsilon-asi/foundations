import { GitWorktreeManager, type CreateWorktreeResult, type GitBranchInfo } from '../../src/git-manager/index.js';

export interface DetachedWorkflowResult {
  readonly worktree: CreateWorktreeResult;
  readonly branchBefore: string | null;
  readonly branch: GitBranchInfo;
  readonly branchAfter: string | null;
}

/** Creates a detached worktree, then starts a branch inside it once the work is worth keeping. */
export async function runDetachedWorkflow(repoPath: string, worktreePath: string): Promise<DetachedWorkflowResult> {
  const manager = new GitWorktreeManager({ repoPath });
  const worktree = await manager.createWorktree({ worktreePath, detached: true });

  try {
    const branchBefore = await manager.getCurrentBranch(worktree.worktreePath);
    const branch = await manager.createBranch({
      worktreePath: worktree.worktreePath,
      branchName: 'agent/from-detached',
    });
    const branchAfter = await manager.getCurrentBranch(worktree.worktreePath);

    return { worktree, branchBefore, branch, branchAfter };
  } finally {
    await manager.removeWorktree({ worktreePath: worktree.worktreePath, force: true, prune: true });
  }
}
