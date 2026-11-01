import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CommandFailedError, GitWorktreeManager } from '../../../src/git-manager/index.js';
import { createTestRepo } from '../fixtures/createTestRepo.js';

describe('worktree lifecycle', () => {
  it('creates and removes a linked worktree', async () => {
    const repo = await createTestRepo();

    try {
      const worktreePath = join(repo.rootDir, 'worktree-clean');
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      const worktree = await manager.createWorktree({
        worktreePath,
        branchName: 'feature/worktree-lifecycle',
      });

      expect(worktree.repoRoot).toBe(repo.repoPath);
      expect(worktree.worktreePath).toBe(worktreePath);
      expect(worktree.branchName).toBe('feature/worktree-lifecycle');
      expect(worktree.overlayApplied).toBe(false);
      expect(await manager.getCurrentBranch(worktreePath)).toBe('feature/worktree-lifecycle');

      const listed = await manager.listWorktrees();
      expect(listed.some((entry) => entry.worktreePath === worktreePath)).toBe(true);

      await manager.removeWorktree({ worktreePath });

      const afterCleanup = await manager.listWorktrees();
      expect(afterCleanup.some((entry) => entry.worktreePath === worktreePath)).toBe(false);
    } finally {
      await repo.cleanup();
    }
  });

  it('prunes stale worktree metadata', async () => {
    const repo = await createTestRepo();

    try {
      const worktreePath = join(repo.rootDir, 'worktree-stale');
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      await manager.createWorktree({
        worktreePath,
        branchName: 'feature/stale-worktree',
      });

      await rm(worktreePath, { recursive: true, force: true });

      const beforePrune = await manager.listWorktrees();
      expect(beforePrune.some((entry) => entry.worktreePath === worktreePath && entry.prunable)).toBe(true);

      await manager.pruneWorktrees();

      const afterPrune = await manager.listWorktrees();
      expect(afterPrune.some((entry) => entry.worktreePath === worktreePath)).toBe(false);
    } finally {
      await repo.cleanup();
    }
  });

  it('creates missing parent directories, refuses an existing branch, and resets it with force', async () => {
    const repo = await createTestRepo();

    try {
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      const nestedPath = join(repo.rootDir, 'deep', 'er', 'worktree');
      const first = await manager.createWorktree({ worktreePath: nestedPath, branchName: 'feature/reused' });

      expect(first.worktreePath).toBe(nestedPath);
      await manager.removeWorktree({ worktreePath: nestedPath, prune: true });

      const secondPath = join(repo.rootDir, 'second');
      await expect(
        manager.createWorktree({ worktreePath: secondPath, branchName: 'feature/reused' }),
      ).rejects.toBeInstanceOf(CommandFailedError);

      const forced = await manager.createWorktree({
        worktreePath: secondPath,
        branchName: 'feature/reused',
        force: true,
      });
      expect(forced.branchName).toBe('feature/reused');
    } finally {
      await repo.cleanup();
    }
  });
});
