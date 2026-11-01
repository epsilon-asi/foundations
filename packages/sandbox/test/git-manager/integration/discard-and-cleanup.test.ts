import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CommandFailedError, GitWorktreeManager } from '../../../src/git-manager/index.js';
import { createTestRepo } from '../fixtures/createTestRepo.js';

describe('discard and cleanup', () => {
  it('discards worktree changes and protects cleanup unless force is explicit', async () => {
    const repo = await createTestRepo();

    try {
      const worktreePath = join(repo.rootDir, 'cleanup-worktree');
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      await manager.createWorktree({
        worktreePath,
        branchName: 'feature/cleanup',
      });

      await writeFile(join(worktreePath, 'tracked.txt'), 'dirty tracked\n', 'utf8');
      await writeFile(join(worktreePath, 'scratch.txt'), 'dirty untracked\n', 'utf8');
      expect(await manager.isClean(worktreePath)).toBe(false);

      await manager.discardUncommittedChanges({
        worktreePath,
        removeUntracked: true,
      });

      expect(await manager.isClean(worktreePath)).toBe(true);
      expect(await readFile(join(worktreePath, 'tracked.txt'), 'utf8')).toBe('baseline tracked\n');

      await writeFile(join(worktreePath, 'tracked.txt'), 'dirty again\n', 'utf8');

      await expect(manager.removeWorktree({ worktreePath })).rejects.toBeInstanceOf(CommandFailedError);
      await manager.removeWorktree({ worktreePath, force: true, prune: true });

      const worktrees = await manager.listWorktrees();
      expect(worktrees.some((entry) => entry.worktreePath === worktreePath)).toBe(false);
    } finally {
      await repo.cleanup();
    }
  });

  it('keeps untracked files unless removeUntracked is set', async () => {
    const repo = await createTestRepo();

    try {
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      await writeFile(join(repo.repoPath, 'tracked.txt'), 'staged edit\n', 'utf8');
      await manager.stageAll(repo.repoPath);
      await writeFile(join(repo.repoPath, 'keep.txt'), 'untracked\n', 'utf8');

      expect((await manager.getStatus()).map((entry) => entry.rawStatus)).toEqual(['M ', '??']);

      await manager.discardUncommittedChanges({ worktreePath: repo.repoPath });

      expect(await manager.getStatus()).toMatchObject([{ path: 'keep.txt', kind: 'untracked' }]);
      expect(await repo.readRepoFile('tracked.txt')).toBe('baseline tracked\n');
    } finally {
      await repo.cleanup();
    }
  });
});
