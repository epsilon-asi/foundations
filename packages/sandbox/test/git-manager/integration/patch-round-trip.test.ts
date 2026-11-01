import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GitWorktreeManager } from '../../../src/git-manager/index.js';
import { createTestRepo } from '../fixtures/createTestRepo.js';

describe('patch round trip', () => {
  it('exports a patch, preflights it, applies it, and reports diff name-status', async () => {
    const repo = await createTestRepo();

    try {
      const worktreePath = join(repo.rootDir, 'patch-worktree');
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      await manager.createWorktree({
        worktreePath,
        branchName: 'feature/patch-round-trip',
      });

      await writeFile(join(repo.repoPath, 'tracked.txt'), 'patched content\n', 'utf8');

      const patch = await manager.exportTrackedDiff({
        worktreePath: repo.repoPath,
        baseRef: 'HEAD',
      });

      expect(patch).toContain('patched content');

      const nameStatus = await manager.diffNameStatus({
        worktreePath: repo.repoPath,
        baseRef: 'HEAD',
      });

      expect(nameStatus).toEqual([
        {
          status: 'M',
          path: 'tracked.txt',
        },
      ]);

      const checkResult = await manager.applyPatch({
        worktreePath,
        patch,
        checkOnly: true,
      });

      expect(checkResult.checkOnly).toBe(true);
      expect(checkResult.appliedBytes).toBeGreaterThan(0);

      const applyResult = await manager.applyPatch({
        worktreePath,
        patch,
      });

      expect(applyResult.checkOnly).toBe(false);
      expect(applyResult.appliedBytes).toBe(checkResult.appliedBytes);
      expect(await manager.exportTrackedDiff({ worktreePath, baseRef: 'HEAD' })).toBe(patch);
    } finally {
      await repo.cleanup();
    }
  });

  it('exports a staged diff and applies it to the index of another worktree', async () => {
    const repo = await createTestRepo();

    try {
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      const target = await manager.createWorktree({
        worktreePath: join(repo.rootDir, 'staged-target'),
        detached: true,
      });

      await writeFile(join(repo.repoPath, 'tracked.txt'), 'staged change\n', 'utf8');
      await writeFile(join(repo.repoPath, 'unstaged.txt'), 'never staged\n', 'utf8');
      await manager.stagePaths({ worktreePath: repo.repoPath, paths: ['tracked.txt'] });

      const stagedPatch = await manager.exportStagedDiff({ worktreePath: repo.repoPath });
      expect(stagedPatch).toContain('+staged change');
      expect(stagedPatch).not.toContain('never staged');
      expect(await manager.exportStagedDiff({ worktreePath: repo.repoPath, baseRef: 'HEAD' })).toBe(stagedPatch);

      const result = await manager.applyPatch({ worktreePath: target.worktreePath, patch: stagedPatch, index: true });

      expect(result).toMatchObject({ index: true, checkOnly: false });
      expect(await manager.exportStagedDiff({ worktreePath: target.worktreePath })).toBe(stagedPatch);
      expect(await manager.diffNameStatus({ worktreePath: target.worktreePath })).toEqual([]);
    } finally {
      await repo.cleanup();
    }
  });

  it('rejects a patch that does not apply during the preflight check', async () => {
    const repo = await createTestRepo();

    try {
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      const target = await manager.createWorktree({ worktreePath: join(repo.rootDir, 'conflict'), detached: true });

      await writeFile(join(repo.repoPath, 'tracked.txt'), 'source edit\n', 'utf8');
      await writeFile(join(target.worktreePath, 'tracked.txt'), 'conflicting edit\n', 'utf8');
      const patch = await manager.exportTrackedDiff({ worktreePath: repo.repoPath, baseRef: 'HEAD' });

      await expect(manager.applyPatch({ worktreePath: target.worktreePath, patch })).rejects.toMatchObject({
        name: 'CommandFailedError',
        result: { args: ['apply', '--whitespace=nowarn', '--check', '-'], exitCode: 1 },
      });
    } finally {
      await repo.cleanup();
    }
  });
});
