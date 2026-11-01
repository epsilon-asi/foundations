import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CommandFailedError, GitWorktreeManager } from '../../../src/git-manager/index.js';
import { createTestRepo } from '../fixtures/createTestRepo.js';

describe('commit and stage', () => {
  it('stages explicit paths, commits with author override, stages all by default, and supports allow-empty commits', async () => {
    const repo = await createTestRepo();

    try {
      const worktreePath = join(repo.rootDir, 'commit-worktree');
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      await manager.createWorktree({
        worktreePath,
        branchName: 'feature/commit',
      });

      await writeFile(join(worktreePath, 'only-staged.txt'), 'staged once\n', 'utf8');
      await manager.stagePaths({
        worktreePath,
        paths: ['only-staged.txt'],
      });

      const firstCommit = await manager.commit({
        worktreePath,
        message: 'add staged file',
        stageAll: false,
        author: {
          name: 'Automation Bot',
          email: 'bot@example.com',
        },
      });

      expect(firstCommit.branchName).toBe('feature/commit');
      expect(firstCommit.headSha).toMatch(/^[0-9a-f]{40}$/u);
      expect((await repo.runGit(['log', '-1', '--format=%an <%ae>'], worktreePath)).trim()).toBe(
        'Automation Bot <bot@example.com>',
      );

      await writeFile(join(worktreePath, 'tracked.txt'), 'stage-all commit\n', 'utf8');

      const secondCommit = await manager.commit({
        worktreePath,
        message: 'stage all by default',
      });

      expect(secondCommit.headSha).not.toBe(firstCommit.headSha);
      expect((await repo.runGit(['log', '-1', '--format=%an <%ae>'], worktreePath)).trim()).toBe(
        'Test User <test@example.com>',
      );
      expect(await repo.runGit(['show', 'HEAD:tracked.txt'], worktreePath)).toBe('stage-all commit\n');

      const emptyCommit = await manager.commit({
        worktreePath,
        message: 'empty commit',
        allowEmpty: true,
        stageAll: false,
      });

      expect(emptyCommit.headSha).not.toBe(secondCommit.headSha);
      expect(await manager.getCurrentBranch(worktreePath)).toBe('feature/commit');
    } finally {
      await repo.cleanup();
    }
  });

  it('fails when there is nothing to commit and supports amending', async () => {
    const repo = await createTestRepo();

    try {
      const manager = new GitWorktreeManager({ repoPath: repo.repoPath });
      const before = await manager.getHeadSha();

      await expect(manager.commit({ worktreePath: repo.repoPath, message: 'nothing' })).rejects.toBeInstanceOf(
        CommandFailedError,
      );

      const amended = await manager.commit({ worktreePath: repo.repoPath, message: 'initial, reworded', amend: true });

      expect(amended.headSha).not.toBe(before);
      expect(amended.branchName).toBe('main');
      expect((await repo.runGit(['log', '--format=%s'])).trim()).toBe('initial, reworded');
    } finally {
      await repo.cleanup();
    }
  });
});
