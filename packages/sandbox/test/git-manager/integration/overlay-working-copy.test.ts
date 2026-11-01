import { lstat, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GitWorktreeManager, GitUsageError } from '../../../src/git-manager/index.js';
import { createTestRepo } from '../fixtures/createTestRepo.js';

describe('overlay working copy', () => {
  it('replays tracked changes and copies untracked files into a worktree', async () => {
    const repo = await createTestRepo();

    try {
      const worktreePath = join(repo.rootDir, 'overlay-worktree');
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      await manager.createWorktree({
        worktreePath,
        branchName: 'feature/overlay',
      });

      await writeFile(join(repo.repoPath, 'tracked.txt'), 'overlay tracked\n', 'utf8');
      await repo.writeRepoFile('nested/untracked.txt', 'overlay untracked\n');

      const expectedCopied = ['nested/untracked.txt'];

      if (process.platform !== 'win32') {
        await symlink('nested/untracked.txt', join(repo.repoPath, 'untracked-link'));
        expectedCopied.push('untracked-link');
      }

      const overlay = await manager.overlayWorkingChanges({
        worktreePath,
        sourcePath: repo.repoPath,
        baseRef: 'HEAD',
        includeUntracked: true,
      });

      expect(overlay.trackedPatchBytes).toBeGreaterThan(0);
      expect([...overlay.untrackedFilesCopied].sort()).toEqual(expectedCopied.sort());
      expect(await readFile(join(worktreePath, 'tracked.txt'), 'utf8')).toBe('overlay tracked\n');
      expect(await readFile(join(worktreePath, 'nested', 'untracked.txt'), 'utf8')).toBe('overlay untracked\n');

      if (process.platform !== 'win32') {
        const linkStats = await lstat(join(worktreePath, 'untracked-link'));
        expect(linkStats.isSymbolicLink()).toBe(true);
      }
    } finally {
      await repo.cleanup();
    }
  });

  it('overlays working changes while creating a worktree from the repository root', async () => {
    const repo = await createTestRepo();

    try {
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      await writeFile(join(repo.repoPath, 'tracked.txt'), 'carried over\n', 'utf8');
      await repo.writeRepoFile('fresh.txt', 'untracked\n');

      const worktree = await manager.createWorktree({
        worktreePath: join(repo.rootDir, 'overlay-on-create'),
        branchName: 'feature/overlay-on-create',
        overlayWorkingChanges: true,
        includeUntracked: true,
      });

      expect(worktree.overlayApplied).toBe(true);
      expect(worktree.untrackedFilesCopied).toEqual(['fresh.txt']);
      expect(await readFile(join(worktree.worktreePath, 'tracked.txt'), 'utf8')).toBe('carried over\n');
      expect(await readFile(join(worktree.worktreePath, 'fresh.txt'), 'utf8')).toBe('untracked\n');
    } finally {
      await repo.cleanup();
    }
  });

  it('refuses to overlay changes from a different repository', async () => {
    const repo = await createTestRepo();
    const otherRepo = await createTestRepo();

    try {
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      const worktree = await manager.createWorktree({ worktreePath: join(repo.rootDir, 'foreign'), detached: true });

      await expect(
        manager.overlayWorkingChanges({
          worktreePath: worktree.worktreePath,
          sourcePath: otherRepo.repoPath,
        }),
      ).rejects.toBeInstanceOf(GitUsageError);
    } finally {
      await Promise.all([repo.cleanup(), otherRepo.cleanup()]);
    }
  });
});
