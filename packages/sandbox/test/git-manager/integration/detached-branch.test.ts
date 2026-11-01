import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GitWorktreeManager } from '../../../src/git-manager/index.js';
import { createTestRepo } from '../fixtures/createTestRepo.js';

describe('detached branch', () => {
  it('creates a detached worktree and then creates a branch inside it', async () => {
    const repo = await createTestRepo();

    try {
      const worktreePath = join(repo.rootDir, 'detached-worktree');
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      const worktree = await manager.createWorktree({
        worktreePath,
        detached: true,
      });

      expect(worktree.branchName).toBeNull();
      expect(await manager.getCurrentBranch(worktreePath)).toBeNull();

      const branch = await manager.createBranch({
        worktreePath,
        branchName: 'feature/from-detached',
      });

      expect(branch.branchName).toBe('feature/from-detached');
      expect(branch.headSha).toMatch(/^[0-9a-f]{40}$/u);
      expect(await manager.getCurrentBranch(worktreePath)).toBe('feature/from-detached');
    } finally {
      await repo.cleanup();
    }
  });
});
